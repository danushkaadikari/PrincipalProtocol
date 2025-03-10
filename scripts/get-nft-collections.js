const { ethers } = require('hardhat');
const fs = require('fs');

async function main() {
  console.log('Getting NFT Collections...');
  
  // Get the NFT Factory address from .env.local
  const envPath = './frontend/.env.local';
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const nftFactoryAddressMatch = envContent.match(/NEXT_PUBLIC_NFT_FACTORY_ADDRESS=([^\s]+)/);
  const nftFactoryAddress = nftFactoryAddressMatch ? nftFactoryAddressMatch[1] : null;
  
  console.log(`NFT Factory Address: ${nftFactoryAddress}`);
  
  try {
    // Connect to the NFT Factory contract
    const [deployer] = await ethers.getSigners();
    console.log(`Using account: ${deployer.address}`);
    
    // Get the NFT Factory contract
    const nftFactoryArtifact = require('../artifacts/contracts/RealEstateNFTFactory.sol/RealEstateNFTFactory.json');
    const nftFactory = new ethers.Contract(nftFactoryAddress, nftFactoryArtifact.abi, deployer);
    
    // List all available functions
    console.log('\nAvailable functions in NFT Factory:');
    const functionNames = nftFactoryArtifact.abi
      .filter(item => item.type === 'function')
      .map(item => item.name);
    console.log(functionNames.join(', '));
    
    // Try to get collections
    console.log('\nTrying to get collections:');
    
    // Try different methods to get collections
    try {
      const owner = await nftFactory.owner();
      console.log(`NFT Factory Owner: ${owner}`);
    } catch (error) {
      console.log(`Error getting owner: ${error.message}`);
    }
    
    // Try to get a collection at index 0
    try {
      const collection0 = await nftFactory.collections(0);
      console.log(`Collection at index 0: ${collection0}`);
      
      // If we got a collection, try to get more
      let index = 1;
      let collections = [collection0];
      
      while (true) {
        try {
          const collection = await nftFactory.collections(index);
          console.log(`Collection at index ${index}: ${collection}`);
          collections.push(collection);
          index++;
        } catch (error) {
          console.log(`No more collections after index ${index - 1}`);
          break;
        }
      }
      
      console.log(`\nFound ${collections.length} collections`);
      
      // Get details for each collection
      for (let i = 0; i < collections.length; i++) {
        const collectionAddress = collections[i];
        console.log(`\nCollection ${i + 1}: ${collectionAddress}`);
        
        // Get the NFT contract
        const nftArtifact = require('../artifacts/contracts/RealEstateNFT.sol/RealEstateNFT.json');
        const nft = new ethers.Contract(collectionAddress, nftArtifact.abi, deployer);
        
        // Get collection info
        try {
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
                
                // Get token URI
                const tokenURI = await nft.tokenURI(tokenId);
                console.log(`    Token URI: ${tokenURI}`);
              } catch (error) {
                console.log(`    Error getting token at index ${j}: ${error.message}`);
              }
            }
          }
        } catch (error) {
          console.log(`  Error getting collection info: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`Error getting collection at index 0: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
