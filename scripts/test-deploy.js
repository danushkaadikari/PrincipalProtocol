const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy MockUSDT
  console.log("\nDeploying MockUSDT...");
  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();
  console.log("MockUSDT deployed to:", await mockUSDT.getAddress());

  // Deploy AdminRegistry
  console.log("\nDeploying AdminRegistry...");
  const AdminRegistry = await hre.ethers.getContractFactory("AdminRegistry");
  const adminRegistry = await AdminRegistry.deploy();
  await adminRegistry.waitForDeployment();
  console.log("AdminRegistry deployed to:", await adminRegistry.getAddress());

  // Deploy RealEstateNFTFactory
  console.log("\nDeploying RealEstateNFTFactory...");
  const RealEstateNFTFactory = await hre.ethers.getContractFactory("RealEstateNFTFactory");
  const factory = await RealEstateNFTFactory.deploy(
    await adminRegistry.getAddress(),
    await mockUSDT.getAddress()
  );
  await factory.waitForDeployment();
  console.log("RealEstateNFTFactory deployed to:", await factory.getAddress());

  // Create a test collection
  console.log("\nCreating a test collection...");
  const tx = await factory.createCollection(
    "Test Real Estate",
    "TEST",
    hre.ethers.parseUnits("1000", 6), // 1000 USDT
    100, // maxSupply
    "ipfs://test-uri/"
  );
  await tx.wait();
  
  const collections = await factory.getCollections();
  console.log("Test collection created at:", collections[0]);

  // Transfer some MockUSDT to test accounts
  const testAccounts = await hre.ethers.getSigners();
  const amount = hre.ethers.parseUnits("10000", 6); // 10,000 USDT each
  
  console.log("\nTransferring test USDT to accounts...");
  for (let i = 1; i < 5 && i < testAccounts.length; i++) {
    await mockUSDT.transfer(testAccounts[i].address, amount);
    console.log(`Transferred ${amount} USDT to ${testAccounts[i].address}`);
  }

  console.log("\nTest deployment completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
