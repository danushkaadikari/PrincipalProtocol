// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockNFT is ERC721 {
    uint256 private _pricePerNFT = 1000e6; // 1000 USDT
    uint256 private constant MAX_SUPPLY = 1000;
    uint256 private _currentSupply = 0;
    bool private _paused = false;
    uint256 private _balance = 0;

    constructor() ERC721("Mock NFT", "MNFT") {}

    function mint(address to) external {
        require(_currentSupply < MAX_SUPPLY, "Max supply reached");
        _mint(to, _currentSupply);
        _currentSupply++;
    }

    function getCollectionInfo() external view returns (
        uint256 pricePerNFT,
        uint256 maxSupply,
        uint256 currentSupply,
        string memory projectURI,
        bool paused,
        uint256 balance
    ) {
        return (
            _pricePerNFT,
            MAX_SUPPLY,
            _currentSupply,
            "",
            _paused,
            _balance
        );
    }

    function setCollectionInfo(
        uint256 pricePerNFT_,
        uint256 maxSupply_,
        uint256 currentSupply_,
        string memory projectURI_,
        bool paused_,
        uint256 balance_
    ) external {
        _pricePerNFT = pricePerNFT_;
        _paused = paused_;
        _balance = balance_;
    }
}
