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

async function deployFixture() {
  const tokenFactory = (await ethers.getContractFactory("ConfidentialGovToken")) as ConfidentialGovToken__factory;
  const token = (await tokenFactory.deploy("Conclave Gov", "cGOV", "")) as ConfidentialGovToken;
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
    ({ token, tokenAddress, ballotContract, ballotAddress } = await deployFixture());
  });

  async function fundTreasury(amount = 1000n) {
    const encrypted = await fhevm.createEncryptedInput(tokenAddress, signers.deployer.address).add64(amount).encrypt();
    await (await token.connect(signers.deployer).mint(ballotAddress, encrypted.handles[0], encrypted.inputProof)).wait();
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

  async function castVote(voter: HardhatEthersSigner, ballotId: bigint, support: boolean) {
    const encrypted = await fhevm.createEncryptedInput(ballotAddress, voter.address).addBool(support).encrypt();
    await (await ballotContract.connect(voter).vote(ballotId, encrypted.handles[0], encrypted.inputProof)).wait();
  }

  async function closeAndResolve(ballotId: bigint) {
    await (await ballotContract.closeBallot(ballotId)).wait();
    const [encryptedYes, encryptedNo] = await ballotContract.getEncryptedTallies(ballotId);
    const publicDecryption = await fhevm.publicDecrypt([encryptedYes, encryptedNo]);
    await (
      await ballotContract.resolve(ballotId, publicDecryption.abiEncodedClearValues, publicDecryption.decryptionProof)
    ).wait();
  }

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
    await castVote(signers.alice, ballotId, true);

    expect(await ballotContract.hasVoted(ballotId, signers.alice.address)).to.eq(true);
    expect(await ballotContract.hasVoted(ballotId, signers.bob.address)).to.eq(false);

    const [encryptedYes, encryptedNo] = await ballotContract.getEncryptedTallies(ballotId);
    expect(encryptedYes).to.not.eq(ethers.ZeroHash);
    expect(encryptedNo).to.not.eq(ethers.ZeroHash);
  });

  it("blocks a second vote from the same address", async function () {
    const ballotId = await createBallot();
    await castVote(signers.alice, ballotId, true);

    const secondVote = await fhevm.createEncryptedInput(ballotAddress, signers.alice.address).addBool(false).encrypt();
    await expect(
      ballotContract.connect(signers.alice).vote(ballotId, secondVote.handles[0], secondVote.inputProof),
    ).to.be.revertedWithCustomError(ballotContract, "AlreadyVoted");
  });

  it("rejects votes cast after the voting period", async function () {
    const ballotId = await createBallot(100);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);

    const lateVote = await fhevm.createEncryptedInput(ballotAddress, signers.alice.address).addBool(true).encrypt();
    await expect(
      ballotContract.connect(signers.alice).vote(ballotId, lateVote.handles[0], lateVote.inputProof),
    ).to.be.revertedWithCustomError(ballotContract, "VotingPeriodOver");
  });

  it("cannot be closed before the voting period ends", async function () {
    const ballotId = await createBallot(3600);
    await expect(ballotContract.closeBallot(ballotId)).to.be.revertedWithCustomError(
      ballotContract,
      "VotingPeriodNotOver",
    );
  });

  it("tallies encrypted votes and reveals only the aggregate result", async function () {
    const ballotId = await createBallot(100);

    await castVote(signers.alice, ballotId, true);
    await castVote(signers.bob, ballotId, true);
    await castVote(signers.carol, ballotId, false);

    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    const resolved = await ballotContract.getBallot(ballotId);
    expect(resolved.state).to.eq(BallotState.Resolved);
    expect(resolved.yesVotes).to.eq(2n);
    expect(resolved.noVotes).to.eq(1n);
    expect(resolved.passed).to.eq(true);
  });

  it("pays the beneficiary a confidential amount when the ballot passes", async function () {
    await fundTreasury(1000n);
    const ballotId = await createBallot(100, signers.carol.address, 250n);

    await castVote(signers.alice, ballotId, true);
    await castVote(signers.bob, ballotId, true);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    await (await ballotContract.execute(ballotId)).wait();
    expect((await ballotContract.getBallot(ballotId)).executed).to.eq(true);

    // The beneficiary can decrypt only their own balance, which grew by the payout.
    const beneficiaryBalance = await token.confidentialBalanceOf(signers.carol.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      beneficiaryBalance,
      tokenAddress,
      signers.carol,
    );
    expect(clearBalance).to.eq(250n);
  });

  it("does not pay out when the ballot fails", async function () {
    await fundTreasury(1000n);
    const ballotId = await createBallot(100, signers.carol.address, 250n);

    await castVote(signers.alice, ballotId, false);
    await castVote(signers.bob, ballotId, false);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await closeAndResolve(ballotId);

    await expect(ballotContract.execute(ballotId)).to.be.revertedWithCustomError(ballotContract, "BallotNotPassed");
  });

  it("cannot pay out twice", async function () {
    await fundTreasury(1000n);
    const ballotId = await createBallot(100, signers.carol.address, 250n);

    await castVote(signers.alice, ballotId, true);
    await castVote(signers.bob, ballotId, true);
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
});
