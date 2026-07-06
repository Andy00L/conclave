import { ethers, fhevm, network } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ConfidentialBallot, ConfidentialGovToken } from "../types";

/// Stages demo data on the deployed Sepolia contracts so the app, screenshots,
/// and video show real on-chain state. The contract addresses come from the
/// environment (the deploy step prints them):
///
///   BALLOT_ADDRESS=0x... TOKEN_ADDRESS=0x... bun run stage:sepolia
///   BALLOT_ADDRESS=0x... TOKEN_ADDRESS=0x... bun run finish:sepolia
///
/// Two phases, both idempotent:
///
///   stage (default): sweeps expired ballots, mints cGOV to the deployer and
///     two voter accounts, authorizes the ballot as their token operator, funds
///     the treasury through fundTreasury, creates two short-window ballots and
///     casts stake-weighted votes on them (one passes, one is rejected), then
///     creates the long-lived ballot that stays open for the live demo.
///
///   finish (STAGE_PHASE=finish, run after the short windows expire): sweeps
///     again to close, reveal, and pay out the two voted ballots.
///
/// Account 0 of the MNEMONIC is the token owner and pays all gas; accounts 1
/// and 2 vote and are minted tokens and topped up with gas here.

const BALLOT_ADDRESS = process.env.BALLOT_ADDRESS ?? "";
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS ?? "";

// Mirror of the on-chain BallotState enum (same declaration order).
const BALLOT_STATE = { Active: 0n, Revealing: 1n, Resolved: 2n } as const;

// 420 s: long enough for the setup plus six relayer-encrypted votes on Sepolia
// (~15-30 s per tx), short enough that finish can run minutes later.
const FINISHED_BALLOT_DURATION_SECONDS = 420n;
// 7 days keeps the live-demo ballot open through judging.
const OPEN_BALLOT_DURATION_SECONDS = 7n * 24n * 3600n;
// Gas money the deployer sends to voter accounts 1 and 2. Each casts two
// FHE-heavy votes on Sepolia, so 0.02 ETH leaves a margin over the ~0.01 pair.
const VOTER_TOP_UP_ETHER = "0.02";
// Operator authorization expiry, far in the future (a uint48 timestamp).
const OPERATOR_UNTIL = 4102444800n; // 2100-01-01
// Treasury funding per stage run, in whole cGOV (scaled by decimals below).
const TREASURY_FUNDING_WHOLE_TOKENS = 100000n;

function logStep(message: string): void {
  console.log(`[stage-demo] ${message}`);
}

// Retries a relayer round-trip a few times on transient network failures. The
// Zama testnet relayer occasionally closes the socket mid-request, which aborts
// an otherwise valid input-proof or public-decrypt call. Backs off between tries.
async function withRelayerRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
  const maxAttempts = 6;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        logStep(`${label}: relayer attempt ${attempt}/${maxAttempts} failed, retrying in ${attempt * 3}s`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
      }
    }
  }
  throw lastError;
}

async function encryptAmountForContract(
  contractAddress: string,
  sender: HardhatEthersSigner,
  amount: bigint,
): Promise<{ handle: Uint8Array; inputProof: Uint8Array }> {
  const encrypted = await withRelayerRetry("encrypt amount", () =>
    fhevm.createEncryptedInput(contractAddress, sender.address).add64(amount).encrypt(),
  );
  return { handle: encrypted.handles[0], inputProof: encrypted.inputProof };
}

// Owner-only mint of `wholeTokens` cGOV to `to`.
async function mintWholeTokens(
  token: ConfidentialGovToken,
  owner: HardhatEthersSigner,
  to: string,
  wholeTokens: bigint,
  payoutUnit: bigint,
): Promise<void> {
  const encrypted = await encryptAmountForContract(TOKEN_ADDRESS, owner, wholeTokens * payoutUnit);
  await (await token.connect(owner).mint(to, encrypted.handle, encrypted.inputProof)).wait();
  logStep(`minted ${wholeTokens} cGOV to ${to}`);
}

// Let the ballot pull `account`'s tokens (needed to fund the treasury or vote).
async function authorizeBallot(token: ConfidentialGovToken, account: HardhatEthersSigner): Promise<void> {
  await (await token.connect(account).setOperator(BALLOT_ADDRESS, OPERATOR_UNTIL)).wait();
  logStep(`${account.address} authorized the ballot as token operator`);
}

async function fundTreasury(ballot: ConfidentialBallot, funder: HardhatEthersSigner, amount: bigint): Promise<void> {
  const encrypted = await encryptAmountForContract(BALLOT_ADDRESS, funder, amount);
  await (await ballot.connect(funder).fundTreasury(encrypted.handle, encrypted.inputProof)).wait();
  logStep(`treasury funded with an encrypted amount`);
}

