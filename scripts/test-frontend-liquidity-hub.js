const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Testing Frontend Integration with LiquidityHub...');
  
  // Get contract addresses from .env.local
  const envPath = './frontend/.env.local';
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Extract LiquidityHub address
  const liquidityHubAddressMatch = envContent.match(/NEXT_PUBLIC_LIQUIDITY_HUB_ADDRESS=([^\s]+)/);
  const liquidityHubAddress = liquidityHubAddressMatch ? liquidityHubAddressMatch[1] : null;
  
  // Extract LiquidityHubAdmin address
  const liquidityHubAdminAddressMatch = envContent.match(/NEXT_PUBLIC_LIQUIDITY_HUB_ADMIN_ADDRESS=([^\s]+)/);
  const liquidityHubAdminAddress = liquidityHubAdminAddressMatch ? liquidityHubAdminAddressMatch[1] : null;
  
  // Extract USDT address
  const usdtAddressMatch = envContent.match(/NEXT_PUBLIC_USDT_ADDRESS=([^\s]+)/);
  const usdtAddress = usdtAddressMatch ? usdtAddressMatch[1] : null;
  
  // Extract NFT Factory address
  const nftFactoryAddressMatch = envContent.match(/NEXT_PUBLIC_NFT_FACTORY_ADDRESS=([^\s]+)/);
  const nftFactoryAddress = nftFactoryAddressMatch ? nftFactoryAddressMatch[1] : null;
  
  console.log(`LiquidityHub Address: ${liquidityHubAddress}`);
  console.log(`LiquidityHubAdmin Address: ${liquidityHubAdminAddress}`);
  console.log(`USDT Address: ${usdtAddress}`);
  console.log(`NFT Factory Address: ${nftFactoryAddress}`);
  
  try {
    // Get the ABI from the artifacts
    const liquidityHubArtifact = require('../artifacts/contracts/LiquidityHub.sol/LiquidityHub.json');
    const liquidityHubAbi = liquidityHubArtifact.abi;
    
    const usdtArtifact = require('../artifacts/contracts/mocks/MockUSDT.sol/MockUSDT.json');
    const usdtAbi = usdtArtifact.abi;
    
    const nftFactoryArtifact = require('../artifacts/contracts/RealEstateNFTFactory.sol/RealEstateNFTFactory.json');
    const nftFactoryAbi = nftFactoryArtifact.abi;
    
    // Connect to the contracts
    const [deployer] = await ethers.getSigners();
    console.log(`Testing with account: ${deployer.address}`);
    
    const liquidityHub = new ethers.Contract(liquidityHubAddress, liquidityHubAbi, deployer);
    const usdt = new ethers.Contract(usdtAddress, usdtAbi, deployer);
    const nftFactory = new ethers.Contract(nftFactoryAddress, nftFactoryAbi, deployer);
    
    // 1. Test contract parameters
    console.log('\n1. Testing contract parameters:');
    
    const borrowingLimit = await liquidityHub.getBorrowingLimit();
    console.log(`Borrowing Limit: ${Number(borrowingLimit) / 100}%`);
    
    const defaultThreshold = await liquidityHub.getDefaultThreshold();
    console.log(`Default Threshold: ${Number(defaultThreshold) / 100}%`);
    
    const lendingAPY = await liquidityHub.getLendingAPY();
    console.log(`Lending APY: ${Number(lendingAPY) / 100}%`);
    
    const borrowingAPY = await liquidityHub.getBorrowingAPY();
    console.log(`Borrowing APY: ${Number(borrowingAPY) / 100}%`);
    
    const withdrawalFee = await liquidityHub.getWithdrawalFee();
    console.log(`Withdrawal Fee: ${Number(withdrawalFee) / 100}%`);
    
    const paused = await liquidityHub.paused();
    console.log(`Paused: ${paused}`);
    
    // 2. Test USDT balance and approval
    console.log('\n2. Testing USDT balance and approval:');
    
    const usdtBalance = await usdt.balanceOf(deployer.address);
    console.log(`USDT Balance: ${ethers.formatUnits(usdtBalance, 6)} USDT`);
    
    const usdtAllowance = await usdt.allowance(deployer.address, liquidityHubAddress);
    console.log(`USDT Allowance for LiquidityHub: ${ethers.formatUnits(usdtAllowance, 6)} USDT`);
    
    // 3. Test NFT ownership
    console.log('\n3. Testing NFT ownership:');
    
    // Get all NFT collections from the factory
    try {
      const collectionCount = await nftFactory.collectionCount();
      console.log(`Total NFT Collections: ${collectionCount}`);
      
      if (Number(collectionCount) > 0) {
        for (let i = 0; i < Number(collectionCount); i++) {
          const collectionAddress = await nftFactory.collections(i);
          console.log(`Collection ${i + 1}: ${collectionAddress}`);
          
          // Get the NFT contract
          const nftArtifact = require('../artifacts/contracts/RealEstateNFT.sol/RealEstateNFT.json');
          const nftAbi = nftArtifact.abi;
          const nft = new ethers.Contract(collectionAddress, nftAbi, deployer);
          
          // Get collection info
          const collectionInfo = await nft.getCollectionInfo();
          console.log(`  Price per NFT: ${ethers.formatUnits(collectionInfo[0], 6)} USDT`);
          console.log(`  Max Supply: ${collectionInfo[1]}`);
          console.log(`  Current Supply: ${collectionInfo[2]}`);
          console.log(`  Project URI: ${collectionInfo[3]}`);
          console.log(`  Paused: ${collectionInfo[4]}`);
          
          // Check NFT balance
          const nftBalance = await nft.balanceOf(deployer.address);
          console.log(`  NFT Balance: ${nftBalance}`);
          
          // List owned NFTs
          if (Number(nftBalance) > 0) {
            console.log('  Owned NFTs:');
            for (let j = 0; j < Number(nftBalance); j++) {
              try {
                const tokenId = await nft.tokenOfOwnerByIndex(deployer.address, j);
                console.log(`    Token ID: ${tokenId}`);
                
                // Check if NFT is approved for LiquidityHub
                const approved = await nft.isApprovedForAll(deployer.address, liquidityHubAddress);
                console.log(`    Approved for LiquidityHub: ${approved}`);
              } catch (error) {
                console.log(`    Error getting token at index ${j}: ${error.message}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`Error getting NFT collections: ${error.message}`);
    }
    
    // 4. Test borrower position
    console.log('\n4. Testing borrower position:');
    
    const borrowedAmount = await liquidityHub.getBorrowerBorrowedAmount(deployer.address);
    console.log(`Borrowed Amount: ${ethers.formatUnits(borrowedAmount, 6)} USDT`);
    
    const totalCollateralValue = await liquidityHub.getBorrowerTotalCollateralValue(deployer.address);
    console.log(`Total Collateral Value: ${ethers.formatUnits(totalCollateralValue, 6)} USDT`);
    
    const lastUpdateTime = await liquidityHub.getBorrowerLastUpdateTime(deployer.address);
    if (Number(lastUpdateTime) > 0) {
      console.log(`Last Update Time: ${new Date(Number(lastUpdateTime) * 1000).toISOString()}`);
    } else {
      console.log(`Last Update Time: Not set`);
    }
    
    // 5. Test collateral NFTs
    console.log('\n5. Testing collateral NFTs:');
    
    const collateralNFTs = await liquidityHub.getBorrowerCollateralNFTs(deployer.address);
    console.log(`Number of Collateral NFTs: ${collateralNFTs.length}`);
    
    if (collateralNFTs.length > 0) {
      console.log('Collateral NFT details:');
      for (let i = 0; i < collateralNFTs.length; i++) {
        console.log(`NFT ${i + 1}:`);
        console.log(`  Collection: ${collateralNFTs[i].collection}`);
        console.log(`  Token ID: ${collateralNFTs[i].tokenId.toString()}`);
      }
    }
    
    // 6. Test loan health
    console.log('\n6. Testing loan health:');
    
    const loanHealth = await liquidityHub.getLoanHealth(deployer.address);
    console.log(`Loan Health: ${Number(loanHealth) / 100}%`);
    
    const totalOwed = await liquidityHub.getTotalOwed(deployer.address);
    console.log(`Total Owed: ${ethers.formatUnits(totalOwed, 6)} USDT`);
    
    console.log('\nFrontend integration testing completed!');
  } catch (error) {
    console.error('Error during testing:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
