const hre = require("hardhat");

async function main() {
  // Hardcoded NFT collection address to test
  const collectionAddress = "0x5B3be86BD4B37082FA7a26736a434bB5AfEa043C";
  console.log("Using hardcoded collection address:", collectionAddress);
  
  // Borrower address to check position details
  const borrowerAddress = "0xf156A66d3493Df9c07F945F7267f6A0d4bBaC7E0";
  console.log("Using borrower address:", borrowerAddress);

  // Use the deployed LiquidityHub contract address
  const liquidityHubAddress = "0x696a4A012fe476197B57e9a4bEb0A79eC0AD889E";
  
  // Connect to the deployed contract
  const LiquidityHub = await hre.ethers.getContractFactory("LiquidityHub");
  const liquidityHub = LiquidityHub.attach(liquidityHubAddress);
  
  console.log("Connected to LiquidityHub at:", liquidityHubAddress);
  console.log("Testing getNFTCollectionPrice for collection:", collectionAddress);
  
  try {
    // Call the getNFTCollectionPrice function
    const price = await liquidityHub.getNFTCollectionPrice(collectionAddress);
    
    console.log("NFT Collection Price (raw):", price.toString());
    
    // Convert to USDT (divide by 10^6)
    const priceInUSDT = parseFloat(price.toString()) / 1000000;
    console.log("NFT Collection Price (USDT):", priceInUSDT);
    
    // Also get the borrower's position if address is available
    if (borrowerAddress) {
      console.log("Checking borrower position for:", borrowerAddress);
      
      const position = await liquidityHub.borrowerPositions(borrowerAddress);
      console.log("Borrower Position:");
      console.log("- Total Collateral Value:", position.totalCollateralValue.toString());
      console.log("- Borrowed Amount:", position.borrowedAmount.toString());
      console.log("- Last Update Time:", position.lastUpdateTime.toString());
      
      // Calculate what totalValueToUnlock would be for unlocking the NFTs
      const nftCount = 5; // The user locked 5 NFTs
      
      // Manual multiplication for the expected total value
      const expectedTotalValue = BigInt(price.toString()) * BigInt(nftCount);
      console.log("Expected Total Value to Unlock for", nftCount, "NFTs:", expectedTotalValue.toString());
      
      // Check if this would cause underflow
      const positionValue = BigInt(position.totalCollateralValue.toString());
      if (expectedTotalValue > positionValue) {
        console.log("⚠️ UNDERFLOW WARNING: expectedTotalValue > totalCollateralValue");
        console.log("Difference:", (expectedTotalValue - positionValue).toString());
        console.log("This explains why unlockCollateral is failing with underflow error!");
      } else {
        console.log("✅ No underflow risk: expectedTotalValue <= totalCollateralValue");
      }
    }
    
  } catch (error) {
    console.error("Error getting NFT collection price:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
