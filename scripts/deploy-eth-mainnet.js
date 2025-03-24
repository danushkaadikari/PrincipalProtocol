const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts to Ethereum Mainnet with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Check network configuration
  try {
    const network = await hre.ethers.provider.getNetwork();
    console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    if (network.chainId !== 1n) {
      console.warn("\n⚠️  WARNING: This script is intended to be run on Ethereum Mainnet (Chain ID: 1)");
      console.warn(`You are currently connected to: ${network.name} (Chain ID: ${network.chainId})`);
      
      // Give the user a chance to abort
      console.warn("\nDeploying to a network other than Ethereum Mainnet may result in unexpected behavior.");
      console.warn("If this is a test run, you can continue. Otherwise, please check your network configuration.");
      console.warn("To deploy to Ethereum Mainnet, make sure your .env file has a valid MAINNET_URL.");
      console.warn("\nContinuing deployment in 5 seconds... (Press Ctrl+C to abort)\n");
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } catch (error) {
    console.error("\n❌ ERROR: Failed to connect to the network. Please check your configuration:");
    console.error("1. Ensure 'mainnet' is defined in your hardhat.config.js networks section");
    console.error("2. Verify that MAINNET_URL is set correctly in your .env file");
    console.error("3. Check that your Alchemy API key or other provider URL is valid\n");
    console.error("Error details:", error.message);
    process.exit(1);
  }

  console.log("\n=== DEPLOYMENT STARTED ===\n");
  console.log("Network: Ethereum Mainnet");
  console.log("Chain ID:", network.chainId);
  console.log("Timestamp:", new Date().toISOString());
  console.log("\n");

  // Real USDT address on Ethereum Mainnet
  const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  console.log("Using real USDT at:", USDT_ADDRESS);

  // Step 1: Deploy AdminRegistry
  console.log("\n=== DEPLOYING ADMIN REGISTRY ===");
  const AdminRegistry = await hre.ethers.getContractFactory("AdminRegistry");
  const initialMaxAdminLimit = 50; // Set maximum admin limit
  const adminRegistry = await AdminRegistry.deploy(initialMaxAdminLimit);
  await adminRegistry.waitForDeployment();
  const adminRegistryAddress = await adminRegistry.getAddress();
  console.log("AdminRegistry deployed to:", adminRegistryAddress);
  console.log("AdminRegistry max admin limit set to:", initialMaxAdminLimit);

  // Step 2: Deploy RealEstateNFTFactory
  console.log("\n=== DEPLOYING REAL ESTATE NFT FACTORY ===");
  const RealEstateNFTFactory = await hre.ethers.getContractFactory("RealEstateNFTFactory");
  const factory = await RealEstateNFTFactory.deploy(
    adminRegistryAddress,
    USDT_ADDRESS
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("RealEstateNFTFactory deployed to:", factoryAddress);

  // Step 3: Deploy InterestRateModel
  console.log("\n=== DEPLOYING INTEREST RATE MODEL ===");
  const InterestRateModel = await hre.ethers.getContractFactory("InterestRateModel");
  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  const interestRateModelAddress = await interestRateModel.getAddress();
  console.log("InterestRateModel deployed to:", interestRateModelAddress);

  // Step 4: Deploy LiquidityHubAdmin
  console.log("\n=== DEPLOYING LIQUIDITY HUB ADMIN ===");
  const LiquidityHubAdmin = await hre.ethers.getContractFactory("LiquidityHubAdmin");
  const liquidityHubAdmin = await LiquidityHubAdmin.deploy(interestRateModelAddress);
  await liquidityHubAdmin.waitForDeployment();
  const liquidityHubAdminAddress = await liquidityHubAdmin.getAddress();
  console.log("LiquidityHubAdmin deployed to:", liquidityHubAdminAddress);

  // Step 5: Deploy LiquidityHub
  console.log("\n=== DEPLOYING LIQUIDITY HUB ===");
  const LiquidityHub = await hre.ethers.getContractFactory("LiquidityHub");
  const liquidityHub = await LiquidityHub.deploy(
    liquidityHubAdminAddress,
    USDT_ADDRESS
  );
  await liquidityHub.waitForDeployment();
  const liquidityHubAddress = await liquidityHub.getAddress();
  console.log("LiquidityHub deployed to:", liquidityHubAddress);

  // Set LiquidityHub address in LiquidityHubAdmin
  console.log("Setting LiquidityHub address in LiquidityHubAdmin...");
  const setLiquidityHubTx = await liquidityHubAdmin.setLiquidityHubAddress(liquidityHubAddress);
  await setLiquidityHubTx.wait();
  console.log("LiquidityHub address set in LiquidityHubAdmin");

  // Set RealEstateNFTFactory address in LiquidityHub
  console.log("Setting RealEstateNFTFactory address in LiquidityHub...");
  const setFactoryTx = await liquidityHub.setRealEstateNFTFactory(factoryAddress);
  await setFactoryTx.wait();
  console.log("RealEstateNFTFactory address set in LiquidityHub");

  // Step 6: Configure LiquidityHub parameters
  console.log("\n=== CONFIGURING LIQUIDITY HUB PARAMETERS ===");
  
  // Set APY rates
  console.log("Setting APY rates...");
  const lendingAPY = 300; // 3%
  const borrowingAPY = 600; // 6%
  await liquidityHubAdmin.setLendingAPY(lendingAPY);
  await liquidityHubAdmin.setBorrowingAPY(borrowingAPY);
  console.log("APY rates set - Lending: 3%, Borrowing: 6%");

  // Set borrowing limits and default threshold
  console.log("Setting borrowing limit and threshold...");
  await liquidityHubAdmin.setBorrowingLimit(4000); // 40%
  await liquidityHubAdmin.setDefaultThreshold(5000); // 50%
  console.log("Borrowing limit: 40%, Default threshold: 50%");

  // Set treasury wallet (consider using a secure multi-sig wallet for production)
  console.log("Setting treasury wallet...");
  const treasuryWallet = deployer.address; // IMPORTANT: Change this to a secure wallet for production
  await liquidityHubAdmin.setTreasuryWallet(treasuryWallet);
  console.log("Treasury wallet set to:", treasuryWallet);
  console.log("NOTE: For production, consider changing the treasury wallet to a secure multi-sig wallet");

  // Step 7: Wait before verification
  console.log("\n=== WAITING BEFORE VERIFICATION ===");
  console.log("Waiting for 60 seconds to ensure contracts are indexed...");
  await new Promise(resolve => setTimeout(resolve, 60000)); // 60 seconds

  // Step 8: Verify contracts on Etherscan
  console.log("\n=== VERIFYING CONTRACTS ON ETHERSCAN ===");
  
  // Verify AdminRegistry
  console.log("Verifying AdminRegistry...");
  try {
    await hre.run("verify:verify", {
      address: adminRegistryAddress,
      constructorArguments: [],
    });
    console.log("AdminRegistry verified successfully");
  } catch (error) {
    console.error("Error verifying AdminRegistry:", error.message);
  }

  // Verify RealEstateNFTFactory
  console.log("Verifying RealEstateNFTFactory...");
  try {
    await hre.run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [
        adminRegistryAddress,
        USDT_ADDRESS,
      ],
    });
    console.log("RealEstateNFTFactory verified successfully");
  } catch (error) {
    console.error("Error verifying RealEstateNFTFactory:", error.message);
  }

  // Verify InterestRateModel
  console.log("Verifying InterestRateModel...");
  try {
    await hre.run("verify:verify", {
      address: interestRateModelAddress,
      constructorArguments: [],
    });
    console.log("InterestRateModel verified successfully");
  } catch (error) {
    console.error("Error verifying InterestRateModel:", error.message);
  }

  // Verify LiquidityHubAdmin
  console.log("Verifying LiquidityHubAdmin...");
  try {
    await hre.run("verify:verify", {
      address: liquidityHubAdminAddress,
      constructorArguments: [interestRateModelAddress],
    });
    console.log("LiquidityHubAdmin verified successfully");
  } catch (error) {
    console.error("Error verifying LiquidityHubAdmin:", error.message);
  }

  // Verify LiquidityHub
  console.log("Verifying LiquidityHub...");
  try {
    await hre.run("verify:verify", {
      address: liquidityHubAddress,
      constructorArguments: [
        liquidityHubAdminAddress,
        USDT_ADDRESS
      ],
    });
    console.log("LiquidityHub verified successfully");
  } catch (error) {
    console.error("Error verifying LiquidityHub:", error.message);
  }

  // Step 9: Save deployment information
  console.log("\n=== SAVING DEPLOYMENT INFORMATION ===");
  
  const deploymentInfo = {
    network: "mainnet",
    chainId: 1,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      usdt: USDT_ADDRESS,
      adminRegistry: adminRegistryAddress,
      realEstateNFTFactory: factoryAddress,
      interestRateModel: interestRateModelAddress,
      liquidityHubAdmin: liquidityHubAdminAddress,
      liquidityHub: liquidityHubAddress
    },
    configuration: {
      lendingAPY,
      borrowingAPY,
      borrowingLimit: 4000, // 40%
      defaultThreshold: 5000, // 50%
      treasuryWallet
    }
  };

  // Create deployments directory if it doesn't exist
  const deploymentPath = "./deployments";
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }

  // Save deployment info to file
  const deploymentFile = `${deploymentPath}/mainnet.json`;
  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment information saved to ${deploymentFile}`);

  // Step 10: Update .env.local file
  console.log("\n=== UPDATING FRONTEND ENVIRONMENT ===");
  
  const envPath = './frontend/.env.local';
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update contract addresses
  envContent = envContent.replace(
    /NEXT_PUBLIC_ADMIN_REGISTRY_ADDRESS=.*/,
    `NEXT_PUBLIC_ADMIN_REGISTRY_ADDRESS=${adminRegistryAddress}`
  );
  
  envContent = envContent.replace(
    /NEXT_PUBLIC_NFT_FACTORY_ADDRESS=.*/,
    `NEXT_PUBLIC_NFT_FACTORY_ADDRESS=${factoryAddress}`
  );
  
  envContent = envContent.replace(
    /NEXT_PUBLIC_USDT_ADDRESS=.*/,
    `NEXT_PUBLIC_USDT_ADDRESS=${USDT_ADDRESS}`
  );
  
  envContent = envContent.replace(
    /NEXT_PUBLIC_LIQUIDITY_HUB_ADDRESS=.*/,
    `NEXT_PUBLIC_LIQUIDITY_HUB_ADDRESS=${liquidityHubAddress}`
  );
  
  envContent = envContent.replace(
    /NEXT_PUBLIC_LIQUIDITY_HUB_ADMIN_ADDRESS=.*/,
    `NEXT_PUBLIC_LIQUIDITY_HUB_ADMIN_ADDRESS=${liquidityHubAdminAddress}`
  );
  
  // Update chain ID to Ethereum mainnet
  envContent = envContent.replace(
    /NEXT_PUBLIC_CHAIN_ID=.*/,
    `NEXT_PUBLIC_CHAIN_ID=1  # Ethereum Mainnet Chain ID`
  );
  
  fs.writeFileSync(envPath, envContent);
  console.log(`Updated ${envPath} with mainnet contract addresses and chain ID`);

  // Deployment summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network: Ethereum Mainnet");
  console.log("Chain ID: 1");
  console.log("Timestamp:", new Date().toISOString());
  console.log("\nContract Addresses:");
  console.log("- USDT:", USDT_ADDRESS);
  console.log("- AdminRegistry:", adminRegistryAddress);
  console.log("- RealEstateNFTFactory:", factoryAddress);
  console.log("- InterestRateModel:", interestRateModelAddress);
  console.log("- LiquidityHubAdmin:", liquidityHubAdminAddress);
  console.log("- LiquidityHub:", liquidityHubAddress);
  console.log("\nConfiguration:");
  console.log("- Lending APY: 3%");
  console.log("- Borrowing APY: 6%");
  console.log("- Borrowing Limit: 40%");
  console.log("- Default Threshold: 50%");
  console.log("- Treasury Wallet:", treasuryWallet);
  console.log("\n=== DEPLOYMENT COMPLETED SUCCESSFULLY ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
