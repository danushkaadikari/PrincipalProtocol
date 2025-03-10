const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("Setting up test environment...");
  
  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Deploy MockUSDT
  console.log("\nDeploying MockUSDT...");
  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();
  const mockUSDTAddress = await mockUSDT.getAddress();
  console.log("MockUSDT deployed to:", mockUSDTAddress);
  
  // Deploy RealEstateNFT 
  console.log("\nDeploying RealEstateNFT...");
  const RealEstateNFT = await hre.ethers.getContractFactory("RealEstateNFT");
  const realEstateNFT = await RealEstateNFT.deploy(
    "Test Property Collection",
    "TPC",
    mockUSDTAddress,
    ethers.parseUnits("600", 6), // 600 USDT per NFT (same price as in error scenario)
    100, // maxSupply
    "https://example.com/metadata/"
  );
  await realEstateNFT.waitForDeployment();
  const nftAddress = await realEstateNFT.getAddress();
  console.log("RealEstateNFT deployed to:", nftAddress);
  
  // Deploy InterestRateModel
  console.log("\nDeploying InterestRateModel...");
  const InterestRateModel = await hre.ethers.getContractFactory("InterestRateModel");
  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  const modelAddress = await interestRateModel.getAddress();
  console.log("InterestRateModel deployed to:", modelAddress);
  
  // Deploy LiquidityHubAdmin
  console.log("\nDeploying LiquidityHubAdmin...");
  const LiquidityHubAdmin = await hre.ethers.getContractFactory("LiquidityHubAdmin");
  const liquidityHubAdmin = await LiquidityHubAdmin.deploy(modelAddress);
  await liquidityHubAdmin.waitForDeployment();
  const adminAddress = await liquidityHubAdmin.getAddress();
  console.log("LiquidityHubAdmin deployed to:", adminAddress);
  
  // Deploy LiquidityHub
  console.log("\nDeploying LiquidityHub...");
  const LiquidityHub = await hre.ethers.getContractFactory("LiquidityHub");
  const liquidityHub = await LiquidityHub.deploy(
    adminAddress,
    mockUSDTAddress
  );
  await liquidityHub.waitForDeployment();
  const hubAddress = await liquidityHub.getAddress();
  console.log("LiquidityHub deployed to:", hubAddress);
  
  // Set default APY rates
  console.log("\nSetting default APY rates...");
  const lendingAPY = 300; // 3%
  const borrowingAPY = 600; // 6%
  await liquidityHubAdmin.setLendingAPY(lendingAPY);
  await liquidityHubAdmin.setBorrowingAPY(borrowingAPY);
  console.log("Default APY rates set - Lending: 3%, Borrowing: 6%");
  
  // Mint USDT to deployer
  console.log("\nMinting USDT to deployer for testing...");
  const usdtAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
  // No need to mint as deployer already has USDT from deployment
  
  // Approve USDT for NFT contract
  console.log("\nApproving USDT for NFT contract...");
  const mintPrice = ethers.parseUnits("600", 6); // 600 USDT per NFT
  const totalMintApproval = mintPrice * 10n; // Approve for 10 NFTs
  await mockUSDT.approve(nftAddress, totalMintApproval);
  console.log(`Approved ${ethers.formatUnits(totalMintApproval, 6)} USDT for NFT contract`);
  
  // Mint NFTs to deployer
  console.log("\nMinting NFTs to deployer...");
  for (let i = 0; i < 3; i++) {
    const tx = await realEstateNFT.mint(1);
    await tx.wait();
    console.log(`Minted NFT #${i+1}`);
  }
  
  // Approve USDT for LiquidityHub
  console.log("\nApproving USDT for LiquidityHub...");
  await mockUSDT.approve(hubAddress, ethers.MaxUint256);
  console.log("Approved USDT for LiquidityHub");
  
  // Approve NFTs for LiquidityHub
  console.log("\nApproving NFTs for LiquidityHub...");
  await realEstateNFT.setApprovalForAll(hubAddress, true);
  console.log("Approved NFTs for LiquidityHub");
  
  // Fund LiquidityHub with some initial liquidity
  console.log("\nFunding LiquidityHub with initial liquidity...");
  const depositAmount = ethers.parseUnits("5000", 6); // 5,000 USDT
  await liquidityHub.deposit(depositAmount);
  console.log(`Deposited ${ethers.formatUnits(depositAmount, 6)} USDT as initial liquidity`);
  
  // Print out all test addresses for reference
  console.log("\n=== TEST ENVIRONMENT SETUP COMPLETE ===");
  console.log("MockUSDT:", mockUSDTAddress);
  console.log("RealEstateNFT:", nftAddress);
  console.log("LiquidityHubAdmin:", adminAddress);
  console.log("LiquidityHub:", hubAddress);
  
  return {
    mockUSDT: mockUSDTAddress,
    realEstateNFT: nftAddress,
    liquidityHubAdmin: adminAddress,
    liquidityHub: hubAddress
  };
}

// If this script is run directly, run main()
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };
