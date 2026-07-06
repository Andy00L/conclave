import { ethers, network } from "hardhat";

/// Deploy the confidential governance token and the ballot wired to it.
/// Usage: hardhat run scripts/deploy.ts --network sepolia
async function main() {
  const [deployer] = await ethers.getSigners();

  const tokenFactory = await ethers.getContractFactory("ConfidentialGovToken");
  // The deployer is the initial owner (the only minter). On a real deployment
  // ownership would move to the DAO or its multisig.
  const token = await tokenFactory.deploy("Conclave Gov", "cGOV", "", deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const ballotFactory = await ethers.getContractFactory("ConfidentialBallot");
  const ballot = await ballotFactory.deploy(tokenAddress);
  await ballot.waitForDeployment();
  const ballotAddress = await ballot.getAddress();

  console.log(`[deploy] network: ${network.name}`);
  console.log(`[deploy] ConfidentialGovToken: ${tokenAddress}`);
  console.log(`[deploy] ConfidentialBallot:   ${ballotAddress}`);
}

main().catch((error) => {
  console.error("[deploy] failed:", error);
  process.exitCode = 1;
});