async function castWeightedVote(
  ballot: ConfidentialBallot,
  voter: HardhatEthersSigner,
  ballotId: bigint,
  support: boolean,
  weight: bigint,
): Promise<void> {
  const encrypted = await withRelayerRetry(`encrypt vote on ballot ${ballotId}`, () =>
    fhevm.createEncryptedInput(BALLOT_ADDRESS, voter.address).addBool(support).add64(weight).encrypt(),
  );
  const tx = await ballot
    .connect(voter)
    .vote(ballotId, encrypted.handles[0], encrypted.handles[1], encrypted.inputProof);
  await tx.wait();
  logStep(`vote cast on ballot ${ballotId} by ${voter.address}`);
}

async function createDemoBallot(
  ballot: ConfidentialBallot,
  creator: HardhatEthersSigner,
  params: { description: string; durationSeconds: bigint; beneficiary: string; payoutAmount: bigint },
): Promise<bigint> {
  const encrypted = await encryptAmountForContract(BALLOT_ADDRESS, creator, params.payoutAmount);
  const tx = await ballot
    .connect(creator)
    .createBallot(
      params.description,
      params.durationSeconds,
      params.beneficiary,
      encrypted.handle,
      encrypted.inputProof,
    );
  await tx.wait();
  const ballotId = (await ballot.ballotCount()) - 1n;
  logStep(`created ballot ${ballotId}: "${params.description}"`);
  return ballotId;
}

/// Closes, reveals, and executes every ballot the chain allows right now:
/// expired Active ballots get closed, Revealing ballots get resolved, and
/// passed unexecuted ballots get paid. Skips everything still in its window.
async function sweepExpiredBallots(ballot: ConfidentialBallot, caller: HardhatEthersSigner): Promise<void> {
  const latestBlock = await ethers.provider.getBlock("latest");
  if (!latestBlock) throw new Error("[stage-demo] could not read the latest block");
  const nowSeconds = BigInt(latestBlock.timestamp);

  const count = await ballot.ballotCount();
  for (let ballotId = 0n; ballotId < count; ballotId++) {
    const view = await ballot.getBallot(ballotId);
    let state = BigInt(view.state);

    if (state === BALLOT_STATE.Active && nowSeconds > view.endTime) {
      const closeTx = await ballot.connect(caller).closeBallot(ballotId);
      await closeTx.wait();
      logStep(`sweep: ballot ${ballotId} closed`);
      state = BALLOT_STATE.Revealing;
    }

    if (state === BALLOT_STATE.Revealing) {
      const [encryptedYes, encryptedNo] = await ballot.getEncryptedTallies(ballotId);
      const decrypted = await withRelayerRetry(`decrypt tallies of ballot ${ballotId}`, () =>
        fhevm.publicDecrypt([encryptedYes, encryptedNo]),
      );
      const resolveTx = await ballot
        .connect(caller)
        .resolve(ballotId, decrypted.abiEncodedClearValues, decrypted.decryptionProof);
      await resolveTx.wait();
      logStep(`sweep: ballot ${ballotId} resolved`);
    }

    const refreshed = await ballot.getBallot(ballotId);
    if (BigInt(refreshed.state) === BALLOT_STATE.Resolved && refreshed.passed && !refreshed.executed) {
      const executeTx = await ballot.connect(caller).execute(ballotId);
      await executeTx.wait();
      logStep(`sweep: ballot ${ballotId} payout executed to ${refreshed.beneficiary}`);
    }
  }
}

