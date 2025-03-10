// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LiquidityHubStorage
 * @notice Contract to handle storage for the LiquidityHub system using the diamond storage pattern
 */
abstract contract LiquidityHubStorage {
    // Core state variables
    mapping(address => uint256) public lenderDeposits;
    mapping(address => uint256) public lenderLastUpdate;
    mapping(address => uint256) public lenderInterest;
    
    mapping(address => uint256[]) public borrowerCollateral;
    mapping(address => uint256) public borrowerAmounts;
    mapping(address => uint256) public borrowerLastUpdate;
    mapping(address => uint256) public borrowerCollateralValue;
    mapping(address => mapping(uint256 => bool)) public isNFTLocked;
    
    // Protocol configuration
    // Note: APY and configuration values are now read directly from LiquidityHubAdmin contract
    
    // Protocol state
    bool public paused;
    uint256 public totalDeposited;    // Total USDT in lending pool
    uint256 public totalBorrowed;     // Total USDT borrowed
    uint256 public activeLoanCount;   // Count of active loans
    address public treasuryWallet;    // Wallet for defaulted NFTs
    
    // Contract references
    address public usdtToken;
    address public adminContract;     // LiquidityHubAdmin contract address
}
