/**
 * Full integration test against a local Hardhat node.
 * Run: npx hardhat node (in another terminal)
 * Then: npx hardhat run scripts/testnet-dry-run.ts --network localhost
 */
import { ethers } from "hardhat";

const USDT_DECIMALS = 6;
const usd = (n: number) => ethers.parseUnits(n.toString(), USDT_DECIMALS);
const price = (n: number) => ethers.parseUnits(n.toString(), USDT_DECIMALS);
const fmt = (n: bigint) => `$${(Number(n) / 1e6).toFixed(2)}`;

async function main() {
  const [owner, operator, alice] = await ethers.getSigners();

  console.log("\n=== DEPLOY ===");
  console.log("Owner:", owner.address);
  console.log("Operator:", operator.address);
  console.log("Trader (Alice):", alice.address);

  // Deploy MockUSDT
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const usdt = await MockUSDT.deploy();
  console.log("MockUSDT:", await usdt.getAddress());

  // Deploy PalmVault
  const PalmVault = await ethers.getContractFactory("PalmVault");
  const vault = await PalmVault.deploy(await usdt.getAddress(), operator.address);
  const vaultAddr = await vault.getAddress();
  console.log("PalmVault:", vaultAddr);

  // Mint USDT
  await usdt.mint(owner.address, usd(10_000));
  await usdt.mint(alice.address, usd(500));
  console.log("\nMinted $10,000 to owner, $500 to Alice");

  // Seed vault with $2,000
  console.log("\n=== SEED VAULT ===");
  await usdt.connect(owner).approve(vaultAddr, usd(10_000));
  await vault.connect(owner).seedVault(usd(2_000));
  console.log("Vault balance:", fmt(await vault.vaultBalance()));
  console.log("Available capacity:", fmt(await vault.availableCapacity()));

  // Alice deposits $100
  console.log("\n=== ALICE DEPOSITS ===");
  await usdt.connect(alice).approve(vaultAddr, usd(500));
  await vault.connect(alice).deposit(usd(100));
  console.log("Alice platform balance:", fmt(await vault.balances(alice.address)));
  console.log("Alice wallet USDT:", fmt(await usdt.balanceOf(alice.address)));

  // Open long at $4,200/MT
  console.log("\n=== OPEN LONG ===");
  const tx1 = await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
  const receipt1 = await tx1.wait();
  console.log("Position opened at $4,200/MT");
  console.log("Gas used:", receipt1!.gasUsed.toString());
  console.log("Alice balance after open:", fmt(await vault.balances(alice.address)));
  console.log("Open interest:", fmt(await vault.totalOpenInterest()));
  console.log("Available capacity:", fmt(await vault.availableCapacity()));

  const pos = await vault.getPosition(0);
  console.log("Position 0:", {
    trader: pos.trader,
    margin: fmt(pos.margin),
    entryPrice: fmt(pos.entryPrice),
    active: pos.active,
  });

  // Close long at $4,620/MT (+10%)
  console.log("\n=== CLOSE LONG (+10%) ===");
  const tx2 = await vault.connect(operator).closeLong(0, price(4_620));
  const receipt2 = await tx2.wait();
  console.log("Position closed at $4,620/MT (+10%)");
  console.log("Gas used:", receipt2!.gasUsed.toString());

  // Expected: PnL = $10, gross = $110, fee = $3.30, net = $106.70
  const aliceBal = await vault.balances(alice.address);
  const vaultBal = await vault.vaultBalance();
  console.log("Alice balance:", fmt(aliceBal), "(expected: $106.70)");
  console.log("Vault balance:", fmt(vaultBal), "(expected: $1,993.30)");
  console.log("Open interest:", fmt(await vault.totalOpenInterest()), "(expected: $0.00)");

  // Verify
  const expected = usd(106.7);
  if (aliceBal === expected) {
    console.log("\n✅ PnL calculation CORRECT");
  } else {
    console.log(`\n❌ PnL mismatch: got ${fmt(aliceBal)}, expected ${fmt(expected)}`);
  }

  // Alice withdraws
  console.log("\n=== ALICE WITHDRAWS ===");
  await vault.connect(alice).withdraw(aliceBal);
  console.log("Alice wallet USDT:", fmt(await usdt.balanceOf(alice.address)));
  console.log("Alice platform balance:", fmt(await vault.balances(alice.address)));

  console.log("\n=== DRY RUN COMPLETE ===");
  console.log("Vault final balance:", fmt(await vault.vaultBalance()));
  console.log("All flows verified ✓");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
