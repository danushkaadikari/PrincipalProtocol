const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy MockUSDT first
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

  // Print all deployed addresses
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("MockUSDT:", await mockUSDT.getAddress());
  console.log("AdminRegistry:", await adminRegistry.getAddress());
  console.log("RealEstateNFTFactory:", await factory.getAddress());

  // Verify contracts on Etherscan if not on localhost
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerifying contracts on Etherscan...");
    
    // Wait for Etherscan to index the contracts
    console.log("Waiting for 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      await hre.run("verify:verify", {
        address: await mockUSDT.getAddress(),
        constructorArguments: [],
      });
      console.log("MockUSDT verified");
    } catch (error) {
      console.error("Error verifying MockUSDT:", error);
    }

    try {
      await hre.run("verify:verify", {
        address: await adminRegistry.getAddress(),
        constructorArguments: [],
      });
      console.log("AdminRegistry verified");
    } catch (error) {
      console.error("Error verifying AdminRegistry:", error);
    }

    try {
      await hre.run("verify:verify", {
        address: await factory.getAddress(),
        constructorArguments: [
          await adminRegistry.getAddress(),
          await mockUSDT.getAddress(),
        ],
      });
      console.log("RealEstateNFTFactory verified");
    } catch (error) {
      console.error("Error verifying RealEstateNFTFactory:", error);
    }
  }

  // Save deployment addresses to a file
  const fs = require("fs");
  const deploymentInfo = {
    mockUSDT: await mockUSDT.getAddress(),
    adminRegistry: await adminRegistry.getAddress(),
    realEstateNFTFactory: await factory.getAddress(),
    network: network.name,
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = "./deployments";
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }

  fs.writeFileSync(
    `${deploymentPath}/${network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\nDeployment addresses saved to ${deploymentPath}/${network.name}.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
