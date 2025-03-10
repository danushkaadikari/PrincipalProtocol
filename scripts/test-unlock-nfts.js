const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("Starting NFT unlock test with debug logging...");
  
  // Get signers
  const [deployer, user] = await ethers.getSigners();
  console.log("Testing with user address:", user.address);
  
  // Contract addresses from deployment
  const liquidityHubAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const liquidityHubAdminAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const mockUSDTAddress = "0xad959BF6614909Fd8F9E2BAe8119E13D12E8f9D3";
  
  // Get contract instances
  const LiquidityHub = await ethers.getContractFactory("LiquidityHub");
  const liquidityHub = LiquidityHub.attach(liquidityHubAddress);
  
  const LiquidityHubAdmin = await ethers.getContractFactory("LiquidityHubAdmin");
  const liquidityHubAdmin = LiquidityHubAdmin.attach(liquidityHubAdminAddress);
  
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = MockUSDT.attach(mockUSDTAddress);
  
  // We need to deploy an NFT collection for testing
  console.log("Deploying test NFT collection...");
  const RealEstateNFT = await ethers.getContractFactory("RealEstateNFT");
  const realEstateNFT = await RealEstateNFT.deploy(
    "Test Collection",
    "TEST",
    600, // Price: 600 USDT per NFT (same as in the error scenario)
    "Test Location",
    100, // Square footage
    "Test builder",
    "https://example.com/metadata/"
  );
  await realEstateNFT.waitForDeployment();
  const nftCollectionAddress = await realEstateNFT.getAddress();
  console.log("Test NFT collection deployed at:", nftCollectionAddress);
  
  // Mint 3 NFTs to the user
  console.log("Minting 3 NFTs to user...");
  await realEstateNFT.mint(user.address);
  await realEstateNFT.mint(user.address);
  await realEstateNFT.mint(user.address);
  
  // Get the tokenIds
  const tokenId1 = 1;
  const tokenId2 = 2;
  const tokenId3 = 3;
  
  // Grant USDT to the user
  console.log("Granting USDT to user...");
  const initialUSDTAmount = ethers.parseUnits("1000", 6); // 1000 USDT
  await mockUSDT.transfer(user.address, initialUSDTAmount);
  
  // Connect contracts as user
  const liquidityHubAsUser = liquidityHub.connect(user);
  const mockUSDTAsUser = mockUSDT.connect(user);
  const realEstateNFTAsUser = realEstateNFT.connect(user);
  
  // Approve USDT for LiquidityHub
  console.log("Approving USDT for LiquidityHub...");
  await mockUSDTAsUser.approve(liquidityHubAddress, ethers.MaxUint256);
  
  // Approve NFTs for LiquidityHub
  console.log("Approving NFTs for LiquidityHub...");
  await realEstateNFTAsUser.setApprovalForAll(liquidityHubAddress, true);
  
  // Lock all 3 NFTs as collateral
  console.log("Locking 3 NFTs as collateral...");
  await liquidityHubAsUser.lockNFTCollateral([
    {
      nftContract: nftCollectionAddress,
      tokenIds: [tokenId1, tokenId2, tokenId3]
    }
  ]);
  
  // Verify NFTs are locked
  const borrowerPosition = await liquidityHub.borrowerPositions(user.address);
  console.log("Total collateral value:", borrowerPosition.totalCollateralValue.toString());
  console.log("Number of NFTs locked:", borrowerPosition.collateralNFTs.length);
  
  // Borrow 500 USDT (similar to the error scenario)
  console.log("Borrowing 500 USDT...");
  const borrowAmount = ethers.parseUnits("500", 6); // 500 USDT
  await liquidityHubAsUser.borrow(borrowAmount);
  
  // Verify borrowed amount
  const updatedPosition = await liquidityHub.borrowerPositions(user.address);
  console.log("Borrowed amount:", updatedPosition.borrowedAmount.toString());
  
  // Make a partial repayment of 300 USDT
  console.log("Making partial repayment of 300 USDT...");
  const repayAmount = ethers.parseUnits("300", 6); // 300 USDT
  await liquidityHubAsUser.repay(repayAmount);
  
  // Verify updated borrowed amount
  const positionAfterRepay = await liquidityHub.borrowerPositions(user.address);
  console.log("Remaining borrowed amount after repayment:", positionAfterRepay.borrowedAmount.toString());
  console.log("Total collateral value after repayment:", positionAfterRepay.totalCollateralValue.toString());
  
  // Now try to unlock 2 NFTs (should trigger the debug logs)
  console.log("Attempting to unlock 2 NFTs...");
  try {
    await liquidityHubAsUser.unlockCollateral([
      {
        collection: nftCollectionAddress,
        tokenId: tokenId1
      },
      {
        collection: nftCollectionAddress,
        tokenId: tokenId2
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
    console.log("Final borrowed amount:", finalPosition.borrowedAmount.toString());
    console.log("Final total collateral value:", finalPosition.totalCollateralValue.toString());
    console.log("Final number of NFTs locked:", finalPosition.collateralNFTs.length);
  } catch (e) {
    console.log("Could not get final position, it may have been deleted if all NFTs were unlocked");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
