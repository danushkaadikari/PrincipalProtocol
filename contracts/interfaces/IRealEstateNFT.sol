// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRealEstateNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function getCollectionInfo() external view returns (
        uint256 _pricePerNFT,
        uint256 _maxSupply,
        uint256 _currentSupply,
        string memory _projectURI,
        bool _paused,
        uint256 _balance
    );
}
