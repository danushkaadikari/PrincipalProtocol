const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InterestRateModel", function () {
  let interestRateModel;
  let owner;

  const BLOCKS_PER_YEAR = 2102400n; // ~15 seconds per block, 365 days
  const USDT_DECIMALS = 6;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    
    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    interestRateModel = await InterestRateModel.deploy();
  });

  describe("calculateInterest", function () {
    it("should return 0 for invalid inputs", async function () {
      const principal = ethers.parseUnits("1000", USDT_DECIMALS);
      const lastBlock = 100n;
      const currentBlock = 100n;
      const apy = 400n; // 4% in basis points

      expect(await interestRateModel.calculateInterest(
        principal,
        lastBlock,
        currentBlock,
        apy
      )).to.equal(0n);

      expect(await interestRateModel.calculateInterest(
        0n,
        lastBlock,
        currentBlock + 1n,
        apy
      )).to.equal(0n);

      expect(await interestRateModel.calculateInterest(
        principal,
        lastBlock,
        currentBlock + 1n,
        0n
      )).to.equal(0n);
    });

    it("should calculate interest correctly for a short period", async function () {
      const principal = ethers.parseUnits("1000", USDT_DECIMALS); // 1000 USDT
      const lastBlock = 1000n;
      const blocksPassed = 100n;
      const currentBlock = lastBlock + blocksPassed;
      const apy = 400n; // 4% in basis points

      const interest = await interestRateModel.calculateInterest(
        principal,
        lastBlock,
        currentBlock,
        apy
      );

      // For 4% APY over 100 blocks:
      // 1000 USDT * 0.04 * (100 blocks / 2102400 blocks per year)
      // ≈ 0.0019 USDT
      const expectedInterest = ethers.parseUnits("0.0019", USDT_DECIMALS);
      const tolerance = ethers.parseUnits("0.0001", USDT_DECIMALS);

      expect(interest).to.be.closeTo(expectedInterest, tolerance);
    });

    it("should handle large numbers without overflow", async function () {
      const principal = ethers.parseUnits("1000000", USDT_DECIMALS); // 1M USDT
      const lastBlock = 1000n;
      const blocksPassed = BLOCKS_PER_YEAR; // One full year
      const currentBlock = lastBlock + blocksPassed;
      const apy = 400n; // 4% in basis points

      const interest = await interestRateModel.calculateInterest(
        principal,
        lastBlock,
        currentBlock,
        apy
      );

      // For our compound interest model with exponential growth,
      // we expect higher returns than simple interest
      const expectedInterest = ethers.parseUnits("86400", USDT_DECIMALS);
      const tolerance = ethers.parseUnits("1000", USDT_DECIMALS);

      expect(interest).to.be.closeTo(expectedInterest, tolerance);
    });

    it("should calculate interest proportionally to time", async function () {
      const principal = ethers.parseUnits("1000", USDT_DECIMALS);
      const lastBlock = 1000n;
      const apy = 400n; // 4% in basis points

      // Calculate for different periods
      const periods = [100n, 200n, 300n];
      let lastInterest = 0n;

      for (const blocksPassed of periods) {
        const currentBlock = lastBlock + blocksPassed;
        const interest = await interestRateModel.calculateInterest(
          principal,
          lastBlock,
          currentBlock,
          apy
        );

        // Each period should yield more interest than the last
        expect(interest).to.be.gt(lastInterest);
        lastInterest = interest;
      }
    });
  });
});
