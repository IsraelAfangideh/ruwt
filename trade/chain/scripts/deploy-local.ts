/**
 * Deploy to local Hardhat node and seed with test data.
 * Prints env vars needed for the API.
 *
 * Usage:
 *   npx hardhat node                                          # terminal 1
 *   npx hardhat run scripts/deploy-local.ts --network localhost  # terminal 2
 */
import { ethers } from "hardhat";

const USDT_DECIMALS = 6;
const usd = (n: number) => ethers.parseUnits(n.toString(), USDT_DECIMALS);

async function main() {
  const [owner, operator, alice] = await ethers.getSigners();

  // Deploy
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const usdt = await MockUSDT.deploy();
  const usdtAddr = await usdt.getAddress();

  const PalmVault = await ethers.getContractFactory("PalmVault");
  const vault = await PalmVault.deploy(usdtAddr, operator.address);
  const vaultAddr = await vault.getAddress();

  // Seed vault
  await usdt.mint(owner.address, usd(10_000));
  await usdt.connect(owner).approve(vaultAddr, usd(10_000));
  await vault.connect(owner).seedVault(usd(2_000));

  // Give Alice (demo trader) $500 and deposit $200
  await usdt.mint(alice.address, usd(500));
  await usdt.connect(alice).approve(vaultAddr, usd(500));
  await vault.connect(alice).deposit(usd(200));

  console.log("=== Local deployment complete ===");
  console.log(`MockUSDT:  ${usdtAddr}`);
  console.log(`PalmVault: ${vaultAddr}`);
  console.log(`Owner:     ${owner.address}`);
  console.log(`Operator:  ${operator.address}`);
  console.log(`Alice:     ${alice.address} (balance: $200)`);
  console.log("");
  console.log("=== Copy these env vars to start the API ===");
  console.log(`VAULT_ADDRESS=${vaultAddr}`);
  console.log(`OPERATOR_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`);
  console.log(`POLYGON_RPC=http://127.0.0.1:8545`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
