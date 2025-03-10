const hre = require("hardhat");

async function main() {
  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Use existing AdminRegistry address
  const adminRegistryAddress = "0xe44b3226a02b5eA0146B76C20AE608622d97E2F4";
  console.log("Using existing AdminRegistry at:", adminRegistryAddress);

  // Deploy InterestRateModel
  const InterestRateModel = await hre.ethers.getContractFactory("InterestRateModel");
  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  console.log("InterestRateModel deployed to:", await interestRateModel.getAddress());

  // Use existing MockUSDT address
  const mockUSDT = "0xad959BF6614909Fd8F9E2BAe8119E13D12E8f9D3";
  console.log("Using existing MockUSDT at:", mockUSDT);

  // Use deployer's address as treasury wallet
  const treasuryWallet = deployer.address;
  console.log("Using deployer as treasury wallet:", treasuryWallet);

  // Deploy LiquidityHubAdmin
  const LiquidityHubAdmin = await hre.ethers.getContractFactory("LiquidityHubAdmin");
  const liquidityHubAdmin = await LiquidityHubAdmin.deploy(await interestRateModel.getAddress());
  await liquidityHubAdmin.waitForDeployment();
  console.log("LiquidityHubAdmin deployed to:", await liquidityHubAdmin.getAddress());

  // Deploy LiquidityHub with all required parameters
  const LiquidityHub = await hre.ethers.getContractFactory("LiquidityHub");
  const liquidityHub = await LiquidityHub.deploy(
    await liquidityHubAdmin.getAddress(),
    mockUSDT
  );
  await liquidityHub.waitForDeployment();
  console.log("LiquidityHub deployed to:", await liquidityHub.getAddress());

  // Set default APY rates
  console.log("Setting default APY rates...");
  const lendingAPY = 300; // 3%
  const borrowingAPY = 600; // 6%
  
  await liquidityHubAdmin.setLendingAPY(lendingAPY);
  await liquidityHubAdmin.setBorrowingAPY(borrowingAPY);
  console.log("Default APY rates set - Lending: 3%, Borrowing: 6%");

  // Set default borrowing limit and default threshold
  console.log("Setting default borrowing limit and threshold...");
  await liquidityHubAdmin.setBorrowingLimit(4000); // 40%
  await liquidityHubAdmin.setDefaultThreshold(5000); // 50%
  console.log("Borrowing limit and threshold set successfully");

  // Set treasury wallet
  console.log("Setting treasury wallet...");
  await liquidityHubAdmin.setTreasuryWallet(treasuryWallet);
  console.log("Treasury wallet set to:", treasuryWallet);

  // Wait for a few blocks before verification
  console.log("Waiting for a few blocks before verification...");
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

  // Verify InterestRateModel
  console.log("Verifying InterestRateModel...");
  try {
    await hre.run("verify:verify", {
      address: await interestRateModel.getAddress(),
      constructorArguments: [],
    });
  } catch (error) {
    console.error("Error verifying InterestRateModel:", error);
  }

  // Verify LiquidityHubAdmin
  console.log("Verifying LiquidityHubAdmin...");
  try {
    await hre.run("verify:verify", {
      address: await liquidityHubAdmin.getAddress(),
      constructorArguments: [await interestRateModel.getAddress()],
    });
  } catch (error) {
    console.error("Error verifying LiquidityHubAdmin:", error);
  }

  // Verify LiquidityHub
  console.log("Verifying LiquidityHub...");
  try {
    await hre.run("verify:verify", {
      address: await liquidityHub.getAddress(),
      constructorArguments: [
        await liquidityHubAdmin.getAddress(),
        mockUSDT
      ],
    });
  } catch (error) {
    console.error("Error verifying LiquidityHub:", error);
  }

  console.log("Deployment and verification completed!");

  // Update .env.local with the new LiquidityHub and LiquidityHubAdmin addresses
  const liquidityHubAddress = await liquidityHub.getAddress();
  const liquidityHubAdminAddress = await liquidityHubAdmin.getAddress();
  const fs = require('fs');
  const envPath = './frontend/.env.local';
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Replace the LiquidityHub address
  envContent = envContent.replace(
    /NEXT_PUBLIC_LIQUIDITY_HUB_ADDRESS=.*/,
    `NEXT_PUBLIC_LIQUIDITY_HUB_ADDRESS=${liquidityHubAddress}`
  );
  
  // Replace the LiquidityHubAdmin address
  envContent = envContent.replace(
    /NEXT_PUBLIC_LIQUIDITY_HUB_ADMIN_ADDRESS=.*/,
    `NEXT_PUBLIC_LIQUIDITY_HUB_ADMIN_ADDRESS=${liquidityHubAdminAddress}`
  );
  
  fs.writeFileSync(envPath, envContent);
  console.log(`Updated ${envPath} with new LiquidityHub address:`, liquidityHubAddress);
  console.log(`Updated ${envPath} with new LiquidityHubAdmin address:`, liquidityHubAdminAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
