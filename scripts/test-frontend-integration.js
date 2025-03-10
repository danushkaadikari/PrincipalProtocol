const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Testing Frontend Integration with LiquidityHub...');
  
  const contractAddress = '0x922d1C437887A4D7684024aA4436770EE58D28ee';
  console.log(`Contract address: ${contractAddress}`);
  
  try {
    // Get the ABI from the artifacts
    const liquidityHubArtifact = require('../artifacts/contracts/LiquidityHub.sol/LiquidityHub.json');
    const abi = liquidityHubArtifact.abi;
    
    // Connect to the contract
    const [deployer] = await ethers.getSigners();
    const liquidityHub = new ethers.Contract(contractAddress, abi, deployer);
    
    console.log(`Connected to LiquidityHub contract as: ${deployer.address}`);
    
    // Test frontend integration functions
    console.log('\nTesting frontend integration functions:');
    
    // 1. Test getBorrowingLimit
    try {
      const borrowingLimit = await liquidityHub.getBorrowingLimit();
      console.log(`Borrowing Limit: ${Number(borrowingLimit) / 100}%`);
    } catch (error) {
      console.log(`Error getting borrowingLimit: ${error.message}`);
    }
    
    // 2. Test getDefaultThreshold
    try {
      const defaultThreshold = await liquidityHub.getDefaultThreshold();
      console.log(`Default Threshold: ${Number(defaultThreshold) / 100}%`);
    } catch (error) {
      console.log(`Error getting defaultThreshold: ${error.message}`);
    }
    
    // 3. Test getLendingAPY
    try {
      const lendingAPY = await liquidityHub.getLendingAPY();
      console.log(`Lending APY: ${Number(lendingAPY) / 100}%`);
    } catch (error) {
      console.log(`Error getting lendingAPY: ${error.message}`);
    }
    
    // 4. Test getBorrowingAPY
    try {
      const borrowingAPY = await liquidityHub.getBorrowingAPY();
      console.log(`Borrowing APY: ${Number(borrowingAPY) / 100}%`);
    } catch (error) {
      console.log(`Error getting borrowingAPY: ${error.message}`);
    }
    
    // 5. Test getWithdrawalFee
    try {
      const withdrawalFee = await liquidityHub.getWithdrawalFee();
      console.log(`Withdrawal Fee: ${Number(withdrawalFee) / 100}%`);
    } catch (error) {
      console.log(`Error getting withdrawalFee: ${error.message}`);
    }
    
    // 6. Test paused
    try {
      const paused = await liquidityHub.paused();
      console.log(`Paused: ${paused}`);
    } catch (error) {
      console.log(`Error getting paused: ${error.message}`);
    }
    
    // 7. Test getBorrowerBorrowedAmount
    try {
      const borrowedAmount = await liquidityHub.getBorrowerBorrowedAmount(deployer.address);
      console.log(`Borrowed Amount: ${ethers.formatUnits(borrowedAmount, 6)} USDT`);
    } catch (error) {
      console.log(`Error getting borrowedAmount: ${error.message}`);
    }
    
    // 8. Test getBorrowerTotalCollateralValue
    try {
      const totalCollateralValue = await liquidityHub.getBorrowerTotalCollateralValue(deployer.address);
      console.log(`Total Collateral Value: ${ethers.formatUnits(totalCollateralValue, 6)} USDT`);
    } catch (error) {
      console.log(`Error getting totalCollateralValue: ${error.message}`);
    }
    
    // 9. Test getBorrowerLastUpdateTime
    try {
      const lastUpdateTime = await liquidityHub.getBorrowerLastUpdateTime(deployer.address);
      if (Number(lastUpdateTime) > 0) {
        console.log(`Last Update Time: ${new Date(Number(lastUpdateTime) * 1000).toISOString()}`);
      } else {
        console.log(`Last Update Time: Not set`);
      }
    } catch (error) {
      console.log(`Error getting lastUpdateTime: ${error.message}`);
    }
    
    // 10. Test getBorrowerCollateralNFTs
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
    
    // 11. Test getLoanHealth
    try {
      const loanHealth = await liquidityHub.getLoanHealth(deployer.address);
      console.log(`Loan Health: ${Number(loanHealth) / 100}%`);
    } catch (error) {
      console.log(`Error getting loanHealth: ${error.message}`);
    }
    
    // 12. Test getTotalOwed
    try {
      const totalOwed = await liquidityHub.getTotalOwed(deployer.address);
      console.log(`Total Owed: ${ethers.formatUnits(totalOwed, 6)} USDT`);
    } catch (error) {
      console.log(`Error getting totalOwed: ${error.message}`);
    }
    
    console.log('\nTesting completed!');
    
    // Check if the contract has the CollateralNFT struct
    console.log('\nVerifying CollateralNFT struct:');
    const contractCode = await ethers.provider.getCode(contractAddress);
    
    if (contractCode.includes('struct CollateralNFT')) {
      console.log('CollateralNFT struct found in the contract code!');
    } else {
      console.log('CollateralNFT struct not found in the contract code. This is expected as bytecode does not contain struct definitions.');
    }
    
    console.log('\nVerification of frontend integration functions completed!');
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
