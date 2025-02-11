// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RealEstateNFT.sol";
import "./AdminRegistry.sol";

contract RealEstateNFTFactory {
    AdminRegistry public immutable adminRegistry;
    address public immutable usdtToken;
    bool public paused;
    
    RealEstateNFT[] public collections;
    mapping(RealEstateNFT => bool) public isValidCollection;

    event CollectionCreated(
        address indexed collection,
        string name,
        string symbol,
        uint256 pricePerNFT,
        uint256 maxSupply,
        string projectURI
    );
    event MintingPaused(bool paused);

    modifier onlySuperAdmin() {
        require(msg.sender == adminRegistry.owner(), "Only super admin");
        _;
    }

    modifier onlyAdmin() {
        require(adminRegistry.isAdminOrSuperAdmin(msg.sender), "Only admin or super admin");
        _;
    }

    constructor(address _adminRegistry, address _usdtToken) {
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

    function setPaused(bool _paused) external onlySuperAdmin {
        paused = _paused;
        emit MintingPaused(_paused);

        // Update pause state for all collections
        for (uint i = 0; i < collections.length; i++) {
            collections[i].setPaused(_paused);
        }
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
}
