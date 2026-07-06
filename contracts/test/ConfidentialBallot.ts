import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import {
  ConfidentialBallot,
  ConfidentialBallot__factory,
  ConfidentialGovToken,
  ConfidentialGovToken__factory,
} from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

// Mirror of the on-chain BallotState enum (same declaration order).
const BallotState = { Active: 0, Revealing: 1, Resolved: 2 } as const;

// Operator authorization expiry, far in the future (a uint48 timestamp).
const OPERATOR_UNTIL = 4102444800n; // 2100-01-01

async function deployFixture(owner: HardhatEthersSigner) {
  const tokenFactory = (await ethers.getContractFactory("ConfidentialGovToken")) as ConfidentialGovToken__factory;
  const token = (await tokenFactory.deploy("Conclave Gov", "cGOV", "", owner.address)) as ConfidentialGovToken;
  const tokenAddress = await token.getAddress();

  const ballotFactory = (await ethers.getContractFactory("ConfidentialBallot")) as ConfidentialBallot__factory;
  const ballotContract = (await ballotFactory.deploy(tokenAddress)) as ConfidentialBallot;
  const ballotAddress = await ballotContract.getAddress();

  return { token, tokenAddress, ballotContract, ballotAddress };
}

describe("ConfidentialBallot", function () {
  let signers: Signers;
  let token: ConfidentialGovToken;
  let tokenAddress: string;
  let ballotContract: ConfidentialBallot;
  let ballotAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2], carol: ethSigners[3] };
  });

  beforeEach(async function () {
    // The encrypted flows only run against the FHEVM mock, not a live network.
    if (!fhevm.isMock) {
      console.warn(`This test suite can only run against the FHEVM mock environment`);
      this.skip();
    }
    ({ token, tokenAddress, ballotContract, ballotAddress } = await deployFixture(signers.deployer));
  });

  // The deployer is the token owner: mint governance tokens to `account`.
  async function giveTokens(account: HardhatEthersSigner, amount: bigint) {
    const encrypted = await fhevm.createEncryptedInput(tokenAddress, signers.deployer.address).add64(amount).encrypt();
    await (
      await token.connect(signers.deployer).mint(account.address, encrypted.handles[0], encrypted.inputProof)
    ).wait();
  }

  // Let the ballot contract pull `account`'s tokens (needed to vote or fund).
  async function authorize(account: HardhatEthersSigner) {
    await (await token.connect(account).setOperator(ballotAddress, OPERATOR_UNTIL)).wait();
  }

  async function fundTreasury(amount = 1000n) {
    await giveTokens(signers.deployer, amount);
    await authorize(signers.deployer);
    const encrypted = await fhevm.createEncryptedInput(ballotAddress, signers.deployer.address).add64(amount).encrypt();
    await (
      await ballotContract.connect(signers.deployer).fundTreasury(encrypted.handles[0], encrypted.inputProof)
    ).wait();
  }

  async function createBallot(
    durationSeconds = 3600,
    beneficiary: string = signers.carol.address,
    payout = 100n,
  ): Promise<bigint> {
    const encrypted = await fhevm
      .createEncryptedInput(ballotAddress, signers.deployer.address)
      .add64(payout)
      .encrypt();
    await (
      await ballotContract
        .connect(signers.deployer)
        .createBallot("Fund the grant?", durationSeconds, beneficiary, encrypted.handles[0], encrypted.inputProof)
    ).wait();
    return (await ballotContract.ballotCount()) - 1n;
  }

  // Give `voter` tokens, authorize the ballot, and cast a stake-weighted vote.
  async function castVote(voter: HardhatEthersSigner, ballotId: bigint, support: boolean, weight: bigint) {
    await giveTokens(voter, weight);
    await authorize(voter);
    const encrypted = await fhevm
      .createEncryptedInput(ballotAddress, voter.address)
      .addBool(support)
      .add64(weight)
      .encrypt();
    await (
      await ballotContract
        .connect(voter)
        .vote(ballotId, encrypted.handles[0], encrypted.handles[1], encrypted.inputProof)
    ).wait();
  }

  async function closeAndResolve(ballotId: bigint) {
    await (await ballotContract.closeBallot(ballotId)).wait();
    const [encryptedYes, encryptedNo] = await ballotContract.getEncryptedTallies(ballotId);
    const publicDecryption = await fhevm.publicDecrypt([encryptedYes, encryptedNo]);
    await (
      await ballotContract.resolve(ballotId, publicDecryption.abiEncodedClearValues, publicDecryption.decryptionProof)
    ).wait();
  }

  async function decryptBalance(account: HardhatEthersSigner): Promise<bigint> {
    const handle = await token.confidentialBalanceOf(account.address);
    if (handle === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddress, account);
  }

  describe("ConfidentialGovToken", function () {
    it("mints a fixed amount from the faucet, once per address", async function () {
      await (await token.connect(signers.alice).faucetMint()).wait();
      expect(await decryptBalance(signers.alice)).to.eq(100_000_000n);
      expect(await token.faucetClaimed(signers.alice.address)).to.eq(true);

      await expect(token.connect(signers.alice).faucetMint()).to.be.revertedWithCustomError(
        token,
        "FaucetAlreadyClaimed",
      );
    });

    it("restricts mint to the owner", async function () {
      const encrypted = await fhevm.createEncryptedInput(tokenAddress, signers.alice.address).add64(1n).encrypt();
      await expect(
        token.connect(signers.alice).mint(signers.alice.address, encrypted.handles[0], encrypted.inputProof),
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  it("creates a ballot in the Active state", async function () {
    const ballotId = await createBallot();
    const ballot = await ballotContract.getBallot(ballotId);

    expect(ballot.description).to.eq("Fund the grant?");
    expect(ballot.beneficiary).to.eq(signers.carol.address);
    expect(ballot.state).to.eq(BallotState.Active);
    expect(ballot.executed).to.eq(false);
    expect(await ballotContract.ballotCount()).to.eq(1n);
  });

  it("rejects a zero duration", async function () {
    const encrypted = await fhevm.createEncryptedInput(ballotAddress, signers.deployer.address).add64(1n).encrypt();
    await expect(
      ballotContract.createBallot("bad", 0, signers.carol.address, encrypted.handles[0], encrypted.inputProof),
    ).to.be.revertedWithCustomError(ballotContract, "InvalidDuration");
  });

  it("rejects the zero-address beneficiary", async function () {
    const encrypted = await fhevm.createEncryptedInput(ballotAddress, signers.deployer.address).add64(1n).encrypt();
    await expect(
      ballotContract.createBallot("bad", 3600, ethers.ZeroAddress, encrypted.handles[0], encrypted.inputProof),
    ).to.be.revertedWithCustomError(ballotContract, "InvalidBeneficiary");
  });

  it("records that an address has voted without exposing its choice", async function () {
    const ballotId = await createBallot();
    await castVote(signers.alice, ballotId, true, 100n);

    expect(await ballotContract.hasVoted(ballotId, signers.alice.address)).to.eq(true);
    expect(await ballotContract.hasVoted(ballotId, signers.bob.address)).to.eq(false);

    const [encryptedYes, encryptedNo] = await ballotContract.getEncryptedTallies(ballotId);
    expect(encryptedYes).to.not.eq(ethers.ZeroHash);
    expect(encryptedNo).to.not.eq(ethers.ZeroHash);
  });

  it("requires the voter to authorize the ballot as a token operator", async function () {
    const ballotId = await createBallot();
    await giveTokens(signers.alice, 100n); // tokens but no setOperator
    const encrypted = await fhevm
      .createEncryptedInput(ballotAddress, signers.alice.address)
      .addBool(true)
      .add64(100n)
      .encrypt();
    await expect(
      ballotContract
        .connect(signers.alice)
        .vote(ballotId, encrypted.handles[0], encrypted.handles[1], encrypted.inputProof),
    ).to.be.revertedWithCustomError(token, "ERC7984UnauthorizedSpender");
  });

  it("blocks a second vote from the same address", async function () {
    const ballotId = await createBallot();
    await castVote(signers.alice, ballotId, true, 100n);

    await giveTokens(signers.alice, 50n);
    const secondVote = await fhevm
      .createEncryptedInput(ballotAddress, signers.alice.address)
      .addBool(false)
      .add64(50n)
      .encrypt();
    await expect(
      ballotContract
        .connect(signers.alice)
        .vote(ballotId, secondVote.handles[0], secondVote.handles[1], secondVote.inputProof),
    ).to.be.revertedWithCustomError(ballotContract, "AlreadyVoted");
  });

  it("rejects votes cast after the voting period", async function () {
    const ballotId = await createBallot(100);
    await giveTokens(signers.alice, 100n);
    await authorize(signers.alice);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);

    const lateVote = await fhevm
      .createEncryptedInput(ballotAddress, signers.alice.address)
      .addBool(true)
      .add64(100n)
      .encrypt();
    await expect(
      ballotContract
        .connect(signers.alice)
        .vote(ballotId, lateVote.handles[0], lateVote.handles[1], lateVote.inputProof),
    ).to.be.revertedWithCustomError(ballotContract, "VotingPeriodOver");
  });

  it("cannot be closed before the voting period ends", async function () {
    const ballotId = await createBallot(3600);
    await expect(ballotContract.closeBallot(ballotId)).to.be.revertedWithCustomError(
      ballotContract,
      "VotingPeriodNotOver",
    );
  });

  it("tallies stake-weighted votes and reveals only the aggregate weights", async function () {
    const ballotId = await createBallot(100);

    await castVote(signers.alice, ballotId, true, 300n);
    await castVote(signers.bob, ballotId, true, 200n);
    await castVote(signers.carol, ballotId, false, 100n);

    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    const resolved = await ballotContract.getBallot(ballotId);
    expect(resolved.state).to.eq(BallotState.Resolved);
    expect(resolved.yesWeight).to.eq(500n); // 300 + 200
    expect(resolved.noWeight).to.eq(100n);
    expect(resolved.passed).to.eq(true);
  });

  it("lets the smaller crowd win when it stakes more weight", async function () {
    const ballotId = await createBallot(100);

    // Two yes voters with little weight lose to one no voter staking more.
    await castVote(signers.alice, ballotId, true, 40n);
    await castVote(signers.bob, ballotId, true, 40n);
    await castVote(signers.carol, ballotId, false, 100n);

    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    const resolved = await ballotContract.getBallot(ballotId);
    expect(resolved.yesWeight).to.eq(80n);
    expect(resolved.noWeight).to.eq(100n);
    expect(resolved.passed).to.eq(false);
  });

  it("pays the beneficiary a confidential amount when the ballot passes", async function () {
    await fundTreasury(1000n);
    const ballotId = await createBallot(100, signers.carol.address, 250n);

    await castVote(signers.alice, ballotId, true, 300n);
    await castVote(signers.bob, ballotId, true, 200n);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    await (await ballotContract.execute(ballotId)).wait();
    expect((await ballotContract.getBallot(ballotId)).executed).to.eq(true);
    expect(await decryptBalance(signers.carol)).to.eq(250n);
  });

  it("caps the payout at the treasury balance", async function () {
    await fundTreasury(100n); // treasury smaller than the payout
    const ballotId = await createBallot(100, signers.carol.address, 250n);

    await castVote(signers.alice, ballotId, true, 300n);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    await (await ballotContract.execute(ballotId)).wait();
    // Paid what the treasury held, not the full 250.
    expect(await decryptBalance(signers.carol)).to.eq(100n);
  });

  it("does not pay out when the ballot fails", async function () {
    await fundTreasury(1000n);
    const ballotId = await createBallot(100, signers.carol.address, 250n);

    await castVote(signers.alice, ballotId, false, 300n);
    await castVote(signers.bob, ballotId, false, 200n);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    await expect(ballotContract.execute(ballotId)).to.be.revertedWithCustomError(ballotContract, "BallotNotPassed");
  });

  it("cannot pay out twice", async function () {
    await fundTreasury(1000n);
    const ballotId = await createBallot(100, signers.carol.address, 250n);

    await castVote(signers.alice, ballotId, true, 300n);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    await (await ballotContract.execute(ballotId)).wait();
    await expect(ballotContract.execute(ballotId)).to.be.revertedWithCustomError(
      ballotContract,
      "PayoutAlreadyExecuted",
    );
  });

  it("cannot execute before the ballot is resolved", async function () {
    await fundTreasury(1000n);
    const ballotId = await createBallot(3600, signers.carol.address, 250n);
    await expect(ballotContract.execute(ballotId)).to.be.revertedWithCustomError(ballotContract, "BallotNotResolved");
  });

  it("returns the locked stake to the voter after the ballot resolves", async function () {
    const ballotId = await createBallot(100);

    // Alice starts with 300, votes all of it, ends the vote holding 0.
    await castVote(signers.alice, ballotId, true, 300n);
    expect(await decryptBalance(signers.alice)).to.eq(0n);

    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    // Cannot withdraw a stake that was never placed.
    await expect(ballotContract.connect(signers.bob).withdraw(ballotId)).to.be.revertedWithCustomError(
      ballotContract,
      "NothingToWithdraw",
    );

    await (await ballotContract.connect(signers.alice).withdraw(ballotId)).wait();
    expect(await decryptBalance(signers.alice)).to.eq(300n);
    expect(await ballotContract.hasWithdrawn(ballotId, signers.alice.address)).to.eq(true);

    await expect(ballotContract.connect(signers.alice).withdraw(ballotId)).to.be.revertedWithCustomError(
      ballotContract,
      "StakeAlreadyWithdrawn",
    );
  });

  it("cannot withdraw before the ballot resolves", async function () {
    const ballotId = await createBallot(3600);
    await castVote(signers.alice, ballotId, true, 100n);
    await expect(ballotContract.connect(signers.alice).withdraw(ballotId)).to.be.revertedWithCustomError(
      ballotContract,
      "BallotNotResolved",
    );
  });

  it("keeps voter stakes safe even when a payout would exceed the treasury", async function () {
    // Treasury holds 200; two voters lock 500 and 100 on top of it.
    await fundTreasury(200n);
    const ballotId = await createBallot(100, signers.carol.address, 1000n);

    await castVote(signers.alice, ballotId, true, 500n);
    await castVote(signers.bob, ballotId, true, 100n);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    // Payout is capped at the 200 treasury, not the voters' 600 of stake.
    await (await ballotContract.execute(ballotId)).wait();
    expect(await decryptBalance(signers.carol)).to.eq(200n);

    // Both voters still get their full stake back.
    await (await ballotContract.connect(signers.alice).withdraw(ballotId)).wait();
    await (await ballotContract.connect(signers.bob).withdraw(ballotId)).wait();
    expect(await decryptBalance(signers.alice)).to.eq(500n);
    expect(await decryptBalance(signers.bob)).to.eq(100n);
  });
});