async function runStagePhase(
  ballot: ConfidentialBallot,
  token: ConfidentialGovToken,
  signers: HardhatEthersSigner[],
): Promise<void> {
  const [deployer, voterOne, voterTwo, beneficiary] = signers;
  const decimals = await token.decimals();
  const payoutUnit = 10n ** BigInt(decimals);
  const inWhole = (wholeTokens: bigint) => wholeTokens * payoutUnit;

  // 1. Gas for the two voter accounts (skipped when they already hold enough).
  const topUp = ethers.parseEther(VOTER_TOP_UP_ETHER);
  for (const voter of [voterOne, voterTwo]) {
    const balance = await ethers.provider.getBalance(voter.address);
    if (balance < topUp / 2n) {
      const tx = await deployer.sendTransaction({ to: voter.address, value: topUp });
      await tx.wait();
      logStep(`topped up ${voter.address} with ${VOTER_TOP_UP_ETHER} ETH`);
    }
  }

  // 2. Resolve whatever older runs left behind before adding new ballots.
  await sweepExpiredBallots(ballot, deployer);

  // 3. Mint governance tokens: the deployer covers the treasury plus its own
  //    voting weight; each voter gets enough to stake on both ballots.
  await mintWholeTokens(token, deployer, deployer.address, TREASURY_FUNDING_WHOLE_TOKENS + 100n, payoutUnit);
  await mintWholeTokens(token, deployer, voterOne.address, 100n, payoutUnit);
  await mintWholeTokens(token, deployer, voterTwo.address, 100n, payoutUnit);

  // 4. Everyone authorizes the ballot as their token operator so it can pull
  //    the treasury funding and the voting stakes.
  await authorizeBallot(token, deployer);
  await Promise.all([authorizeBallot(token, voterOne), authorizeBallot(token, voterTwo)]);

  // 5. Fund the treasury (tracked apart from voter stakes).
  await fundTreasury(ballot, deployer, inWhole(TREASURY_FUNDING_WHOLE_TOKENS));

  // 6. The two ballots that finish will show one passed, one rejected.
  const grantsBallotId = await createDemoBallot(ballot, deployer, {
    description: "Renew the contributor grants committee for Q3 (750 cGOV)",
    durationSeconds: FINISHED_BALLOT_DURATION_SECONDS,
    beneficiary: beneficiary.address,
    payoutAmount: inWhole(750n),
  });
  const marketingBallotId = await createDemoBallot(ballot, deployer, {
    description: "Double the marketing budget for next quarter (2000 cGOV)",
    durationSeconds: FINISHED_BALLOT_DURATION_SECONDS,
    beneficiary: beneficiary.address,
    payoutAmount: inWhole(2000n),
  });

  // 7. Stake-weighted votes, cast one at a time so the relayer only ever handles
  //    a single input-proof request at once (concurrent requests occasionally
  //    get the socket closed mid-flight). Each signer still keeps its own nonce
  //    lane. Grants ends 50 yes / 10 no (passes), marketing ends 10 yes / 50 no
  //    (rejected). Weights are in whole cGOV.
  const voteLanes: {
    voter: HardhatEthersSigner;
    grants: { support: boolean; weight: bigint };
    marketing: { support: boolean; weight: bigint };
  }[] = [
    {
      voter: deployer,
      grants: { support: true, weight: inWhole(30n) },
      marketing: { support: false, weight: inWhole(30n) },
    },
    {
      voter: voterOne,
      grants: { support: true, weight: inWhole(20n) },
      marketing: { support: true, weight: inWhole(10n) },
    },
    {
      voter: voterTwo,
      grants: { support: false, weight: inWhole(10n) },
      marketing: { support: false, weight: inWhole(20n) },
    },
  ];
  for (const lane of voteLanes) {
    await castWeightedVote(ballot, lane.voter, grantsBallotId, lane.grants.support, lane.grants.weight);
    await castWeightedVote(ballot, lane.voter, marketingBallotId, lane.marketing.support, lane.marketing.weight);
  }

  // 8. The ballot that stays open for the live demo (created last so it sits on
  //    top of the newest-first list in the app).
  await createDemoBallot(ballot, deployer, {
    description: "Fund the Q3 open-source grant round (250 cGOV)",
    durationSeconds: OPEN_BALLOT_DURATION_SECONDS,
    beneficiary: beneficiary.address,
    payoutAmount: inWhole(250n),
  });

  logStep(
    `stage phase done; run finish:sepolia after ${FINISHED_BALLOT_DURATION_SECONDS} s to close and reveal the voted ballots`,
  );
}

async function main() {
  if (network.name !== "sepolia") {
    throw new Error(`[stage-demo] expected --network sepolia, got ${network.name}`);
  }
  if (!BALLOT_ADDRESS || !TOKEN_ADDRESS) {
    throw new Error("[stage-demo] set BALLOT_ADDRESS and TOKEN_ADDRESS in the environment before running");
  }

  // Under `hardhat run` the fhevm plugin does not self-initialize (it only does
  // so inside `hardhat test`); without this call createEncryptedInput throws
  // "The Hardhat Fhevm plugin is not initialized".
  await fhevm.initializeCLIApi();

  const signers = await ethers.getSigners();
  logStep(`deployer ${signers[0].address}, phase ${process.env.STAGE_PHASE ?? "stage"}`);

  const ballot = (await ethers.getContractAt("ConfidentialBallot", BALLOT_ADDRESS)) as ConfidentialBallot;
  const token = (await ethers.getContractAt("ConfidentialGovToken", TOKEN_ADDRESS)) as ConfidentialGovToken;

  if (process.env.STAGE_PHASE === "finish") {
    await sweepExpiredBallots(ballot, signers[0]);
  } else {
    await runStagePhase(ballot, token, signers);
  }

  const finalCount = await ballot.ballotCount();
  logStep(`done; the contract now holds ${finalCount} ballots`);
}

main().catch((error) => {
  console.error("[stage-demo] failed:", error);
  process.exitCode = 1;
});
