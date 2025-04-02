// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
interface ILiquidityHub {
    function borrowerPositions(address borrower) external view returns (
        uint256[] memory collateralNFTs,
        uint256 borrowedAmount,
        uint256 lastUpdateTime,
        uint256 totalCollateralValue
    );
    function setNFTLockStatus(address nftContract, uint256 tokenId, bool status) external;
    function clearBorrowerPosition(address borrower) external;
    function setRealEstateNFTFactory(address _factory) external;
}

interface IInterestRateModel {
    function calculateInterest(
        uint256 principal,
        uint256 lastUpdateTime,
        uint256 currentTime,
        uint256 apy
    ) external pure returns (uint256);

    function calculateUtilizationRate(
        uint256 totalBorrowed,
        uint256 totalDeposited
    ) external pure returns (uint256);

    function calculateBorrowRate(uint256 utilization) external pure returns (uint256);
    function calculateLendRate(uint256 utilization) external pure returns (uint256);
}

contract LiquidityHubAdmin is Ownable2Step, Pausable, ReentrancyGuard {
    IInterestRateModel public immutable interestRateModel;
    address public liquidityHubAddress;

    // Configuration
    uint256 public borrowingLimit;     // 40% initially (4000 basis points)
    uint256 public defaultThreshold;   // 50% initially (5000 basis points)
    uint256 public lendingAPY;        // Stored in basis points (1 bp = 0.01%)
    uint256 public borrowingAPY;      // Stored in basis points (1 bp = 0.01%)
    uint256 public withdrawalFee;      // Stored in basis points
    bool public useDynamicRates;      // Whether to use dynamic interest rates
    address public treasuryWallet;    // Address where protocol fees are sent

    // Events
    event APYUpdated(uint256 lendingAPY, uint256 borrowingAPY);
    event WithdrawalFeeUpdated(uint256 newFee);
    event RealEstateNFTFactorySet(address indexed factory);
    event BorrowingLimitUpdated(uint256 newLimit);
    event DefaultThresholdUpdated(uint256 newThreshold);
    event EmergencyPauseToggled(bool isPaused);
    event DynamicRatesToggled(bool isEnabled);
    event TreasuryWalletUpdated(address newTreasuryWallet);
    event LoanDefaulted(address indexed borrower, uint256[] tokenIds);
    event LiquidityHubAddressSet(address indexed liquidityHubAddress);
    event setEmergencyPause(bool isPaused);

    constructor(address _interestRateModel) {
        require(_interestRateModel != address(0), "Invalid interest rate model");
        interestRateModel = IInterestRateModel(_interestRateModel);

        // Initialize with default values
        borrowingLimit = 4000;     // 40% (4000 basis points)
        defaultThreshold = 5000;   // 50% (5000 basis points)
        lendingAPY = 300;         // 3% (300 basis points)
        borrowingAPY = 600;       // 6% (600 basis points)
        withdrawalFee = 0;        // 0% initially
        useDynamicRates = false;  // Use fixed rates by default

        emit APYUpdated(lendingAPY, borrowingAPY);
    }
    modifier onlyAdmin() {
        require(owner() == msg.sender, "Not authorized");
        _;
    }

    function toggleDynamicRates() external onlyAdmin {
        useDynamicRates = !useDynamicRates;
        emit DynamicRatesToggled(useDynamicRates);
    }

    /**
     * @notice Set the lending APY (only when dynamic rates are disabled)
     * @param newAPY New lending APY in basis points
     */
    function setLendingAPY(uint256 newAPY) external onlyAdmin {
        require(newAPY >= 50, "APY too low"); // Min 0.5% (50 basis points)
        require(newAPY <= 20000, "APY too high"); // Max 200% (20000 basis points)
        lendingAPY = newAPY;
        emit APYUpdated(lendingAPY, borrowingAPY);
    }
    
    /**
     * @notice Set the borrowing APY (only when dynamic rates are disabled)
     * @param newAPY New borrowing APY in basis points
     */
    function setBorrowingAPY(uint256 newAPY) external onlyAdmin {
        require(newAPY >= 100, "APY too low"); // Min 1% (100 basis points)
        require(newAPY <= 200000000, "APY too high"); // Max 2000000% (200000000 basis points)
        require(newAPY > lendingAPY, "Borrowing APY must be higher than lending APY");
        borrowingAPY = newAPY;
        emit APYUpdated(lendingAPY, borrowingAPY);
    }
    
    /**
     * @notice Set the withdrawal fee
     * @param newFee New withdrawal fee in basis points
     */
    function setWithdrawalFee(uint256 newFee) external onlyAdmin {
        // 0 as a valid business case (represents no withdrawal fee)
        require(newFee <= 10000, "Fee too high"); // Max 100% (10000 basis points)
        withdrawalFee = newFee;
        emit WithdrawalFeeUpdated(newFee);
    }
    
    /**
     * @notice Set the borrowing limit
     * @param newLimit New borrowing limit in basis points
     */
    function setBorrowingLimit(uint256 newLimit) external onlyAdmin {
        require(newLimit >= 1000, "Limit too low"); // Min 10% (1000 basis points)
        require(newLimit <= 8000, "Limit too high"); // Max 80% (8000 basis points)
        borrowingLimit = newLimit;
        emit BorrowingLimitUpdated(newLimit);
    }
    
    /**
     * @notice Set the default threshold
     * @param newThreshold New default threshold in basis points
     */
    function setDefaultThreshold(uint256 newThreshold) external onlyAdmin {
        require(newThreshold >= 2000, "Threshold too low"); // Min 20% (2000 basis points)
        require(newThreshold <= 8000, "Threshold too high"); // Max 80% (8000 basis points)
        defaultThreshold = newThreshold;
        emit DefaultThresholdUpdated(newThreshold);
    }

    function handleDefault(address borrower, address nftContract) external nonReentrant onlyAdmin {
        require(liquidityHubAddress != address(0), "LiquidityHub address not set");
        
        // Get borrower position from main contract
        (uint256[] memory collateralNFTs, uint256 borrowedAmount, uint256 lastUpdateTime, uint256 totalCollateralValue) = 
            ILiquidityHub(liquidityHubAddress).borrowerPositions(borrower);
        
        // Check if there is an outstanding loan with collateral
        require(borrowedAmount > 0, "No outstanding loan");
        require(collateralNFTs.length > 0, "No collateral");
        
        // Calculate current loan health
        uint256 interest = interestRateModel.calculateInterest(
            borrowedAmount,
            lastUpdateTime,
            block.timestamp,
            borrowingAPY
        );
        
        uint256 totalOwed = borrowedAmount + interest;
        uint256 loanHealth = (totalCollateralValue * 10000) / totalOwed; // Using basis points (10000 = 100%)
        
        require(loanHealth <= defaultThreshold, "Not in default");
        
        // Transfer all NFTs to treasury and update state
        for (uint256 i = 0; i < collateralNFTs.length; i++) {
            uint256 tokenId = collateralNFTs[i];
            // Update NFT lock status in main contract
            ILiquidityHub(liquidityHubAddress).setNFTLockStatus(nftContract, tokenId, false);
            IERC721(nftContract).safeTransferFrom(
                address(this),
                treasuryWallet,
                tokenId
            );
        }
        
        // Clear borrower position in main contract
        ILiquidityHub(liquidityHubAddress).clearBorrowerPosition(borrower);
        
        emit LoanDefaulted(borrower, collateralNFTs);
    }

    function toggleEmergencyPause() external onlyAdmin {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
        emit setEmergencyPause(paused());
    }
    
    /**
     * @notice Sets the address of the LiquidityHub contract
     * @param _liquidityHub Address of the LiquidityHub contract
     */
    function setLiquidityHubAddress(address _liquidityHub) external onlyOwner {
        require(_liquidityHub != address(0), "Invalid LiquidityHub address");
        liquidityHubAddress = _liquidityHub;
        emit LiquidityHubAddressSet(_liquidityHub);
    }
    
    /**
     * @notice Sets the address of the RealEstateNFTFactory in the LiquidityHub contract
     * @param _factory Address of the RealEstateNFTFactory contract
     */
    function setRealEstateNFTFactory(address _factory) external onlyOwner {
        require(liquidityHubAddress != address(0), "LiquidityHub address not set");
        require(_factory != address(0), "Invalid factory address");
        
        ILiquidityHub(liquidityHubAddress).setRealEstateNFTFactory(_factory);
        emit RealEstateNFTFactorySet(_factory);
    }

    // Dynamic rates getter
    function isDynamicRatesEnabled() external view returns (bool) {
        return useDynamicRates;
    }

    /**
     * @notice Set the treasury wallet address
     * @param newTreasuryWallet The new treasury wallet address
     */
    function setTreasuryWallet(address newTreasuryWallet) external onlyOwner {
        require(newTreasuryWallet != address(0), "Treasury wallet cannot be zero address");
        treasuryWallet = newTreasuryWallet;
        emit TreasuryWalletUpdated(newTreasuryWallet);
    }

    /**
     * @notice Get the treasury wallet address
     * @return The treasury wallet address
     */
    function getTreasuryWallet() external view returns (address) {
        return treasuryWallet;
    }
}
