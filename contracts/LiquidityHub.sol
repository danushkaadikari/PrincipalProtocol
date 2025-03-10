// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./LiquidityHubAdmin.sol";
import "./LiquidityHubStorage.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "hardhat/console.sol";

// Import custom interfaces
import "./interfaces/IRealEstateNFT.sol";

/**
 * @title LiquidityHub
 * @notice Main contract for the Principal Protocol's lending and borrowing functionality
 */
contract LiquidityHub is ReentrancyGuard, IERC721Receiver, LiquidityHubStorage {
    // Lender state
    struct LenderPosition {
        uint256 amount;
        uint256 lastUpdateTime;
        uint256 accumulatedInterest;
    }
    mapping(address => LenderPosition) public lenderPositions;
    
    // Borrower state
    struct CollateralNFT {
        address collection;
        uint256 tokenId;
    }
    
    struct BorrowerPosition {
        CollateralNFT[] collateralNFTs;
        uint256 borrowedAmount;
        uint256 lastUpdateTime;
        uint256 totalCollateralValue;
    }
    mapping(address => BorrowerPosition) public borrowerPositions;
    
    // NOTE: Protocol state variables are inherited from LiquidityHubStorage

    // Getter functions for borrower positions
    function getBorrowerCollateralNFTs(address borrower) public view returns (CollateralNFT[] memory) {
        return borrowerPositions[borrower].collateralNFTs;
    }

    function getBorrowerBorrowedAmount(address borrower) public view returns (uint256) {
        return borrowerPositions[borrower].borrowedAmount;
    }

    function getBorrowerLastUpdateTime(address borrower) public view returns (uint256) {
        return borrowerPositions[borrower].lastUpdateTime;
    }

    function getBorrowerTotalCollateralValue(address borrower) public view returns (uint256) {
        return borrowerPositions[borrower].totalCollateralValue;
    }

    // APY and configuration getters that read from admin contract
    function getLendingAPY() public view returns (uint256) {
        return admin.lendingAPY();
    }

    function getBorrowingAPY() public view returns (uint256) {
        return admin.borrowingAPY();
    }

    function getWithdrawalFee() public view returns (uint256) {
        return admin.withdrawalFee();
    }

    function getBorrowingLimit() public view returns (uint256) {
        return admin.borrowingLimit();
    }

    function getDefaultThreshold() public view returns (uint256) {
        return admin.defaultThreshold();
    }
    
    // Contract references
    // NOTE: Contract references are inherited from LiquidityHubStorage
    LiquidityHubAdmin public immutable admin;
    IInterestRateModel public immutable interestRateModel;

    // Events
    event Deposit(address indexed lender, uint256 amount);
    event Withdrawal(address indexed lender, uint256 amount, uint256 fee);
    event InterestHarvested(address indexed lender, uint256 amount);
    event CollateralLocked(address indexed borrower, CollateralNFT[] collateralNFTs);
    event CollateralUnlocked(address indexed borrower, CollateralNFT[] collateralNFTs);
    event PartialUnlock(address indexed borrower, CollateralNFT[] collateralNFTs, uint256 remainingCollateralValue, uint256 remainingBorrowedAmount);
    event Borrowed(address indexed borrower, uint256 amount);
    // @dev amount may exceed the actual debt if the user added a buffer to handle interest accrual
    event Repaid(address indexed borrower, uint256 amount);
    event LoanDefaulted(address indexed borrower, CollateralNFT[] collateralNFTs);
    event APYUpdated(uint256 lendingAPY, uint256 borrowingAPY);
    event LoanHealthChanged(address indexed borrower, uint256 health, string status);
    
    constructor(
        address _admin,
        address _usdtToken
    ) {
        require(_admin != address(0), "Invalid admin address");
        require(_usdtToken != address(0), "Invalid USDT address");
        
        admin = LiquidityHubAdmin(_admin);
        usdtToken = _usdtToken;
        interestRateModel = IInterestRateModel(admin.interestRateModel());
    }

    modifier whenNotPaused() {
        require(!admin.paused(), "Contract is paused");
        _;
    }
    




    modifier onlyBorrower() {
        BorrowerPosition storage position = borrowerPositions[msg.sender];
        require(
            position.collateralNFTs.length > 0 || position.totalCollateralValue > 0 || position.borrowedAmount > 0,
            "Not a borrower"
        );
        _;
    }
    
    /**
     * @notice Deposit USDT into the lending pool
     * @param amount Amount of USDT to deposit
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        // Calculate any pending interest before updating position
        _harvestInterest(msg.sender);
        
        // Update lender position (check-effects pattern)
        LenderPosition storage position = lenderPositions[msg.sender];
        uint256 newAmount = position.amount + amount;
        position.amount = newAmount;
        position.lastUpdateTime = block.timestamp;
        
        // Update total deposits
        totalDeposited += amount;
        
        // Transfer USDT from user (interactions last)
        require(
            IERC20(usdtToken).transferFrom(msg.sender, address(this), amount),
            "USDT transfer failed"
        );
        
        emit Deposit(msg.sender, amount);
    }
    
    /**
     * @notice Withdraw USDT from the lending pool
     * @param amount Amount of USDT to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        LenderPosition storage position = lenderPositions[msg.sender];
        
        require(amount > 0, "Amount must be greater than 0");
        require(position.amount >= amount, "Insufficient balance");
        
        // Calculate and harvest any pending interest first
        _harvestInterest(msg.sender);
        
        // Calculate withdrawal fee
        uint256 fee = (amount * getWithdrawalFee()) / 10000; // Using basis points (10000 = 100%)
        uint256 withdrawAmount = amount - fee;
        
        // Update state
        position.amount -= amount;
        totalDeposited -= amount;
        
        // Transfer USDT to user
        require(
            IERC20(usdtToken).transfer(msg.sender, withdrawAmount),
            "USDT transfer failed"
        );
        
        // Transfer fee to treasury if any
        if (fee > 0) {
            require(
                IERC20(usdtToken).transfer(admin.treasuryWallet(), fee),
                "Fee transfer failed"
            );
        }
        
        emit Withdrawal(msg.sender, withdrawAmount, fee);
    }
    
    /**
     * @notice Harvest accumulated interest
     */
    function harvestInterest() external nonReentrant {
        _harvestInterest(msg.sender);
    }
    
    /**
     * @notice Lock NFTs as collateral for borrowing
     * @param tokenIds Array of NFT token IDs to lock
     * @param nftContract Address of the NFT contract
     */
    struct CollateralInput {
        address nftContract;
        uint256[] tokenIds;
    }

    function lockNFTCollateral(
        CollateralInput[] calldata inputs
    ) external nonReentrant whenNotPaused {
        require(inputs.length > 0, "No collections provided");
        
        uint256 totalValue = 0;
        BorrowerPosition storage position = borrowerPositions[msg.sender];
        
        // Process each collection
        for (uint256 i = 0; i < inputs.length; i++) {
            CollateralInput calldata input = inputs[i];
            require(input.tokenIds.length > 0, "Empty tokenIds array");
            
            // Process each NFT in the collection
            for (uint256 j = 0; j < input.tokenIds.length; j++) {
                uint256 tokenId = input.tokenIds[j];
                require(!isNFTLocked[input.nftContract][tokenId], "NFT already locked");
                require(
                    IERC721(input.nftContract).ownerOf(tokenId) == msg.sender,
                    "Not token owner"
                );
                
                // Transfer NFT to this contract
                IERC721(input.nftContract).transferFrom(msg.sender, address(this), tokenId);
                
                isNFTLocked[input.nftContract][tokenId] = true;

                // Add tokenId to array
                position.collateralNFTs.push(CollateralNFT(input.nftContract, tokenId));
                
                // Get NFT value from the NFT contract
                (uint256 price,,,,, ) = IRealEstateNFT(input.nftContract).getCollectionInfo();
                totalValue += price;
            }
        }
        
        // Update borrower position's total collateral value
        position.totalCollateralValue += totalValue;
        
        // Emit event
        emit CollateralLocked(msg.sender, position.collateralNFTs);
    }
    
    /**
     * @notice Borrow USDT against locked NFT collateral
     * @param amount Amount of USDT to borrow
     */
    function borrow(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(totalDeposited - totalBorrowed >= amount, "Insufficient liquidity");
        
        BorrowerPosition storage position = borrowerPositions[msg.sender];
        require(position.collateralNFTs.length > 0, "No collateral locked");
        
        // Calculate maximum borrowable amount (40% of collateral value)
        uint256 maxBorrowable = (position.totalCollateralValue * getBorrowingLimit()) / 10000;
        require(position.borrowedAmount + amount <= maxBorrowable, "Exceeds borrowing limit");
        
        // Update state
        bool isNewLoan = position.borrowedAmount == 0;
        position.borrowedAmount += amount;
        position.lastUpdateTime = block.timestamp;
        totalBorrowed += amount;
        
        // Increment active loan count if this is a new loan
        if (isNewLoan) {
            activeLoanCount += 1;
        }
        
        // Transfer USDT to borrower
        require(IERC20(usdtToken).transfer(msg.sender, amount), "USDT transfer failed");
        
        // Calculate and emit loan health
        uint256 health = (position.totalCollateralValue * 10000) / position.borrowedAmount;
        string memory status = "Healthy";
        
        if (health < 300) {
            status = "Critical";
        } else if (health < 350) {
            status = "Warning";
        }
        
        emit Borrowed(msg.sender, amount);
        emit LoanHealthChanged(msg.sender, health, status);
    }
    
    /**
     * @notice Repay borrowed USDT
     * @param amount Amount of USDT to repay
     * @dev Excess payments beyond the total debt are allowed to handle interest accrual during transaction
     *      processing time. Any excess amount will not be refunded.
     */
    function repay(uint256 amount) external nonReentrant {
        BorrowerPosition storage position = borrowerPositions[msg.sender];
        
        require(amount > 0, "Amount must be greater than 0");
        require(position.borrowedAmount > 0, "No outstanding loan");
        
        // Calculate interest
        uint256 interest = interestRateModel.calculateInterest(
            position.borrowedAmount,
            position.lastUpdateTime,
            block.timestamp,
            getBorrowingAPY()
        );
        
        uint256 totalOwed = position.borrowedAmount + interest;
        // Allow excess payments to handle interest accrual during transaction time
        // Previously: require(amount <= totalOwed, "Amount exceeds debt");
        
        // Transfer USDT from user
        require(
            IERC20(usdtToken).transferFrom(msg.sender, address(this), amount),
            "USDT transfer failed"
        );
        
        // Update state
        if (amount >= totalOwed) {
            // Full repayment (including case where amount > totalOwed for buffer against interest accrual)
            // Note: Any excess payment beyond totalOwed is not refunded but fully accepted
            totalBorrowed -= position.borrowedAmount;
            position.borrowedAmount = 0;
            position.lastUpdateTime = block.timestamp;
            
            // Decrement active loan count on full repayment
            if (activeLoanCount > 0) {
                activeLoanCount -= 1;
            }
            
            // If there are no collateral NFTs, clean up the position
            if (position.collateralNFTs.length == 0) {
                delete borrowerPositions[msg.sender];
            }
        } else {
            // Partial repayment
            uint256 interestPortion = (amount * interest) / totalOwed;
            uint256 principalPortion = amount - interestPortion;
            
            // Update state
            totalBorrowed -= principalPortion;
            position.borrowedAmount -= principalPortion;
            position.lastUpdateTime = block.timestamp;
        }
        
        // Add interest to total deposited
        totalDeposited += interest;
        
        emit Repaid(msg.sender, amount);
    }
    
    /**
     * @notice Unlock NFT collateral after full repayment
     * @dev Checks if remaining collateral is sufficient for any outstanding loan
     * @param collateralNFTs Array of CollateralNFT structs to unlock
     */
    function unlockCollateral(
        CollateralNFT[] calldata collateralNFTs
    ) external nonReentrant whenNotPaused {
        BorrowerPosition storage position = borrowerPositions[msg.sender];

        require(position.collateralNFTs.length > 0, "No collateral to unlock");
        
        // Track NFTs to unlock and calculate proportional value
        uint256 totalValueToUnlock = 0;
        
        // Verify all NFTs are valid
        for (uint256 i = 0; i < collateralNFTs.length; i++) {
            CollateralNFT calldata nft = collateralNFTs[i];
            
            // Check for duplicates
            for (uint256 k = 0; k < i; k++) {
                require(collateralNFTs[k].collection != nft.collection || collateralNFTs[k].tokenId != nft.tokenId, "Duplicate NFT in unlock request");
            }
            
            // Verify NFT is locked and owned by this contract
            require(isNFTLocked[nft.collection][nft.tokenId], "NFT not locked");
            require(IERC721(nft.collection).ownerOf(nft.tokenId) == address(this), "NFT not owned by contract");
            
            // Verify NFT is in collateral array
            bool found = false;
            for (uint256 j = 0; j < position.collateralNFTs.length; j++) {
                if (position.collateralNFTs[j].collection == nft.collection && position.collateralNFTs[j].tokenId == nft.tokenId) {
                    found = true;
                    break;
                }
            }
            require(found, "NFT not in collateral array");
        }
        
        // Calculate totalValueToUnlock proportionally based on the number of NFTs being unlocked
        // This ensures consistency with the original calculation used when locking
        if (position.collateralNFTs.length > 0) {
            totalValueToUnlock = (position.totalCollateralValue * collateralNFTs.length) / position.collateralNFTs.length;
            console.log("Calculated proportional value to unlock: %s", totalValueToUnlock);
        }

        // Enhanced debug logging to identify price discrepancies and loan health metrics
        console.log("Total collateral value in position: %s", position.totalCollateralValue);
        console.log("Total value to unlock: %s", totalValueToUnlock);
        console.log("Borrowed amount: %s", position.borrowedAmount);
        
        // Calculate important loan health metrics for debugging
        if (position.borrowedAmount > 0) {
            uint256 borrowingLimit = getBorrowingLimit();
            uint256 minRequiredCollateral = (position.borrowedAmount * 10000) / borrowingLimit;
            uint256 remainingCollateralValue = position.totalCollateralValue - totalValueToUnlock;
            uint256 loanHealth = (remainingCollateralValue * 10000) / position.borrowedAmount;
            
            console.log("Current borrowing limit (basis points): %s", borrowingLimit);
            console.log("Minimum required collateral: %s", minRequiredCollateral);
            console.log("Remaining collateral value after unlock: %s", remainingCollateralValue);
            console.log("Loan health after unlock (basis points): %s", loanHealth);
        }
        
        // If there's an outstanding loan, verify remaining collateral is sufficient
        if (position.borrowedAmount > 0) {
            // Add safety check to prevent underflow
            require(position.totalCollateralValue >= totalValueToUnlock, "Collateral value underflow");
            
            uint256 remainingCollateralValue = position.totalCollateralValue - totalValueToUnlock;
            uint256 minRequiredCollateral = (position.borrowedAmount * 10000) / getBorrowingLimit();
            console.log("Remaining collateral value: %s", remainingCollateralValue);
            console.log("Minimum required collateral: %s", minRequiredCollateral);
            require(remainingCollateralValue >= minRequiredCollateral, "Insufficient remaining collateral");
        }
        
        // Update collateral array and unlock NFTs
        CollateralNFT[] memory remainingNFTs = new CollateralNFT[](position.collateralNFTs.length);
        uint256 remainingCount = 0;
        
        // Process each NFT in the position
        for (uint256 i = 0; i < position.collateralNFTs.length; i++) {
            bool shouldUnlock = false;
            CollateralNFT memory currentNFT = position.collateralNFTs[i];
            
            // Debug log each NFT in the position
            console.log("Checking NFT at index %s - collection: %s, tokenId: %s", 
                i, currentNFT.collection, currentNFT.tokenId);
            
            // Check if this NFT should be unlocked
            for (uint256 j = 0; j < collateralNFTs.length; j++) {
                if (currentNFT.collection == collateralNFTs[j].collection && currentNFT.tokenId == collateralNFTs[j].tokenId) {
                    shouldUnlock = true;
                    console.log("Found match for NFT at index %s in unlock request", i);
                    break;
                }
            }
            
            if (shouldUnlock) {
                // Unlock and transfer the NFT
                isNFTLocked[currentNFT.collection][currentNFT.tokenId] = false;
                IERC721(currentNFT.collection).safeTransferFrom(address(this), msg.sender, currentNFT.tokenId);
                console.log("Unlocking NFT - tokenId: %s, nftContract: %s", currentNFT.tokenId, currentNFT.collection);
            } else {
                // Keep this NFT in the remaining array
                remainingNFTs[remainingCount++] = currentNFT;
            }
        }
        
        // Create final array of remaining NFTs
        // We need to copy elements one by one since direct array assignment is not supported
        delete position.collateralNFTs; // Clear the existing array
        for (uint256 i = 0; i < remainingCount; i++) {
            position.collateralNFTs.push(remainingNFTs[i]);
        }
        
        // Update position
        // Add safety check to prevent underflow
        require(position.totalCollateralValue >= totalValueToUnlock, "Collateral value update underflow");
        position.totalCollateralValue -= totalValueToUnlock;
        
        // Clear position if no NFTs remain
        if (position.collateralNFTs.length == 0) {
            delete borrowerPositions[msg.sender];
        }
        
        emit CollateralUnlocked(msg.sender, collateralNFTs);
        if (position.borrowedAmount > 0) {
            emit PartialUnlock(msg.sender, collateralNFTs, position.totalCollateralValue - totalValueToUnlock, position.borrowedAmount);
        }
    }
    

    
    // Internal functions
    
    /**
     * @notice Handle defaulted loans by transferring NFTs to treasury
     * @param borrower Address of the borrower to check for default
     */
    /**
     * @notice Get the price per NFT for a specific collection
     * @param collectionAddress The address of the NFT collection
     * @return price The price per NFT as returned by getCollectionInfo
     */
    function getNFTCollectionPrice(address collectionAddress) external view returns (uint256 price) {
        (price,,,,, ) = IRealEstateNFT(collectionAddress).getCollectionInfo();
        return price;
    }
    
    function handleDefault(address borrower) external {
        BorrowerPosition storage position = borrowerPositions[borrower];
        require(position.borrowedAmount > 0, "No outstanding loan");

        // Calculate current loan health
        uint256 maxBorrow = (position.totalCollateralValue * getBorrowingLimit()) / 10000;
        uint256 defaultThreshold = getDefaultThreshold();
        
        // Calculate interest
        uint256 interest = interestRateModel.calculateInterest(
            position.borrowedAmount,
            position.lastUpdateTime,
            block.timestamp,
            getBorrowingAPY()
        );
        
        uint256 totalOwed = position.borrowedAmount + interest;
        
        // Check if loan is in default
        require(totalOwed * 10000 >= maxBorrow * defaultThreshold, "Loan not in default");
        
        // Store NFTs for event
        CollateralNFT[] memory defaultedNFTs = position.collateralNFTs;

        // Transfer NFTs to treasury
        for (uint256 i = 0; i < position.collateralNFTs.length; i++) {
            CollateralNFT memory nft = position.collateralNFTs[i];
            isNFTLocked[nft.collection][nft.tokenId] = false;
            IERC721(nft.collection).safeTransferFrom(address(this), admin.treasuryWallet(), nft.tokenId);
        }

        // Update state
        totalBorrowed -= position.borrowedAmount;
        
        // Decrement active loan count on liquidation
        if (activeLoanCount > 0) {
            activeLoanCount -= 1;
        }
        
        // Delete the borrower position
        delete borrowerPositions[borrower];
        
        emit LoanDefaulted(borrower, defaultedNFTs);
    }

    function _harvestInterest(address lender) internal {
        LenderPosition storage position = lenderPositions[lender];
        
        // Calculate new interest since last update
        uint256 newInterest = interestRateModel.calculateInterest(
            position.amount,
            position.lastUpdateTime,
            block.timestamp,
            admin.lendingAPY()
        );
        
        // Update total accumulated interest
        uint256 totalInterest = position.accumulatedInterest + newInterest;
        
        if (totalInterest > 0) {
            // Reset accumulated interest
            position.accumulatedInterest = 0;
            position.lastUpdateTime = block.timestamp;
            
            // Transfer total interest to lender
            require(
                IERC20(usdtToken).transfer(lender, totalInterest),
                "Interest transfer failed"
            );
            
            emit InterestHarvested(lender, totalInterest);
        }
    }
    
    // Admin functions
    
    /**
     * @dev Implementation of IERC721Receiver interface
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
    
    /**
     * @notice Get the current number of active loans in the protocol
     * @return The count of active loans
     */
    function getActiveLoanCount() external view returns (uint256) {
        return activeLoanCount;
    }

    function getTotalOwed(address borrower) external view returns (uint256) {
        BorrowerPosition storage position = borrowerPositions[borrower];
        if (position.borrowedAmount == 0) {
            return 0;
        }
        
        // Calculate interest
        uint256 interest = interestRateModel.calculateInterest(
            position.borrowedAmount,
            position.lastUpdateTime,
            block.timestamp,
            getBorrowingAPY()
        );
        
        return position.borrowedAmount + interest;
    }

    function getLoanHealth(address borrower) external view returns (uint256 healthPercentage, string memory status) {
        BorrowerPosition storage position = borrowerPositions[borrower];
        if (position.borrowedAmount == 0) return (10000, "HEALTHY");
        
        uint256 interest = interestRateModel.calculateInterest(
            position.borrowedAmount,
            position.lastUpdateTime,
            block.timestamp,
            getBorrowingAPY()
        );
        
        uint256 totalOwed = position.borrowedAmount + interest;
        uint256 health = (position.totalCollateralValue * 10000) / totalOwed;
        
        if (health >= 8000) return (health, "HEALTHY");
        else if (health >= 6000) return (health, "WARNING");
        else if (health > admin.defaultThreshold()) return (health, "DANGER");
        else return (health, "DEFAULT");
    }

    /**
     * @notice Calculate the current APY based on configuration
     * @return (lendingAPY, borrowingAPY) Current APY rates in basis points
     */
    function _getCurrentAPY() internal view returns (uint256, uint256) {
        if (!admin.isDynamicRatesEnabled()) {
            return (admin.lendingAPY(), admin.borrowingAPY());
        }
        
        // Calculate utilization rate
        uint256 utilization = interestRateModel.calculateUtilizationRate(
            totalBorrowed,
            totalDeposited
        );
        
        // Get dynamic rates
        uint256 borrowAPY = interestRateModel.calculateBorrowRate(utilization);
        uint256 lendAPY = interestRateModel.calculateLendRate(utilization);
        
        return (lendAPY, borrowAPY);
    }

    function _updateCollateralValue(address borrower, uint256 newValue) internal {
        borrowerPositions[borrower].totalCollateralValue = newValue;
    }

    function getCurrentEarnedInterest(address lender) external view returns (uint256) {
        LenderPosition storage position = lenderPositions[lender];
        
        if (position.amount == 0) return position.accumulatedInterest;
        
        // Calculate new interest since last update
        uint256 newInterest = interestRateModel.calculateInterest(
            position.amount,
            position.lastUpdateTime,
            block.timestamp,
            admin.lendingAPY()
        );
        
        // Return accumulated interest plus any new interest since last update
        return position.accumulatedInterest + newInterest;
    }
}
