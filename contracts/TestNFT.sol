// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestNFT
 * @dev Simple NFT contract for testing LiquidityHub
 */
contract TestNFT is ERC721, Ownable {
    uint256 private _nextTokenId;

    constructor(
        string memory name, 
        string memory symbol
    ) ERC721(name, symbol) Ownable() {}

    function mint(address to, uint256 tokenId) public onlyOwner {
        _safeMint(to, tokenId);
        if (tokenId >= _nextTokenId) {
            _nextTokenId = tokenId + 1;
        }
    }

    // Function for IRealEstateNFT compatibility
    function getCollectionInfo() external view returns (
        uint256 price,
        uint256 maxSupply,
        uint256 currentSupply,
        string memory projectURI,
        bool paused,
        uint256 balance
    ) {
        // Return fixed values for testing
        return (
            600 * 10**6, // 600 USDT with 6 decimals
            1000,        // maxSupply
            _nextTokenId, // currentSupply
            "",         // projectURI
            false,       // paused
            0            // balance
        );
    }
}
