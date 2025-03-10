const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("======== SIMPLE UNLOCK COLLATERAL TEST ========");
  
  // Get signers
  const [owner, user] = await ethers.getSigners();
  console.log("Owner address:", owner.address);
  console.log("User address:", user.address);

  // Deploy all contracts from scratch for testing
  console.log("\nDeploying contracts...");
  
  // Deploy MockUSDT
  console.log("Deploying MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT", {
    paths: ["contracts/mocks"]
  });
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();
  const mockUSDTAddress = await mockUSDT.getAddress();
  console.log("MockUSDT deployed at:", mockUSDTAddress);
  
  // Deploy TestNFT
  console.log("\nDeploying TestNFT...");
  const TestNFT = await ethers.getContractFactory("TestNFT");
  const testNFT = await TestNFT.deploy("Test NFT Collection", "TNT");
  await testNFT.waitForDeployment();
  const testNFTAddress = await testNFT.getAddress();
  console.log("TestNFT deployed at:", testNFTAddress);
  
  // Deploy LiquidityHub and dependencies directly
  console.log("\nDeploying LiquidityHub and related contracts...");
  
  // 1. Deploy InterestRateModel
  const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  const interestRateModelAddress = await interestRateModel.getAddress();
  console.log("InterestRateModel deployed at:", interestRateModelAddress);
  
  // 2. Deploy LiquidityHubAdmin
  const LiquidityHubAdmin = await ethers.getContractFactory("LiquidityHubAdmin");
  const liquidityHubAdmin = await LiquidityHubAdmin.deploy(
    interestRateModelAddress
  );
  await liquidityHubAdmin.waitForDeployment();
  const liquidityHubAdminAddress = await liquidityHubAdmin.getAddress();
  console.log("LiquidityHubAdmin deployed at:", liquidityHubAdminAddress);
  
  // Set treasury wallet
  await liquidityHubAdmin.setTreasuryWallet(owner.address);
  console.log("Treasury wallet set to:", owner.address);
  
  // 3. Deploy LiquidityHub
  const LiquidityHub = await ethers.getContractFactory("LiquidityHub");
  const liquidityHub = await LiquidityHub.deploy(
    liquidityHubAdminAddress,
    mockUSDTAddress
  );
  await liquidityHub.waitForDeployment();
  const liquidityHubAddress = await liquidityHub.getAddress();
  console.log("LiquidityHub deployed at:", liquidityHubAddress);
  
  // Configure LiquidityHub
  console.log("\nConfiguring LiquidityHub...");
  
  // Set default APY rates
  await liquidityHubAdmin.setLendingAPY(300); // 3% lending
  await liquidityHubAdmin.setBorrowingAPY(600); // 6% borrowing
  console.log("Default APY rates set - Lending: 3%, Borrowing: 6%");
  
  // Set borrowing limit (40%) and threshold (60%)
  await liquidityHubAdmin.setBorrowingLimit(4000); // 40%
  await liquidityHubAdmin.setDefaultThreshold(6000); // 60%
  console.log("Borrowing limit and threshold set successfully");
  
  // Mint and transfer tokens for testing
  console.log("\nSetting up test accounts...");
  
  // Mint USDT to owner
  await mockUSDT.connect(owner).mint(owner.address, ethers.parseUnits("10000", 6));
  console.log("Minted 10,000 USDT to owner");
  
  // Transfer USDT to user
  await mockUSDT.connect(owner).transfer(user.address, ethers.parseUnits("1000", 6));
  console.log("Transferred 1,000 USDT to user");
  
  // Provide initial liquidity to LiquidityHub
  console.log("\nProviding initial liquidity to LiquidityHub...");
  await mockUSDT.connect(owner).approve(liquidityHubAddress, ethers.parseUnits("5000", 6));
  await liquidityHub.connect(owner).deposit(ethers.parseUnits("5000", 6));
  console.log("Deposited 5,000 USDT as initial liquidity");
  
  // Mint NFTs to user for testing
  console.log("\nMinting NFTs to user...");
  await testNFT.connect(owner).mint(user.address, 1);
  await testNFT.connect(owner).mint(user.address, 2);
  await testNFT.connect(owner).mint(user.address, 3);
  console.log("Minted NFTs with IDs 1, 2, 3 to user");
  
  // Test NFT locking, borrowing, and unlocking
  console.log("\n======== TESTING UNLOCK COLLATERAL FUNCTION ========");
  
  // Step 1: Approve NFTs for LiquidityHub
  console.log("\nApproving NFTs for LiquidityHub...");
  await testNFT.connect(user).setApprovalForAll(liquidityHubAddress, true);
  console.log("Approved TestNFT for LiquidityHub");
  
  // Step 2: Lock NFTs as collateral
  console.log("\nLocking NFTs as collateral...");
  await liquidityHub.connect(user).lockNFTCollateral([
    {
      nftContract: testNFTAddress,
      tokenIds: [1, 2, 3]
    }
  ]);
  console.log("NFTs locked successfully");
  
  // Verify collateral value
  const totalCollateralValue = await liquidityHub.getBorrowerTotalCollateralValue(user.address);
  console.log("Total collateral value:", ethers.formatUnits(totalCollateralValue, 6), "USDT");
  
  // Step 3: Borrow against collateral
  console.log("\nBorrowing against collateral...");
  const borrowAmount = ethers.parseUnits("500", 6); // 500 USDT
  await liquidityHub.connect(user).borrow(borrowAmount);
  console.log("Borrowed 500 USDT");
  
  // Verify borrowed amount
  const borrowedAmount = await liquidityHub.getBorrowerBorrowedAmount(user.address);
  console.log("Borrowed amount:", ethers.formatUnits(borrowedAmount, 6), "USDT");
  
  // Step 4: Make a partial repayment
  console.log("\nMaking partial repayment...");
  const repayAmount = ethers.parseUnits("200", 6); // 200 USDT
  await mockUSDT.connect(user).approve(liquidityHubAddress, repayAmount);
  await liquidityHub.connect(user).repay(repayAmount);
  console.log("Repaid 200 USDT");
  
  // Verify updated borrowed amount
  const updatedBorrowedAmount = await liquidityHub.getBorrowerBorrowedAmount(user.address);
  console.log("Remaining borrowed amount:", ethers.formatUnits(updatedBorrowedAmount, 6), "USDT");
  
  // Store this for later use
  const positionAfterRepay = {
    borrowedAmount: updatedBorrowedAmount,
    totalCollateralValue: await liquidityHub.getBorrowerTotalCollateralValue(user.address)
  };
  
  // Show collateral NFTs before unlock
  const collateralNFTs = await liquidityHub.getBorrowerCollateralNFTs(user.address);
  console.log("\nCollateral NFTs before unlock:");
  for (let i = 0; i < collateralNFTs.length; i++) {
    console.log(`NFT #${i+1}: Contract: ${collateralNFTs[i].collection}, TokenId: ${collateralNFTs[i].tokenId}`);
  }
  
  // Log the borrowable amount based on collateral value
  const currentCollateralValue = await liquidityHub.getBorrowerTotalCollateralValue(user.address);
  const borrowingLimit = await liquidityHub.getBorrowingLimit();
  
  // Convert to string to display more safely
  const borrowingLimitNumber = parseInt(borrowingLimit.toString());
  
  // Just display the values simply, avoid complex calculations
  console.log(`\nBorrowing limit: ${borrowingLimitNumber/100}% of collateral value`);
  console.log(`Current collateral value: ${ethers.formatUnits(currentCollateralValue, 6)} USDT`);
  
  // Step 5: Try to unlock one NFT
  console.log("\nAttempting to unlock one NFT...");
  try {
    // Log the current values to help debug
    console.log(`Current borrowed amount: ${ethers.formatUnits(positionAfterRepay.borrowedAmount, 6)} USDT`);
    console.log(`Current collateral value: ${ethers.formatUnits(positionAfterRepay.totalCollateralValue, 6)} USDT`);
    console.log(`Borrowing limit: ${await liquidityHub.getBorrowingLimit()} basis points`);
    
    await liquidityHub.connect(user).unlockCollateral([
      {
        collection: testNFTAddress,
        tokenId: 1
      }
    ]);
    console.log("Successfully unlocked NFT with tokenId 1");
    
    // Verify remaining collateral
    const remainingCollateral = await liquidityHub.getBorrowerCollateralNFTs(user.address);
    console.log("\nRemaining collateral NFTs:");
    for (let i = 0; i < remainingCollateral.length; i++) {
      console.log(`NFT #${i+1}: Contract: ${remainingCollateral[i].collection}, TokenId: ${remainingCollateral[i].tokenId}`);
    }
    
    // Verify NFT was returned to user
    const nftOwner = await testNFT.ownerOf(1);
    console.log(`Owner of NFT with tokenId 1: ${nftOwner} (Expected: ${user.address})`);
    
  } catch (error) {
    console.error("Failed to unlock NFT:", error.message);
    console.log("This might be expected if the remaining collateral is insufficient for the loan");
  }
  
  // Step 6: Repay remaining loan
  console.log("\nRepaying remaining loan...");
  const remainingLoan = await liquidityHub.getBorrowerBorrowedAmount(user.address);
  console.log(`Remaining loan amount: ${ethers.formatUnits(remainingLoan, 6)} USDT`);
  
  if (remainingLoan > 0) {
    await mockUSDT.connect(user).approve(liquidityHubAddress, remainingLoan);
    await liquidityHub.connect(user).repay(remainingLoan);
    console.log(`Repaid remaining ${ethers.formatUnits(remainingLoan, 6)} USDT`);
  } else {
    console.log("No remaining loan to repay");
  }
  
  // Verify and log the current loan state - should be fully repaid
  const finalBorrowedAmount = await liquidityHub.getBorrowerBorrowedAmount(user.address);
  console.log("\nFinal borrowed amount after full repayment: ", ethers.formatUnits(finalBorrowedAmount, 6), "USDT");
  
  // Step 7: Now unlock remaining NFTs
  console.log("\nUnlocking remaining NFTs...");
  try {
    await liquidityHub.connect(user).unlockCollateral([
      {
        collection: testNFTAddress,
        tokenId: 2
      },
      {
        collection: testNFTAddress,
        tokenId: 3
      }
    ]);
    console.log("Successfully unlocked remaining NFTs");
    
    // Verify all NFTs returned to user
    const nftOwner2 = await testNFT.ownerOf(2);
    const nftOwner3 = await testNFT.ownerOf(3);
    console.log(`Owner of NFT with tokenId 2: ${nftOwner2} (Expected: ${user.address})`);
    console.log(`Owner of NFT with tokenId 3: ${nftOwner3} (Expected: ${user.address})`);
    
  } catch (error) {
    console.error("Failed to unlock remaining NFTs:", error.message);
  }
  
  console.log("\n======== TEST COMPLETED ========");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
