import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const usdtAddress = process.env.USDT_ADDRESS;
  const operatorAddress = process.env.OPERATOR_ADDRESS;

  if (!usdtAddress || !operatorAddress) {
    throw new Error("Set USDT_ADDRESS and OPERATOR_ADDRESS env vars");
  }

  const Vault = await ethers.getContractFactory("PalmVault");
  const vault = await Vault.deploy(usdtAddress, operatorAddress);
  await vault.waitForDeployment();

  console.log("PalmVault deployed to:", await vault.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
