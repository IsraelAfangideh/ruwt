import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const USDT_DECIMALS = 6;
const usd = (n: number) => ethers.parseUnits(n.toString(), USDT_DECIMALS);
const price = usd;

describe("PalmVault", function () {
  async function deployFixture() {
    const [owner, operator, alice, bob] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockERC20.deploy();

    const Vault = await ethers.getContractFactory("PalmVault");
    const vault = await Vault.deploy(await usdt.getAddress(), operator.address);

    await usdt.mint(owner.address, usd(10_000));
    await usdt.mint(alice.address, usd(1_000));
    await usdt.mint(bob.address, usd(1_000));

    await usdt.connect(owner).approve(await vault.getAddress(), usd(10_000));
    await vault.connect(owner).seedVault(usd(2_000));

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
      expect(await vault.lastTradePrice()).to.equal(0);
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
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
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
    it("operator opens a long at trade price", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      // Ask price = oracle $4200 + 1% = $4242
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));

      const pos = await vault.getPosition(0);
      expect(pos.trader).to.equal(alice.address);
      expect(pos.margin).to.equal(usd(100));
      expect(pos.entryPrice).to.equal(price(4_242));
      expect(pos.active).to.be.true;
    });

    it("updates lastTradePrice on open", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      expect(await vault.lastTradePrice()).to.equal(price(4_242));
    });

    it("deducts margin from trader balance", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(80), price(4_242));
      expect(await vault.balances(alice.address)).to.equal(usd(20));
    });

    it("increments total open interest", async function () {
      const { vault, operator, alice, bob } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(bob).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      await vault.connect(operator).openLong(bob.address, usd(50), price(4_300));
      expect(await vault.totalOpenInterest()).to.equal(usd(150));
    });

    it("rejects position exceeding $100 max", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(200));
      await expect(
        vault.connect(operator).openLong(alice.address, usd(101), price(4_242))
      ).to.be.revertedWithCustomError(vault, "ExceedsMaxPosition");
    });

    it("rejects when OI would exceed vault balance", async function () {
      const { vault, owner, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(owner).withdrawVault(usd(1_850));
      await vault.connect(alice).deposit(usd(200));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      await expect(
        vault.connect(operator).openLong(alice.address, usd(51), price(4_242))
      ).to.be.revertedWithCustomError(vault, "OICapExceeded");
    });

    it("rejects when trader has insufficient balance", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(50));
      await expect(
        vault.connect(operator).openLong(alice.address, usd(100), price(4_242))
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("non-operator cannot open position", async function () {
      const { vault, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await expect(
        vault.connect(alice).openLong(alice.address, usd(100), price(4_242))
      ).to.be.revertedWithCustomError(vault, "NotOperator");
    });

    it("emits LongOpened event", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await expect(vault.connect(operator).openLong(alice.address, usd(100), price(4_242)))
        .to.emit(vault, "LongOpened")
        .withArgs(0, alice.address, usd(100), price(4_242));
    });
  });

  describe("Closing positions — spread-based pricing", function () {
    // Typical scenario: buy at ask ($4,242 = oracle+1%), sell at bid ($4,356 = new oracle-1%)
    // Oracle moved from $4,200 to $4,400 (+4.76%)
    // User's trade PnL: ($4,356 - $4,242) / $4,242 = +2.69%
    // The 2% spread erodes ~2% of the raw move — this is the vault's revenue

    it("profitable trade: oracle up 10%, user profits ~8% after spread", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));

      // Buy at ask (oracle $4,200 + 1%)
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      // Sell at bid (oracle $4,620 - 1% = $4,573.80)
      await vault.connect(operator).closeLong(0, price(4_573.8));

      // PnL = 100e6 * (4573.8e6 - 4242e6) / 4242e6 = 7_821_782 (~$7.82)
      // No fee — spread IS the revenue
      const aliceBal = await vault.balances(alice.address);
      expect(aliceBal).to.be.gt(usd(107.8));
      expect(aliceBal).to.be.lt(usd(107.9));
      const vaultBal = await vault.vaultBalance();
      expect(vaultBal).to.be.gt(usd(1_992.1));
      expect(vaultBal).to.be.lt(usd(1_992.2));
    });

    it("losing trade: oracle flat, user loses the spread", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));

      // Buy at ask (oracle $4,200 + 1% = $4,242)
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      // Sell at bid (oracle still $4,200 - 1% = $4,158)
      await vault.connect(operator).closeLong(0, price(4_158));

      // PnL = 100e6 * (4158e6 - 4242e6) / 4242e6 = -1_980_198 (~-$1.98)
      const aliceBal = await vault.balances(alice.address);
      expect(aliceBal).to.be.gt(usd(98.01));
      expect(aliceBal).to.be.lt(usd(98.03));
      const vaultBal = await vault.vaultBalance();
      expect(vaultBal).to.be.gt(usd(2_001.97));
      expect(vaultBal).to.be.lt(usd(2_001.99));
    });

    it("no fee deducted — payout equals margin + pnl", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));

      // Close at same price — zero PnL, full margin returned
      await vault.connect(operator).closeLong(0, price(4_242));

      expect(await vault.balances(alice.address)).to.equal(usd(100));
      expect(await vault.vaultBalance()).to.equal(usd(2_000));
    });

    it("updates lastTradePrice on close", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      await vault.connect(operator).closeLong(0, price(4_158));
      expect(await vault.lastTradePrice()).to.equal(price(4_158));
    });
  });

  describe("Closing positions — edge cases", function () {
    it("cannot close inactive position", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      await vault.connect(operator).closeLong(0, price(4_242));
      await expect(vault.connect(operator).closeLong(0, price(4_242)))
        .to.be.revertedWithCustomError(vault, "PositionNotActive");
    });

    it("non-operator cannot close position", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      await expect(vault.connect(alice).closeLong(0, price(4_242)))
        .to.be.revertedWithCustomError(vault, "NotOperator");
    });

    it("profit capped at vault balance", async function () {
      const { vault, owner, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(owner).withdrawVault(usd(1_950));
      expect(await vault.vaultBalance()).to.equal(usd(50));

      await vault.connect(alice).deposit(usd(50));
      await vault.connect(operator).openLong(alice.address, usd(50), price(4_242));
      await vault.connect(operator).closeLong(0, price(12_600));

      // Profit capped at $50 (vault balance)
      // Payout = 50 + 50 = $100
      expect(await vault.balances(alice.address)).to.equal(usd(100));
      expect(await vault.vaultBalance()).to.equal(0);
    });

    it("near-total loss at min price", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      await vault.connect(operator).closeLong(0, price(100));

      const traderBal = await vault.balances(alice.address);
      expect(traderBal).to.be.lt(usd(3));
      expect(await vault.vaultBalance()).to.be.gt(usd(2_097));
    });

    it("emits LongClosed event without fee field", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));

      // Check event is emitted (exact values have integer division rounding)
      await expect(vault.connect(operator).closeLong(0, price(4_158)))
        .to.emit(vault, "LongClosed");
      // Verify payout credited
      const bal = await vault.balances(alice.address);
      expect(bal).to.be.gt(usd(98.01));
      expect(bal).to.be.lt(usd(98.03));
    });
  });

  describe("Capacity tracking", function () {
    it("availableCapacity reflects open positions", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      expect(await vault.availableCapacity()).to.equal(usd(2_000));

      await vault.connect(alice).deposit(usd(100));
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      expect(await vault.availableCapacity()).to.equal(usd(1_900));

      await vault.connect(operator).closeLong(0, price(4_242));
      expect(await vault.availableCapacity()).to.equal(usd(2_000));
    });
  });

  describe("Multiple positions with different entry prices", function () {
    it("handles positions opened at different spread prices", async function () {
      const { vault, operator, alice, bob } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(bob).deposit(usd(100));

      // Alice buys when oracle is $4,200 → ask = $4,242
      await vault.connect(operator).openLong(alice.address, usd(100), price(4_242));
      // Bob buys when oracle is $4,300 → ask = $4,343
      await vault.connect(operator).openLong(bob.address, usd(100), price(4_343));

      expect(await vault.totalOpenInterest()).to.equal(usd(200));

      // Oracle moves to $4,400 → bid = $4,356
      await vault.connect(operator).closeLong(0, price(4_356));
      await vault.connect(operator).closeLong(1, price(4_356));

      // Alice: pnl = 100e6 * (4356e6 - 4242e6) / 4242e6 = ~$2.69
      const aliceBal = await vault.balances(alice.address);
      expect(aliceBal).to.be.gt(usd(102.68));
      expect(aliceBal).to.be.lt(usd(102.7));
      // Bob: pnl = 100e6 * (4356e6 - 4343e6) / 4343e6 = ~$0.30 (entered higher, less profit)
      const bobBal = await vault.balances(bob.address);
      expect(bobBal).to.be.gt(usd(100.29));
      expect(bobBal).to.be.lt(usd(100.31));

      expect(await vault.totalOpenInterest()).to.equal(0);
      expect(await vault.lastTradePrice()).to.equal(price(4_356));
    });
  });

  describe("lastTradePrice tracking", function () {
    it("tracks the most recent trade", async function () {
      const { vault, operator, alice, bob } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await vault.connect(bob).deposit(usd(100));

      expect(await vault.lastTradePrice()).to.equal(0);

      await vault.connect(operator).openLong(alice.address, usd(50), price(4_242));
      expect(await vault.lastTradePrice()).to.equal(price(4_242));

      await vault.connect(operator).openLong(bob.address, usd(50), price(4_343));
      expect(await vault.lastTradePrice()).to.equal(price(4_343));

      await vault.connect(operator).closeLong(0, price(4_158));
      expect(await vault.lastTradePrice()).to.equal(price(4_158));
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
    it("rejects trade price below minimum", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await expect(
        vault.connect(operator).openLong(alice.address, usd(100), price(99))
      ).to.be.revertedWithCustomError(vault, "InvalidPrice");
    });

    it("rejects trade price above maximum", async function () {
      const { vault, operator, alice } = await loadFixture(deployFixture);
      await vault.connect(alice).deposit(usd(100));
      await expect(
        vault.connect(operator).openLong(alice.address, usd(100), price(100_001))
      ).to.be.revertedWithCustomError(vault, "InvalidPrice");
    });
  });
});
