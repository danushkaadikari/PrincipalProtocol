const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying test RealEstateNFT collection...");
  
  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Read the locally deployed contract addresses
  const deploymentsPath = path.join(__dirname, "../deployments/localhost.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const mockUSDTAddress = deployments.MockUSDT;
  
  console.log("Using MockUSDT at:", mockUSDTAddress);
  
  // Get MockUSDT instance
  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const mockUSDT = MockUSDT.attach(mockUSDTAddress);
  
  // Deploy RealEstateNFT directly
  const RealEstateNFT = await hre.ethers.getContractFactory("RealEstateNFT");
  const realEstateNFT = await RealEstateNFT.deploy(
    "Test Property Collection",
    "TPC",
    mockUSDTAddress,
    ethers.parseUnits("600", 6), // 600 USDT per NFT (same price as in the error scenario)
    100, // maxSupply
    "https://example.com/metadata/"
  );
  
  await realEstateNFT.waitForDeployment();
  const nftAddress = await realEstateNFT.getAddress();
  console.log("RealEstateNFT deployed to:", nftAddress);
  
  // Approve USDT for NFT contract
  console.log("Approving USDT for NFT contract...");
  const mintPrice = ethers.parseUnits("600", 6); // 600 USDT per NFT
  const totalApproval = mintPrice * 10n; // Approve for 10 NFTs
  await mockUSDT.approve(nftAddress, totalApproval);
  console.log(`Approved ${ethers.formatUnits(totalApproval, 6)} USDT for NFT contract`);
  
  // Mint a few NFTs to the deployer for testing
  console.log("Minting test NFTs to deployer...");
  for (let i = 0; i < 3; i++) {
    const tx = await realEstateNFT.mint(1);
    await tx.wait();
    console.log(`Minted NFT #${i+1}`);
  }
  console.log("Minted 3 NFTs to deployer");
  
  // Update deployments file with the new NFT collection
  deployments.TestRealEstateNFT = nftAddress;
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("Updated deployments file with TestRealEstateNFT address");
  
  console.log("\nDeployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
