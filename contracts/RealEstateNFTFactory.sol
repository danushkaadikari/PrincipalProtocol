// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RealEstateNFT.sol";
import "./AdminRegistry.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract RealEstateNFTFactory {
    using Address for address;
    
    AdminRegistry public immutable adminRegistry;
    address public immutable usdtToken;
    bool public paused;
    
    RealEstateNFT[] public collections;
    mapping(RealEstateNFT => bool) public isValidCollection;

    // Default to maximum values, can be altered by super admin according to business needs
    uint256 public maxAllowedPrice = type(uint256).max; // Default to maximum
    uint256 public maxAllowedSupply = type(uint256).max; // Default to maximum

    event CollectionCreated(
        address indexed collection,
        string name,
        string symbol,
        uint256 pricePerNFT,
        uint256 maxSupply,
        string projectURI
    );
    event MintingPaused(bool paused);
    event MaxAllowedPricePerNFTChanged(uint256 maxAllowedPrice);
    event MaxAllowedSupplyChanged(uint256 maxAllowedSupply);
    event CollectionPauseStateChanged(address indexed collection, bool paused);
    event BatchPauseProcessed(uint256 startIdx, uint256 endIdx, bool paused);
    event CollectionInvalidated(address indexed collection);
    event CollectionRevalidated(address indexed collection);

    modifier onlySuperAdmin() {
        require(msg.sender == adminRegistry.owner(), "Only super admin");
        _;
    }

    modifier onlyAdmin() {
        require(adminRegistry.isAdminOrSuperAdmin(msg.sender), "Only admin or super admin");
        _;
    }

    constructor(address _adminRegistry, address _usdtToken) {
        
        // Check for zero addresses
        require(_adminRegistry != address(0), "Admin registry cannot be zero address");
        require(_usdtToken != address(0), "USDT token cannot be zero address");
        
        // Check that addresses point to contracts
        require(_adminRegistry.isContract(), "Admin registry is not a contract");
        require(_usdtToken.isContract(), "USDT token is not a contract");

        adminRegistry = AdminRegistry(_adminRegistry);
        usdtToken = _usdtToken;
    }

    function createCollection(
        string memory name,
        string memory symbol,
        uint256 pricePerNFT,
        uint256 maxSupply,
        string memory projectURI
    ) external onlyAdmin returns (address) {
        require(pricePerNFT > 0, "Price per NFT must be greater than 0");
        require(maxSupply > 0, "Max supply must be greater than 0");
        require(pricePerNFT <= maxAllowedPrice, "Price per NFT exceeds max allowed price");
        require(maxSupply <= maxAllowedSupply, "Max supply exceeds max allowed supply");
        
        RealEstateNFT collection = new RealEstateNFT(
            name,
            symbol,
            usdtToken,
            pricePerNFT,
            maxSupply,
            projectURI
        );

        collections.push(collection);
        isValidCollection[collection] = true;

        emit CollectionCreated(
            address(collection),
            name,
            symbol,
            pricePerNFT,
            maxSupply,
            projectURI
        );

        return address(collection);
    }

    /**
     * @notice Sets the global pause state and updates the first batch of collections
     * @param _paused New pause state
     */
    function setPaused(bool _paused) external onlySuperAdmin {
        paused = _paused;
        emit MintingPaused(_paused);
        
        // Process first batch if collections exist
        if (collections.length > 0) {
            // Process up to 50 collections to avoid gas limit issues
            uint256 batchSize = 50;
            uint256 endIdx = collections.length < batchSize ? collections.length : batchSize;
            
            // Update pause state for the first batch
            for (uint i = 0; i < endIdx; i++) {
                collections[i].setPaused(_paused);
            }
            
            emit BatchPauseProcessed(0, endIdx, _paused);
        }
    }
    
    /**
     * @notice Sets the pause state for a batch of collections
     * @param _paused New pause state
     * @param startIdx Starting index in the collections array
     * @param endIdx Ending index in the collections array (exclusive)
     */
    function setPausedBatch(bool _paused, uint256 startIdx, uint256 endIdx) external onlySuperAdmin {
        require(startIdx < collections.length, "Start index out of bounds");
        require(endIdx <= collections.length, "End index out of bounds");
        require(startIdx < endIdx, "Start must be < end");
        
        // Process the specified batch of collections
        for (uint i = startIdx; i < endIdx; i++) {
            collections[i].setPaused(_paused);
        }
        
        emit BatchPauseProcessed(startIdx, endIdx, _paused);
    }
    
    /**
     * @notice Sets the pause state for a specific collection
     * @param collectionIndex Index of the collection in the collections array
     * @param _paused New pause state
     */
    function setPausedForCollection(uint256 collectionIndex, bool _paused) external onlySuperAdmin {
        require(collectionIndex < collections.length, "Collection index out of bounds");
        
        collections[collectionIndex].setPaused(_paused);
        emit CollectionPauseStateChanged(address(collections[collectionIndex]), _paused);
    }

    function getCollections() external view returns (RealEstateNFT[] memory) {
        return collections;
    }

    function getSuperAdmin() external view returns (address) {
        return adminRegistry.owner();
    }

    function isPaused() external view returns (bool) {
        return paused;
    }

    function setMaxAllowedPrice(uint256 _maxAllowedPrice) external onlySuperAdmin {
        maxAllowedPrice = _maxAllowedPrice;
        emit MaxAllowedPricePerNFTChanged(_maxAllowedPrice);
    }

    function setMaxAllowedSupply(uint256 _maxAllowedSupply) external onlySuperAdmin {
        maxAllowedSupply = _maxAllowedSupply;
        emit MaxAllowedSupplyChanged(_maxAllowedSupply);
    }

    /**
     * @notice Invalidates a collection by removing it from the isValidCollection mapping
     * @param collectionAddress Address of the collection to invalidate
     */
    function invalidateCollection(address collectionAddress) external onlySuperAdmin {
        require(address(collectionAddress) != address(0), "Invalid collection address");
        
        // Find the collection in our array to verify it exists
        bool found = false;
        for (uint i = 0; i < collections.length; i++) {
            if (address(collections[i]) == collectionAddress) {
                found = true;
                // Remove from isValidCollection mapping
                isValidCollection[collections[i]] = false;
                break;
            }
        }
        
        require(found, "Collection not found");
        emit CollectionInvalidated(collectionAddress);
    }

    /**
     * @notice Revalidates a previously invalidated collection
     * @param collectionAddress Address of the collection to revalidate
     */
    function revalidateCollection(address collectionAddress) external onlySuperAdmin {
        require(address(collectionAddress) != address(0), "Invalid collection address");
        
        // Find the collection in our array to verify it exists
        bool found = false;
        for (uint i = 0; i < collections.length; i++) {
            if (address(collections[i]) == collectionAddress) {
                found = true;
                // Add back to isValidCollection mapping
                isValidCollection[collections[i]] = true;
                break;
            }
        }
        
        require(found, "Collection not found");
        emit CollectionRevalidated(collectionAddress);
    }
}