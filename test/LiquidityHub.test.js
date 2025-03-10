const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquidityHub", function () {
  let liquidityHub;
  let interestRateModel;
  let usdt;
  let nft;
  let owner;
  let lender;
  let borrower;
  let treasury;
  let admin;

  const USDT_DECIMALS = 6;

  beforeEach(async function () {
    [owner, lender, borrower, treasury] = await ethers.getSigners();

    // Deploy mock USDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDT.deploy();
    await usdt.waitForDeployment();

    // Deploy mock NFT
    const MockNFT = await ethers.getContractFactory("MockNFT");
    nft = await MockNFT.deploy();
    await nft.waitForDeployment();

    // Deploy InterestRateModel
    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    interestRateModel = await InterestRateModel.deploy();
    await interestRateModel.waitForDeployment();

    // Deploy LiquidityHubAdmin
    const LiquidityHubAdmin = await ethers.getContractFactory("LiquidityHubAdmin");
    admin = await LiquidityHubAdmin.deploy(interestRateModel.target);
    await admin.waitForDeployment();

    // Transfer ownership to owner (making them admin)
    await admin.transferOwnership(owner.address);

    // Deploy LiquidityHub
    const LiquidityHub = await ethers.getContractFactory("LiquidityHub");
    
    // Log addresses before deployment
    console.log('Deployment addresses:', {
      admin: admin.target,
      usdt: usdt.target,
      interestRateModel: interestRateModel.target,
      treasury: treasury.address
    });
    
    liquidityHub = await LiquidityHub.deploy(
      admin.target,
      usdt.target,
      interestRateModel.target,
      treasury.address
    );
    await liquidityHub.waitForDeployment();

    // Configure admin contract
    await admin.setBorrowingLimit(4000); // 40% in basis points
    await admin.setDefaultThreshold(5000); // 50% in basis points
    await admin.setTreasuryWallet(treasury.address);

    // Setup initial balances
    await usdt.mint(lender.address, ethers.parseUnits("10000", USDT_DECIMALS));
    await usdt.mint(borrower.address, ethers.parseUnits("10000", USDT_DECIMALS));
    await usdt.connect(lender).approve(liquidityHub.target, ethers.MaxUint256);
    await usdt.connect(borrower).approve(liquidityHub.target, ethers.MaxUint256);
  });

  describe("Lending Operations", function () {
    it("should allow deposits and track interest correctly", async function () {
      const depositAmount = ethers.parseUnits("1000", USDT_DECIMALS);
      
      // Make deposit
      await liquidityHub.connect(lender).deposit(depositAmount);
      
      // Verify deposit
      const position = await liquidityHub.getLenderPosition(lender.address);
      expect(position.amount).to.equal(depositAmount); // amount
      expect(position.lastUpdateBlock).to.equal(await ethers.provider.getBlockNumber()); // lastUpdateBlock
      expect(position.accumulatedInterest).to.equal(0n); // accumulatedInterest

      // Mine some blocks
      await network.provider.send("hardhat_mine", ["0x2"]); // Mine 2 blocks
      
      // Check earned interest
      const earnedInterest = await liquidityHub.getCurrentEarnedInterest(lender.address);
      expect(earnedInterest).to.be.gt(0n);
    });

    it("should allow harvesting interest", async function () {
      const depositAmount = ethers.parseUnits("1000", USDT_DECIMALS);
      
      // Make deposit
      await liquidityHub.connect(lender).deposit(depositAmount);
      
      // Mine 100 blocks
      await network.provider.send("hardhat_mine", ["0x64"]); // 0x64 = 100 in hex
      
      // Get initial USDT balance
      const initialBalance = await usdt.balanceOf(lender.address);
      
      // Harvest interest
      await liquidityHub.connect(lender).harvestInterest();
      
      // Check that interest was received
      const finalBalance = await usdt.balanceOf(lender.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should calculate interest consistently between view and harvest", async function () {
      const depositAmount = ethers.parseUnits("1000", USDT_DECIMALS);
      
      // Make deposit
      await liquidityHub.connect(lender).deposit(depositAmount);
      const depositBlock = await ethers.provider.getBlockNumber();
      
      // Mine 100 blocks
      await network.provider.send("hardhat_mine", ["0x64"]); // 0x64 = 100 in hex
      
      // Get initial USDT balance and block number
      const initialBalance = await usdt.balanceOf(lender.address);
      const currentBlock = await ethers.provider.getBlockNumber();
      
      // Calculate expected interest up to the harvest block (current block + 1)
      // This is what _harvestInterest will calculate
      const lendingAPY = await liquidityHub.lendingAPY();
      const expectedInterest = await interestRateModel.calculateInterest(
        depositAmount,
        depositBlock,
        currentBlock + 1, // Add 1 to account for the harvest transaction
        lendingAPY
      );
      
      // Harvest interest
      await liquidityHub.connect(lender).harvestInterest();
      
      // Check that received interest matches expected
      const finalBalance = await usdt.balanceOf(lender.address);
      const actualInterest = BigInt(finalBalance) - BigInt(initialBalance);
      
      // The actual interest should match exactly since we accounted for the harvest block
      expect(actualInterest).to.equal(expectedInterest);
    });
  });

  describe("Borrowing Operations", function () {
    const NFT_PRICE = ethers.parseUnits("100", USDT_DECIMALS); // 100 USDT per NFT
    const INITIAL_DEPOSIT = ethers.parseUnits("1000", USDT_DECIMALS); // 1000 USDT

    beforeEach(async function () {
      // Mint NFTs to borrower
      await nft.mint(borrower.address);
      await nft.mint(borrower.address);
      await nft.connect(borrower).setApprovalForAll(liquidityHub.target, true);

      // Set NFT price
      await nft.setCollectionInfo(
        NFT_PRICE, // pricePerNFT
        100n,      // maxSupply
        2n,        // currentSupply
        "test",   // projectURI
        false,     // paused
        0n         // balance
      );

      // Add initial liquidity
      await liquidityHub.connect(lender).deposit(INITIAL_DEPOSIT);
    });

    it("should allow locking NFT collateral", async function () {
      const tokenIds = [0, 1];
      await liquidityHub.connect(borrower).lockNFTCollateral(tokenIds, nft.target);

      // Verify NFTs are locked
      const position = await liquidityHub.getBorrowerPosition(borrower.address);
      expect(position.collateralNFTs).to.deep.equal(tokenIds);
      expect(position.totalCollateralValue).to.equal(NFT_PRICE * 2n);

      // Verify NFT ownership transferred
      for (const tokenId of tokenIds) {
        expect(await nft.ownerOf(tokenId)).to.equal(liquidityHub.target);
      }
    });

    it("should allow borrowing up to the limit", async function () {
      // Lock collateral
      const tokenIds = [0, 1];
      await liquidityHub.connect(borrower).lockNFTCollateral(tokenIds, nft.target);

      // Calculate max borrow (40% of collateral)
      const maxBorrow = (NFT_PRICE * 2n * 4000n) / 10000n; // 40% of 200 USDT = 80 USDT
      
      // Get initial balance
      const initialBalance = await usdt.balanceOf(borrower.address);

      // Borrow maximum amount
      await liquidityHub.connect(borrower).borrow(maxBorrow);

      // Verify borrowed amount
      const position = await liquidityHub.getBorrowerPosition(borrower.address);
      expect(position.borrowedAmount).to.equal(maxBorrow);

      // Verify USDT received
      const finalBalance = await usdt.balanceOf(borrower.address);
      expect(finalBalance - initialBalance).to.equal(maxBorrow);
    });

    it("should prevent borrowing above the limit", async function () {
      // Lock collateral
      const tokenIds = [0, 1];
      await liquidityHub.connect(borrower).lockNFTCollateral(tokenIds, nft.target);

      // Try to borrow more than allowed (41% of collateral)
      const maxBorrow = (NFT_PRICE * 2n * 4000n) / 10000n; // 40% of 200 USDT = 80 USDT
      const tooMuch = maxBorrow + 1n; // Exceed by 1 wei
      await expect(
        liquidityHub.connect(borrower).borrow(tooMuch)
      ).to.be.revertedWith("Exceeds borrowing limit");
    });

    it("should allow repaying the loan", async function () {
      // Lock collateral and borrow
      const tokenIds = [0, 1];
      await liquidityHub.connect(borrower).lockNFTCollateral(tokenIds, nft.target);
      
      const borrowAmount = (NFT_PRICE * 2n * 4000n) / 10000n; // 40% of collateral
      await liquidityHub.connect(borrower).borrow(borrowAmount);

      // Mine some blocks to accumulate interest
      await network.provider.send("hardhat_mine", ["0x64"]); // 100 blocks

      // Get total owed (borrowed + interest)
      const position = await liquidityHub.getBorrowerPosition(borrower.address);
      const borrowingAPY = await liquidityHub.borrowingAPY();
      const currentBlock = await ethers.provider.getBlockNumber();
      const interest = await interestRateModel.calculateInterest(
        borrowAmount,
        position.lastUpdateBlock,
        currentBlock + 1, // Add 1 to account for the repay transaction
        borrowingAPY
      );
      const totalOwed = borrowAmount + interest;

      // Repay loan
      await liquidityHub.connect(borrower).repay(totalOwed);

      // Verify loan is fully repaid
      const finalPosition = await liquidityHub.getBorrowerPosition(borrower.address);
      expect(finalPosition.borrowedAmount).to.equal(0n);
    });

    it("should allow unlocking collateral after repayment", async function () {
      // Lock collateral and borrow
      const tokenIds = [0, 1];
      await liquidityHub.connect(borrower).lockNFTCollateral(tokenIds, nft.target);
      
      const borrowAmount = (NFT_PRICE * 2n * 4000n) / 10000n; // 40% of collateral
      await liquidityHub.connect(borrower).borrow(borrowAmount);

      // Mine some blocks to accumulate interest
      await network.provider.send("hardhat_mine", ["0x64"]); // 100 blocks

      // Get total owed directly from the contract
      const totalOwed = await liquidityHub.getTotalOwed(borrower.address);
      
      // Repay the exact amount owed
      await usdt.connect(borrower).approve(liquidityHub.target, totalOwed);
      await liquidityHub.connect(borrower).repay(totalOwed);
      
      // Verify loan is fully repaid
      const afterRepay = await liquidityHub.getBorrowerPosition(borrower.address);
      expect(afterRepay.borrowedAmount).to.equal(0n);
      
      // No need to wait blocks after repayment

      // Verify NFTs are still locked
      for (const tokenId of tokenIds) {
        expect(await liquidityHub.isNFTLocked(nft.target, tokenId)).to.be.true;
      }

      // Unlock collateral
      await liquidityHub.connect(borrower).unlockCollateral(tokenIds, nft.target);

      // Verify NFTs are unlocked
      for (const tokenId of tokenIds) {
        expect(await liquidityHub.isNFTLocked(nft.target, tokenId)).to.be.false;
        expect(await nft.ownerOf(tokenId)).to.equal(borrower.address);
      }

      // Verify position cleared
      const finalPosition = await liquidityHub.getBorrowerPosition(borrower.address);
      expect(finalPosition.collateralNFTs.length).to.equal(0);
      expect(finalPosition.totalCollateralValue).to.equal(0n);
      expect(finalPosition.borrowedAmount).to.equal(0n);
    });

    it("should handle loan defaults correctly", async function () {
      // Set high borrowing APY to trigger default faster (200% APY)
      const highAPY = 20000; // 200% APY in basis points
      await admin.connect(owner).setBorrowingAPY(highAPY);
      
      // Set default threshold to 50%
      await admin.connect(owner).setDefaultThreshold(5000); // 50% in basis points

      // Lock collateral and borrow
      const tokenIds = [0, 1];
      await liquidityHub.connect(borrower).lockNFTCollateral(tokenIds, nft.target);
      
      const borrowAmount = (NFT_PRICE * 2n * 4000n) / 10000n; // 40% of collateral in basis points
      await liquidityHub.connect(borrower).borrow(borrowAmount);

      // Set up loan health tracking
      let position = await liquidityHub.getBorrowerPosition(borrower.address);
      let totalOwed = await liquidityHub.getTotalOwed(borrower.address);
      let loanHealth = (position.totalCollateralValue * 10000n) / totalOwed; // Using basis points (10000 = 100%)
      const defaultThreshold = await liquidityHub.defaultThreshold();
      
      console.log("Initial Total Owed:", totalOwed);
      console.log("Initial Total Collateral:", position.totalCollateralValue);
      console.log("Initial Loan Health:", loanHealth);
      console.log("Default Threshold:", defaultThreshold);
      
      // Mine blocks until loan is in default
      let attempts = 0;
      const maxAttempts = 10;
      while (loanHealth > defaultThreshold && attempts < maxAttempts) {
        await network.provider.send("hardhat_mine", ["0x100000"]); // Mine 1M blocks
        
        totalOwed = await liquidityHub.getTotalOwed(borrower.address);
        position = await liquidityHub.getBorrowerPosition(borrower.address);
        loanHealth = (position.totalCollateralValue * 10000n) / totalOwed; // Using basis points
        
        console.log("Current Total Owed:", totalOwed);
        console.log("Current Loan Health:", loanHealth);
        attempts++;
      }
      
      // Make sure we reached default threshold
      expect(loanHealth).to.be.lte(defaultThreshold, "Failed to reach default threshold");
      
      // Verify loan exists before default
      position = await liquidityHub.getBorrowerPosition(borrower.address);
      expect(position.borrowedAmount).to.be.gt(0n, "Loan should exist before default");
      
      // Handle default
      await admin.connect(owner).handleDefault(borrower.address, nft.target);
      
      // Verify NFTs are transferred to treasury
      for (const tokenId of tokenIds) {
        expect(await nft.ownerOf(tokenId)).to.equal(treasury.address);
      }

      // Verify position cleared
      const finalPosition = await liquidityHub.getBorrowerPosition(borrower.address);
      expect(finalPosition.collateralNFTs.length).to.equal(0);
      expect(finalPosition.totalCollateralValue).to.equal(0n);
      expect(finalPosition.borrowedAmount).to.equal(0n);
    });
  });

  describe("Admin Operations", function () {
    it("should allow admin to update APY rates and verify effects", async function () {
      // Check initial APY rates from constructor
      expect(await liquidityHub.lendingAPY()).to.equal(300); // 3% in basis points
      expect(await liquidityHub.borrowingAPY()).to.equal(600); // 6% in basis points

      // Update to new APY rates (4% and 8%)
      const newLendingAPY = 400; // 4% APY in basis points
      const newBorrowingAPY = 800; // 8% APY in basis points
      await admin.connect(owner).setLendingAPY(newLendingAPY);
      await admin.connect(owner).setBorrowingAPY(newBorrowingAPY);

      // Verify APY rates were updated
      const updatedLendingAPY = await liquidityHub.lendingAPY();
      const updatedBorrowingAPY = await liquidityHub.borrowingAPY();
      expect(updatedLendingAPY).to.equal(400); // 4% in basis points
      expect(updatedBorrowingAPY).to.equal(800); // 8% in basis points

      // Verify APY update events were emitted
      const events = await admin.queryFilter(admin.filters.APYUpdated());
      expect(events.length).to.equal(3); // 1 constructor event + 2 new updates
      const lastEvent = events[events.length - 1];
      expect(lastEvent.args[0]).to.equal(400); // 4% in basis points
      expect(lastEvent.args[1]).to.equal(800); // 8% in basis points

      // Verify we can use these new rates for lending/borrowing
      const depositAmount = ethers.parseUnits("1000", USDT_DECIMALS);
      await usdt.connect(lender).approve(liquidityHub.target, depositAmount);
      await liquidityHub.connect(lender).deposit(depositAmount);
      
      // Mine some blocks
      await network.provider.send("hardhat_mine", ["0x64"]); // 100 blocks
      
      // Check earned interest is calculated with new rate
      const earnedInterest = await liquidityHub.getCurrentEarnedInterest(lender.address);
      expect(earnedInterest).to.be.gt(0n);
    });

    it("should allow admin to update borrowing parameters", async function () {
      // Set initial parameters
      const initialBorrowingLimit = 4000; // 40% in basis points
      const initialDefaultThreshold = 5000; // 50% in basis points
      await admin.connect(owner).setBorrowingLimit(initialBorrowingLimit);
      await admin.connect(owner).setDefaultThreshold(initialDefaultThreshold);

      // Update to new parameters (40% and 50%)
      const newBorrowingLimit = 4000; // 40% in basis points
      const newDefaultThreshold = 5000; // 50% in basis points
      await admin.connect(owner).setBorrowingLimit(newBorrowingLimit);
      await admin.connect(owner).setDefaultThreshold(newDefaultThreshold);

      // Verify parameters were updated
      const updatedBorrowingLimit = await liquidityHub.borrowingLimit();
      const updatedDefaultThreshold = await liquidityHub.defaultThreshold();
      expect(updatedBorrowingLimit).to.equal(newBorrowingLimit);
      expect(updatedDefaultThreshold).to.equal(newDefaultThreshold);
    });

    it("should allow admin to pause and unpause", async function () {
      await admin.connect(owner).toggleEmergencyPause();
      expect(await admin.paused()).to.be.true;

      // Try to deposit while paused
      await expect(
        liquidityHub.connect(lender).deposit(ethers.parseUnits("1000", USDT_DECIMALS))
      ).to.be.revertedWith("Contract is paused");

      // Unpause
      await admin.connect(owner).toggleEmergencyPause();
      expect(await admin.paused()).to.be.false;

      // Should be able to deposit now
      await liquidityHub.connect(lender).deposit(ethers.parseUnits("1000", USDT_DECIMALS));
    });
  });
});
