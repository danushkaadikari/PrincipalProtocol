// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RealEstateNFT is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable factory;
    address public immutable usdtToken;
    uint256 public immutable pricePerNFT;
    uint256 public immutable maxSupply;
    uint256 public currentTokenId;
    string public projectURI;
    bool public paused;

    event NFTMinted(address indexed to, uint256 tokenId);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event Paused(bool _paused);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory can call");
        _;
    }

    modifier onlySuperAdmin() {
        require(msg.sender == IFactory(factory).getSuperAdmin(), "Only super admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused && !IFactory(factory).isPaused(), "Minting is paused");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _usdtToken,
        uint256 _pricePerNFT,
        uint256 _maxSupply,
        string memory _projectURI
    ) ERC721(_name, _symbol) {
        factory = msg.sender;
        usdtToken = _usdtToken;
        pricePerNFT = _pricePerNFT;
        maxSupply = _maxSupply;
        projectURI = _projectURI;
    }

    function mint(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(currentTokenId + amount <= maxSupply, "Would exceed max supply");
        
        uint256 totalCost = pricePerNFT * amount;
        
        // Transfer USDT from user using SafeERC20
        IERC20(usdtToken).safeTransferFrom(msg.sender, address(this), totalCost);

        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = currentTokenId + 1;
            _safeMint(msg.sender, tokenId);
            currentTokenId = tokenId;
            emit NFTMinted(msg.sender, tokenId);
        }
    }

    function withdrawFunds() external onlySuperAdmin {
        uint256 balance = IERC20(usdtToken).balanceOf(address(this));
        require(balance > 0, "No funds to withdraw");

        // Transfer USDT to admin using SafeERC20
        IERC20(usdtToken).safeTransfer(msg.sender, balance);

        emit FundsWithdrawn(msg.sender, balance);
    }

    function _baseURI() internal view override returns (string memory) {
        return projectURI;
    }

    function setPaused(bool _paused) external onlyFactory {
        paused = _paused;
        emit Paused(_paused);
    }

    function getCollectionInfo() external view returns (
        uint256 _pricePerNFT,
        uint256 _maxSupply,
        uint256 _currentSupply,
        string memory _projectURI,
        bool _paused,
        uint256 _balance
    ) {
        return (
            pricePerNFT,
            maxSupply,
            currentTokenId,
            projectURI,
            paused || IFactory(factory).isPaused(),
            IERC20(usdtToken).balanceOf(address(this))
        );
    }

    function getUserTokens(address user) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(user);
        uint256[] memory tokens = new uint256[](balance);
        uint256 index = 0;
        
        for (uint256 tokenId = 1; tokenId <= currentTokenId; tokenId++) {
            if (ownerOf(tokenId) == user) {
                tokens[index] = tokenId;
                index++;
            }
        }
        
        return tokens;
    }
}

interface IFactory {
    function getSuperAdmin() external view returns (address);
    function isPaused() external view returns (bool);
}
