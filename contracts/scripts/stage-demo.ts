import { ethers, fhevm, network } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ConfidentialBallot, ConfidentialGovToken } from "../types";

/// Stages demo data on the deployed Sepolia contracts so the app, screenshots,
/// and video show real on-chain state. Two phases, both idempotent:
///
///   STAGE_PHASE=stage (default, bun run stage:sepolia):
///     - sweeps existing ballots: closes, reveals, and executes anything whose
///       voting window already expired,
///     - funds the ballot treasury with cGOV,
///     - creates two short-window ballots and votes on them from 3 accounts
///       (one ends 2 yes / 1 no, the other 1 yes / 2 no),
///     - creates the long-lived ballot that stays open for the live demo.
///
///   STAGE_PHASE=finish (bun run finish:sepolia, run after the short windows
///   expire, about 7 minutes later):
///     - sweeps again: closes and reveals the two voted ballots and executes
///       the payout of every passed ballot.
///
/// Account 0 of the MNEMONIC pays all gas; accounts 1 and 2 only vote and are
/// topped up here. cGOV is an open-mint test token, so re-running the stage
/// phase mints another treasury batch; that is harmless on Sepolia.

// Deployed 2026-07-03 by scripts/deploy.ts; also listed in the repo README.
const BALLOT_ADDRESS = "0xb9e89A9819d740C723a448BF7D3513D13b7e4F53";
const TOKEN_ADDRESS = "0x62D93Eac4719F33DAab75f6B8E1aE4DDdd96223c";

// Mirror of the on-chain BallotState enum (same declaration order).
const BALLOT_STATE = { Active: 0n, Revealing: 1n, Resolved: 2n } as const;

// 420 s: long enough for two ballot creations plus six relayer-encrypted votes
// on Sepolia (~15-30 s per tx), short enough that finish can run minutes later.
const FINISHED_BALLOT_DURATION_SECONDS = 420n;
// 7 days keeps the live-demo ballot open through judging.
const OPEN_BALLOT_DURATION_SECONDS = 7n * 24n * 3600n;
// Gas money sent to voter accounts 1 and 2 (they only ever cast votes).
const VOTER_TOP_UP_ETHER = "0.01";
// Treasury funding per stage run, in whole cGOV (scaled by decimals below).
const TREASURY_FUNDING_WHOLE_TOKENS = 100000n;

function logStep(message: string): void {
  console.log(`[stage-demo] ${message}`);
}

async function encryptAmountForContract(
  contractAddress: string,
  sender: HardhatEthersSigner,
  amount: bigint,
): Promise<{ handle: Uint8Array; inputProof: Uint8Array }> {
  const encrypted = await fhevm.createEncryptedInput(contractAddress, sender.address).add64(amount).encrypt();
  return { handle: encrypted.handles[0], inputProof: encrypted.inputProof };
}

async function castEncryptedVote(
  ballot: ConfidentialBallot,
  voter: HardhatEthersSigner,
  ballotId: bigint,
  support: boolean,
): Promise<void> {
  const encrypted = await fhevm
    .createEncryptedInput(await ballot.getAddress(), voter.address)
    .addBool(support)
    .encrypt();
  const tx = await ballot.connect(voter).vote(ballotId, encrypted.handles[0], encrypted.inputProof);
  await tx.wait();
  logStep(`vote cast on ballot ${ballotId} by ${voter.address}`);
}

async function createDemoBallot(
  ballot: ConfidentialBallot,
  creator: HardhatEthersSigner,
  params: { description: string; durationSeconds: bigint; beneficiary: string; payoutAmount: bigint },
): Promise<bigint> {
  const encrypted = await encryptAmountForContract(await ballot.getAddress(), creator, params.payoutAmount);
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
      const decrypted = await fhevm.publicDecrypt([encryptedYes, encryptedNo]);
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

  // 3. Fund the treasury with confidential cGOV.
  const decimals = await token.decimals();
  const payoutUnit = 10n ** BigInt(decimals);
  const encryptedFunding = await encryptAmountForContract(
    TOKEN_ADDRESS,
    deployer,
    TREASURY_FUNDING_WHOLE_TOKENS * payoutUnit,
  );
  const mintTx = await token
    .connect(deployer)
    .mint(BALLOT_ADDRESS, encryptedFunding.handle, encryptedFunding.inputProof);
  await mintTx.wait();
  logStep(`treasury funded with ${TREASURY_FUNDING_WHOLE_TOKENS} cGOV (encrypted on-chain)`);

  // 4. The two ballots that finish will show one passed, one rejected.
  const grantsBallotId = await createDemoBallot(ballot, deployer, {
    description: "Renew the contributor grants committee for Q3 (750 cGOV)",
    durationSeconds: FINISHED_BALLOT_DURATION_SECONDS,
    beneficiary: beneficiary.address,
    payoutAmount: 750n * payoutUnit,
  });
  const marketingBallotId = await createDemoBallot(ballot, deployer, {
    description: "Double the marketing budget for next quarter (2000 cGOV)",
    durationSeconds: FINISHED_BALLOT_DURATION_SECONDS,
    beneficiary: beneficiary.address,
    payoutAmount: 2000n * payoutUnit,
  });

  // 5. Six votes in three parallel lanes (one per signer, so nonces never
  // collide): grants ends 2 yes / 1 no, marketing ends 1 yes / 2 no.
  const voteLanes: { voter: HardhatEthersSigner; grantsChoice: boolean; marketingChoice: boolean }[] = [
    { voter: deployer, grantsChoice: true, marketingChoice: false },
    { voter: voterOne, grantsChoice: true, marketingChoice: true },
    { voter: voterTwo, grantsChoice: false, marketingChoice: false },
  ];
  await Promise.all(
    voteLanes.map(async (lane) => {
      await castEncryptedVote(ballot, lane.voter, grantsBallotId, lane.grantsChoice);
      await castEncryptedVote(ballot, lane.voter, marketingBallotId, lane.marketingChoice);
    }),
  );

  // 6. The ballot that stays open for the live demo (created last so it sits
  // on top of the newest-first list in the app).
  await createDemoBallot(ballot, deployer, {
    description: "Fund the Q3 open-source grant round (250 cGOV)",
    durationSeconds: OPEN_BALLOT_DURATION_SECONDS,
    beneficiary: beneficiary.address,
    payoutAmount: 250n * payoutUnit,
  });

  logStep(
    `stage phase done; run finish:sepolia after ${FINISHED_BALLOT_DURATION_SECONDS} s to close and reveal the voted ballots`,
  );
}

async function main() {
  if (network.name !== "sepolia") {
    throw new Error(`[stage-demo] expected --network sepolia, got ${network.name}`);
  }

  // Under `hardhat run` the fhevm plugin does not self-initialize (it only
  // does so inside `hardhat test`); without this call createEncryptedInput
  // throws "The Hardhat Fhevm plugin is not initialized".
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
