const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("======== TESTING UNLOCK COLLATERAL FUNCTION WITH DEBUG LOGGING ========");
  
  // Get signers
  const [owner, user] = await ethers.getSigners();
  console.log("Owner address:", owner.address);
  console.log("User address:", user.address);

  // Deploy the contract directly
  console.log("\nDeploying contracts...");
  
  // Use existing deployment script - this uploads our version with debug logging
  console.log("Deploying LiquidityHub and related contracts...");
  await hre.run("run", {
    script: "scripts/deploy-liquidity-hub.js",
    network: "localhost"
  });
  
  // Use the LiquidityHub address from the deployment logs
  // This is hardcoded based on the latest deployment output
  const liquidityHubAddress = "0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB";
  console.log("Using LiquidityHub contract at:", liquidityHubAddress);
  
  // Get the LiquidityHub contract first to find out which USDT it's using
  const LiquidityHub = await ethers.getContractFactory("LiquidityHub");
  const liquidityHub = LiquidityHub.attach(liquidityHubAddress);
  
  // Get the USDT token address from the LiquidityHub contract
  const usdtTokenAddress = await liquidityHub.usdtToken();
  console.log("\nRetrieved USDT token address from LiquidityHub:", usdtTokenAddress);
  
  // Connect to the existing USDT token
  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT", {
    paths: ["contracts/mocks"]
  });
  const mockUSDT = MockUSDT.attach(usdtTokenAddress);
  
  // Deploy a simplified test NFT (not using RealEstateNFT which requires factory)
  console.log("\nDeploying TestNFT...");
  const TestNFT = await hre.ethers.getContractFactory("TestNFT");
  const testNFT = await TestNFT.deploy("Test NFT Collection", "TNT");
  await testNFT.waitForDeployment();
  const testNFTAddress = await testNFT.getAddress();
  console.log("TestNFT deployed at:", testNFTAddress);
  
  // These have already been created above
  
  // Mint NFTs to user for testing
  console.log("\nMinting NFTs to user...");
  await testNFT.connect(owner).mint(user.address, 1);
  await testNFT.connect(owner).mint(user.address, 2);
  await testNFT.connect(owner).mint(user.address, 3);
  console.log("Minted NFTs with IDs 1, 2, 3 to user");
  
  // Transfer USDT to user
  console.log("\nTransferring USDT to user...");
  await mockUSDT.connect(owner).transfer(user.address, ethers.parseUnits("1000", 6));
  console.log("Transferred 1,000 USDT to user");
  
  // No need to add TestNFT as a supported collection -
  // The protocol will use the NFT's getCollectionInfo() function to get the price
  
  // Provide initial liquidity to the hub
  console.log("\nProviding initial liquidity to LiquidityHub...");
  // First mint additional USDT to the owner if needed (since we're using a new MockUSDT instance)
  const ownerBalance = await mockUSDT.balanceOf(owner.address);
  if (ownerBalance < ethers.parseUnits("5000", 6)) {
    console.log("Minting additional USDT to owner...");
    await mockUSDT.connect(owner).mint(owner.address, ethers.parseUnits("10000", 6));
    console.log("Minted 10,000 USDT to owner");
  }
  
  // Now approve and deposit
  console.log("Approving USDT for deposit...");
  await mockUSDT.connect(owner).approve(liquidityHubAddress, ethers.parseUnits("5000", 6));
  console.log("Approved 5,000 USDT for deposit");
  
  try {
    await liquidityHub.connect(owner).deposit(ethers.parseUnits("5000", 6));
    console.log("Deposited 5,000 USDT as initial liquidity");
  } catch (error) {
    console.error("Deposit failed:", error.message);
    // Check if the MockUSDT contract has a mint function we can use
    console.log("Checking for mint function in MockUSDT...");
    try {
      await mockUSDT.connect(owner).mint(liquidityHubAddress, ethers.parseUnits("5000", 6));
      console.log("Minted 5,000 USDT directly to LiquidityHub");
      // Update total deposited in LiquidityHub manually if needed
      // This is a workaround for testing purposes
      console.log("Total deposited before:", ethers.formatUnits(await liquidityHub.totalDeposited(), 6));
      const adminAddress = await liquidityHub.adminContract();
      const LiquidityHubAdmin = await ethers.getContractFactory("LiquidityHubAdmin");
      const liquidityHubAdmin = LiquidityHubAdmin.attach(adminAddress);
      await liquidityHubAdmin.connect(owner).updateTotalDeposited(ethers.parseUnits("5000", 6));
      console.log("Updated total deposited manually");
      console.log("Total deposited after:", ethers.formatUnits(await liquidityHub.totalDeposited(), 6));
    } catch (mintError) {
      console.error("Could not mint USDT directly:", mintError.message);
    }
  }
  
  // Connect contracts as user
  const liquidityHubAsUser = liquidityHub.connect(user);
  const mockUSDTAsUser = mockUSDT.connect(user);
  const testNFTAsUser = testNFT.connect(user);
  
  // Approve NFTs for LiquidityHub
  console.log("\nApproving NFTs for LiquidityHub...");
  await testNFTAsUser.setApprovalForAll(liquidityHubAddress, true);
  console.log("Approved TestNFT for LiquidityHub");
  
  // Approve USDT for LiquidityHub
  console.log("\nApproving USDT for LiquidityHub...");
  await mockUSDTAsUser.approve(liquidityHubAddress, ethers.MaxUint256);
  console.log("Approved USDT for LiquidityHub");
  
  // Lock all 3 NFTs as collateral
  console.log("\nLocking 3 NFTs as collateral...");
  await liquidityHubAsUser.lockNFTCollateral([
    {
      nftContract: testNFTAddress,
      tokenIds: [1, 2, 3]
    }
  ]);
  
  // Verify NFTs are locked
  const borrowerPosition = await liquidityHub.borrowerPositions(user.address);
  console.log("Total collateral value:", ethers.formatUnits(borrowerPosition.totalCollateralValue, 6), "USDT");
  console.log("Number of NFTs locked:", borrowerPosition.collateralNFTs.length);
  
  // Borrow 500 USDT
  console.log("\nBorrowing 500 USDT...");
  const borrowAmount = ethers.parseUnits("500", 6);
  await liquidityHubAsUser.borrow(borrowAmount);
  
  // Verify borrowed amount
  const updatedPosition = await liquidityHub.borrowerPositions(user.address);
  console.log("Borrowed amount:", ethers.formatUnits(updatedPosition.borrowedAmount, 6), "USDT");
  
  // Make a partial repayment of 300 USDT
  console.log("\nMaking partial repayment of 300 USDT...");
  const repayAmount = ethers.parseUnits("300", 6);
  await liquidityHubAsUser.repay(repayAmount);
  
  // Verify updated borrowed amount
  const positionAfterRepay = await liquidityHub.borrowerPositions(user.address);
  console.log("Remaining borrowed amount after repayment:", ethers.formatUnits(positionAfterRepay.borrowedAmount, 6), "USDT");
  console.log("Total collateral value after repayment:", ethers.formatUnits(positionAfterRepay.totalCollateralValue, 6), "USDT");
  
  // Now try to unlock 2 NFTs (should trigger the debug logs)
  console.log("\nAttempting to unlock 2 NFTs...");
  try {
    await liquidityHubAsUser.unlockCollateral([
      {
        nftContract: testNFTAddress,
        tokenIds: [1, 2]
      }
    ]);
    console.log("NFT unlock successful!");
  } catch (error) {
    console.error("NFT unlock failed with error:", error.message);
    
    // Check if we can extract data from the error message
    if (error.message.includes("execution reverted")) {
      console.log("The transaction reverted, check the Hardhat logs for the debug output.");
    }
  }
  
  // Check final state
  try {
    const finalPosition = await liquidityHub.borrowerPositions(user.address);
    console.log("\nFinal state:");
    console.log("Final borrowed amount:", ethers.formatUnits(finalPosition.borrowedAmount, 6), "USDT");
    console.log("Final total collateral value:", ethers.formatUnits(finalPosition.totalCollateralValue, 6), "USDT");
    console.log("Final number of NFTs locked:", finalPosition.collateralNFTs.length);
  } catch (e) {
    console.log("Could not get final position, it may have been deleted if all NFTs were unlocked");
  }
}

// Create a simple test NFT contract for our testing
async function deployContracts() {
  const TestNFT = await ethers.getContractFactory("TestNFT");
  const testNFT = await TestNFT.deploy("Test NFT", "TNT");
  await testNFT.waitForDeployment();
  
  return { testNFT };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
