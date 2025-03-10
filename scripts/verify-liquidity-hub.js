const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Verifying LiquidityHub contract...');
  
  const contractAddress = '0x922d1C437887A4D7684024aA4436770EE58D28ee';
  console.log(`Contract address: ${contractAddress}`);
  
  try {
    // Get the ABI from the artifacts
    const liquidityHubArtifact = require('../artifacts/contracts/LiquidityHub.sol/LiquidityHub.json');
    const abi = liquidityHubArtifact.abi;
    
    // Connect to the contract
    const [deployer] = await ethers.getSigners();
    const liquidityHub = new ethers.Contract(contractAddress, abi, deployer);
    
    // Verify basic contract parameters
    console.log('\nVerifying contract parameters:');
    
    try {
      const borrowingLimit = await liquidityHub.borrowingLimit();
      console.log(`Borrowing Limit: ${borrowingLimit / 100}%`);
    } catch (error) {
      console.log(`Error getting borrowingLimit: ${error.message}`);
    }
    
    try {
      const defaultThreshold = await liquidityHub.defaultThreshold();
      console.log(`Default Threshold: ${defaultThreshold / 100}%`);
    } catch (error) {
      console.log(`Error getting defaultThreshold: ${error.message}`);
    }
    
    try {
      const lendingAPY = await liquidityHub.lendingAPY();
      console.log(`Lending APY: ${lendingAPY / 100}%`);
    } catch (error) {
      console.log(`Error getting lendingAPY: ${error.message}`);
    }
    
    try {
      const borrowingAPY = await liquidityHub.borrowingAPY();
      console.log(`Borrowing APY: ${borrowingAPY / 100}%`);
    } catch (error) {
      console.log(`Error getting borrowingAPY: ${error.message}`);
    }
    
    try {
      const withdrawalFee = await liquidityHub.withdrawalFee();
      console.log(`Withdrawal Fee: ${withdrawalFee / 100}%`);
    } catch (error) {
      console.log(`Error getting withdrawalFee: ${error.message}`);
    }
    
    try {
      const paused = await liquidityHub.paused();
      console.log(`Paused: ${paused}`);
    } catch (error) {
      console.log(`Error getting paused: ${error.message}`);
    }
    
    // Get admin address
    try {
      const adminRegistry = await liquidityHub.adminRegistry();
      console.log(`Admin Registry: ${adminRegistry}`);
    } catch (error) {
      console.log(`Error getting adminRegistry: ${error.message}`);
    }
    
    // Get USDT address
    try {
      const usdt = await liquidityHub.usdt();
      console.log(`USDT: ${usdt}`);
    } catch (error) {
      console.log(`Error getting usdt: ${error.message}`);
    }
    
    // Get NFT factory address
    try {
      const nftFactory = await liquidityHub.nftFactory();
      console.log(`NFT Factory: ${nftFactory}`);
    } catch (error) {
      console.log(`Error getting nftFactory: ${error.message}`);
    }
    
    // Verify CollateralNFT struct handling
    console.log('\nVerifying CollateralNFT struct handling:');
    
    // Try to get a borrower's collateral NFTs if any exist
    console.log(`Checking borrower position for: ${deployer.address}`);
    
    try {
      const borrowerPosition = await liquidityHub.borrowerPositions(deployer.address);
      console.log(`Borrowed Amount: ${ethers.utils.formatUnits(borrowerPosition.borrowedAmount || 0, 6)} USDT`);
      console.log(`Total Collateral Value: ${ethers.utils.formatUnits(borrowerPosition.totalCollateralValue || 0, 6)} USDT`);
      
      if (borrowerPosition.lastUpdateTime) {
        console.log(`Last Update Time: ${new Date(borrowerPosition.lastUpdateTime.toNumber() * 1000).toISOString()}`);
      } else {
        console.log(`Last Update Time: Not set`);
      }
    } catch (error) {
      console.log(`Error getting borrowerPosition: ${error.message}`);
    }
    
    try {
      const collateralNFTs = await liquidityHub.getBorrowerCollateralNFTs(deployer.address);
      console.log(`Number of Collateral NFTs: ${collateralNFTs.length}`);
      
      if (collateralNFTs.length > 0) {
        console.log('\nCollateral NFT details:');
        for (let i = 0; i < collateralNFTs.length; i++) {
          console.log(`NFT ${i + 1}:`);
          console.log(`  Collection: ${collateralNFTs[i].collection}`);
          console.log(`  Token ID: ${collateralNFTs[i].tokenId.toString()}`);
        }
      }
    } catch (error) {
      console.log(`Error getting collateralNFTs: ${error.message}`);
    }
    
    // List all functions in the contract
    console.log('\nListing all functions in the contract:');
    const functionNames = abi
      .filter(item => item.type === 'function')
      .map(item => item.name);
    
    console.log(functionNames.join(', '));
    
    console.log('\nVerification completed!');
  } catch (error) {
    console.error('Error during verification:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
