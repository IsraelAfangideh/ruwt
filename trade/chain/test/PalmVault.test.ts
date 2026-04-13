import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Mock ERC-20 with 6 decimals (USDT)
const USDT_DECIMALS = 6;
const usd = (n: number) => ethers.parseUnits(n.toString(), USDT_DECIMALS);
// Price: USD per MT, 6 decimal precision. $4,200 = 4_200_000_000
const price = usd;

describe("PalmVault", function () {
  async function deployFixture() {
    const [owner, operator, alice, bob] = await ethers.getSigners();

    // Deploy mock USDT
    const MockERC20 = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockERC20.deploy();

    // Deploy vault
    const Vault = await ethers.getContractFactory("PalmVault");
    const vault = await Vault.deploy(await usdt.getAddress(), operator.address);

    // Mint USDT to participants
    await usdt.mint(owner.address, usd(10_000));
    await usdt.mint(alice.address, usd(1_000));
    await usdt.mint(bob.address, usd(1_000));

    // Owner seeds vault with $2,000
    await usdt.connect(owner).approve(await vault.getAddress(), usd(10_000));
    await vault.connect(owner).seedVault(usd(2_000));

    // Alice and Bob approve vault
    const vaultAddr = await vault.getAddress();
    await usdt.connect(alice).approve(vaultAddr, usd(1_000));
    await usdt.connect(bob).approve(vaultAddr, usd(1_000));

    return { vault, usdt, owner, operator, alice, bob };
  }

  describe("Deployment", function () {
    it("initializes with correct state", async function () {
      const { vault, operator } = await loadFixture(deployFixture);
      expect(await vault.vaultBalance()).to.equal(usd(2_000));
      expect(await vault.totalOpenInterest()).to.equal(0);
      expect(await vault.operator()).to.equal(operator.address);
    });
  });

  describe("Vault seeding", function () {
    it("owner can seed vault", async function () {
      const { vault, owner } = await loadFixture(deployFixture);
      await vault.connect(owner).seedVault(usd(500));
      expect(await vault.vaultBalance()).to.equal(usd(2_500));
    });

    it("non-owner cannot seed vault", async function () {
      const { vault, alice, usdt: token } = await loadFixture(deployFixture);
      await token.connect(alice).approve(await vault.getAddress(), usd(100));
      await expect(vault.connect(alice).seedVault(usd(100)))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("owner can withdraw excess vault funds", async function () {
      const { vault, owner } = await loadFixture(deployFixture);
      await vault.connect(owner).withdrawVault(usd(500));
      expect(await vault.vaultBalance()).to.equal(usd(1_500));
    });

    it("owner cannot withdraw below open interest", async function () {
      const { vault, owner, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
      // OI is $100, vault is $2000, available = $1900
      await expect(vault.connect(owner).withdrawVault(usd(1_950)))
        .to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });
  });

  describe("User deposits & withdrawals", function () {
    it("user deposits USDT", async function () {
      const { vault, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      expect(await vault.balances(alice.address)).to.equal(usd(100));
    });

    it("user withdraws USDT", async function () {
      const { vault, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(alice).withdraw(usd(60));
      expect(await vault.balances(alice.address)).to.equal(usd(40));
    });

    it("rejects withdrawal exceeding balance", async function () {
      const { vault, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await expect(vault.connect(alice).withdraw(usd(101)))
        .to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("rejects zero deposit", async function () {
      const { vault, alice } = await loadFixture(deployFixture);
      await expect(vault.connect(alice).deposit(0))
        .to.be.revertedWithCustomError(vault, "InvalidAmount");
    });
  });

  describe("Opening positions", function () {
    it("operator opens a long for trader", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));

      const pos = await vault.getPosition(0);
      expect(pos.trader).to.equal(alice.address);
      expect(pos.margin).to.equal(usd(100));
      expect(pos.entryPrice).to.equal(price(4_200));
      expect(pos.active).to.be.true;
    });

    it("deducts margin from trader balance", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(80), price(4_200));
      expect(await vault.balances(alice.address)).to.equal(usd(20));
    });

    it("increments total open interest", async function () {
      const { vault, operator, alice, bob } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(bob).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
      await vault.connect(operator).openLong(bob.address, usd(50), price(4_300));
      expect(await vault.totalOpenInterest()).to.equal(usd(150));
    });

    it("rejects position exceeding $100 max", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(200));
      await expect(
        vault.connect(operator).openLong(alice.address, usd(101), price(4_200))
      ).to.be.revertedWithCustomError(vault, "ExceedsMaxPosition");
    });

    it("rejects when OI would exceed vault balance", async function () {
      const { vault, owner, operator, alice } = await loadFixture(deployFixture);
      // Withdraw vault down to $150 so we hit OI cap quickly
      await vault.connect(owner).withdrawVault(usd(1_850));
      expect(await vault.vaultBalance()).to.equal(usd(150));

      await vault.connect(alice).deposit(usd(200));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
      // OI = $100, vault = $150, capacity = $50

      await expect(
        vault.connect(operator).openLong(alice.address, usd(51), price(4_200))
      ).to.be.revertedWithCustomError(vault, "OICapExceeded");
    });

    it("rejects when trader has insufficient balance", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(50));
      await expect(
        vault.connect(operator).openLong(alice.address, usd(100), price(4_200))
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("non-operator cannot open position", async function () {
      const { vault, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await expect(
        vault.connect(alice).openLong(alice.address, usd(100), price(4_200))
      ).to.be.revertedWithCustomError(vault, "NotOperator");
    });

    it("emits LongOpened event", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await expect(vault.connect(operator).openLong(alice.address, usd(100), price(4_200)))
        .to.emit(vault, "LongOpened")
        .withArgs(0, alice.address, usd(100), price(4_200));
    });
  });

  describe("Closing positions — profitable", function () {
    it("palm oil +10%: trader profits, vault pays", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));

      // Palm oil goes up 10%: $4,200 → $4,620
      await vault.connect(operator).closeLong(0, price(4_620));

      // PnL = 100 * (4620 - 4200) / 4200 = 100 * 420 / 4200 = $10
      // Gross payout = $110
      // Fee = $110 * 3% = $3.30
      // Net payout = $106.70
      const pos = await vault.getPosition(0);
      expect(pos.active).to.be.false;

      expect(await vault.balances(alice.address)).to.equal(usd(106.7));
      // Vault lost $10 profit but gained $3.30 fee = net -$6.70
      expect(await vault.vaultBalance()).to.equal(usd(1_993.3));
      expect(await vault.totalOpenInterest()).to.equal(0);
    });

    it("palm oil +50%: big profit", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));

      await vault.connect(operator).closeLong(0, price(6_300)); // +50%

      // PnL = 100 * 2100 / 4200 = $50
      // Gross = $150, fee = $4.50, net = $145.50
      expect(await vault.balances(alice.address)).to.equal(usd(145.5));
      expect(await vault.vaultBalance()).to.equal(usd(1_954.5));
    });
  });

  describe("Closing positions — losing", function () {
    it("palm oil -10%: trader loses, vault gains", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));

      // Palm oil drops 10%: $4,200 → $3,780
      await vault.connect(operator).closeLong(0, price(3_780));

      // PnL = 100 * (3780 - 4200) / 4200 = 100 * (-420) / 4200 = -$10
      // Gross payout = $90
      // Fee = $90 * 3% = $2.70
      // Net payout = $87.30
      expect(await vault.balances(alice.address)).to.equal(usd(87.3));
      // Vault gained $10 loss + $2.70 fee = +$12.70
      expect(await vault.vaultBalance()).to.equal(usd(2_012.7));
    });

    it("palm oil drops to minimum: near-total wipeout", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));

      // Palm oil drops to MIN_PRICE ($100/MT) — 97.6% loss
      await vault.connect(operator).closeLong(0, price(100));

      // pnl = 100 * (100 - 4200) / 4200 ≈ -$97.62
      const traderBal = await vault.balances(alice.address);
      expect(traderBal).to.be.lt(usd(3)); // less than $3 back
      expect(await vault.vaultBalance()).to.be.gt(usd(2_097));
    });
  });

  describe("Closing positions — flat", function () {
    it("price unchanged: trader pays fee only", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
      await vault.connect(operator).closeLong(0, price(4_200));

      // PnL = 0, gross = $100, fee = $3, net = $97
      expect(await vault.balances(alice.address)).to.equal(usd(97));
      expect(await vault.vaultBalance()).to.equal(usd(2_003));
    });
  });

  describe("Closing positions — edge cases", function () {
    it("cannot close inactive position", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
      await vault.connect(operator).closeLong(0, price(4_200));
      await expect(vault.connect(operator).closeLong(0, price(4_200)))
        .to.be.revertedWithCustomError(vault, "PositionNotActive");
    });

    it("non-operator cannot close position", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
      await expect(vault.connect(alice).closeLong(0, price(4_200)))
        .to.be.revertedWithCustomError(vault, "NotOperator");
    });

    it("profit capped at vault balance", async function () {
      const { vault, usdt: token, owner, operator, alice } = await loadFixture(deployFixture);
      // Drain vault to $50 by withdrawing
      await vault.connect(owner).withdrawVault(usd(1_950));
      expect(await vault.vaultBalance()).to.equal(usd(50));

      await vault.connect(alice).deposit(usd(50));
      await vault.connect(operator).openLong(alice.address, usd(50), price(4_200));

      // Palm oil triples — $50 profit but vault only has $50
      await vault.connect(operator).closeLong(0, price(12_600));

      // Profit capped at $50 (vault balance)
      // Gross = 50 + 50 = $100, fee = $3, net = $97
      expect(await vault.balances(alice.address)).to.equal(usd(97));
      expect(await vault.vaultBalance()).to.equal(usd(3));
    });

    it("emits LongClosed event with correct values", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));

      await expect(vault.connect(operator).closeLong(0, price(4_620)))
        .to.emit(vault, "LongClosed")
        .withArgs(0, alice.address, price(4_620), usd(10), usd(3.3), usd(106.7));
    });
  });

  describe("Capacity tracking", function () {
    it("availableCapacity reflects open positions", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      expect(await vault.availableCapacity()).to.equal(usd(2_000));

      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
      expect(await vault.availableCapacity()).to.equal(usd(1_900));

      await vault.connect(operator).closeLong(0, price(4_200));
      // Vault gained $3 fee, capacity = $2003
      expect(await vault.availableCapacity()).to.equal(usd(2_003));
    });
  });

  describe("Multiple positions", function () {
    it("handles multiple concurrent positions", async function () {
      const { vault, operator, alice, bob } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(bob).deposit(usd(100));

      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
      await vault.connect(operator).openLong(bob.address, usd(100), price(4_300));

      expect(await vault.totalOpenInterest()).to.equal(usd(200));

      // Alice exits at +5%, Bob exits at -5%
      await vault.connect(operator).closeLong(0, price(4_410));
      await vault.connect(operator).closeLong(1, price(4_085));

      // Alice: pnl = 100 * 210/4200 = $5, gross=105, fee=3.15, net=101.85
      expect(await vault.balances(alice.address)).to.equal(usd(101.85));

      // Bob: pnl = 100 * (4085-4300)/4300 = 100 * (-215)/4300 = -$5
      // gross=95, fee=2.85, net=92.15
      expect(await vault.balances(bob.address)).to.equal(usd(92.15));

      expect(await vault.totalOpenInterest()).to.equal(0);
    });
  });

  describe("Operator management", function () {
    it("owner can change operator", async function () {
      const { vault, owner, alice } = await loadFixture(deployFixture);
      await vault.connect(owner).setOperator(alice.address);
      expect(await vault.operator()).to.equal(alice.address);
    });

    it("rejects zero-address operator", async function () {
      const { vault, owner } = await loadFixture(deployFixture);
      await expect(vault.connect(owner).setOperator(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
  });

  describe("Zero-address constructor checks", function () {
    it("rejects zero-address USDT", async function () {
      const [, operator] = await ethers.getSigners();
      const Vault = await ethers.getContractFactory("PalmVault");
      await expect(Vault.deploy(ethers.ZeroAddress, operator.address))
        .to.be.revertedWithCustomError(Vault, "ZeroAddress");
    });

    it("rejects zero-address operator", async function () {
      const MockERC20 = await ethers.getContractFactory("MockUSDT");
      const usdt = await MockERC20.deploy();
      const Vault = await ethers.getContractFactory("PalmVault");
      await expect(Vault.deploy(await usdt.getAddress(), ethers.ZeroAddress))
        .to.be.revertedWithCustomError(Vault, "ZeroAddress");
    });
  });

  describe("Price bounds validation", function () {
    it("rejects entry price below minimum ($100)", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await expect(
        vault.connect(operator).openLong(alice.address, usd(100), price(99))
      ).to.be.revertedWithCustomError(vault, "InvalidPrice");
    });

    it("rejects entry price above maximum ($100,000)", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await expect(
        vault.connect(operator).openLong(alice.address, usd(100), price(100_001))
      ).to.be.revertedWithCustomError(vault, "InvalidPrice");
    });

    it("rejects exit price below minimum", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_200));
      await expect(vault.connect(operator).closeLong(0, price(99)))
        .to.be.revertedWithCustomError(vault, "InvalidPrice");
    });
  });
});
