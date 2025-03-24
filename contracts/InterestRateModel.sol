// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/Math.sol" as OZMath;
import {UD60x18} from "@prb/math/src/ud60x18/ValueType.sol";
import {pow} from "@prb/math/src/ud60x18/Math.sol";
import {unwrap, wrap} from "@prb/math/src/ud60x18/Casting.sol";

/**
 * @title InterestRateModel
 * @notice Handles interest rate calculations for the LiquidityHub
 */
contract InterestRateModel {
    using OZMath.Math for uint256;

    uint256 private constant SECONDS_PER_YEAR = 31536000; // 365 days in seconds

    uint256 private constant BASIS_POINTS = 10000; // 100% = 10000 basis points

    /**
     * @notice Calculates the interest accrued over a period using accurate compound interest
     * @param principal The principal amount
     * @param lastUpdateTime The timestamp when interest was last calculated
     * @param currentTime The current timestamp
     * @param apy The annual percentage yield in basis points (1 bp = 0.01%)
     * @return The interest accrued
     */
    function calculateInterest(
        uint256 principal,
        uint256 lastUpdateTime,
        uint256 currentTime,
        uint256 apy
    ) public pure returns (uint256) {
        if (currentTime <= lastUpdateTime || principal == 0 || apy == 0) return 0;
        
        uint256 secondsPassed = currentTime - lastUpdateTime;
        
        // Convert time fraction to a fixed-point number (1e18 precision)
        uint256 yearFraction = (secondsPassed * 1e18) / SECONDS_PER_YEAR;
        
        // Convert APY from basis points to a fixed-point decimal (1e18 precision)
        // For example, 1000 basis points (10%) becomes 0.1 * 1e18 = 1e17
        uint256 ratePerYear = (apy * 1e14); // 10000 basis points = 1.0 = 1e18
        
        // Calculate (1 + rate)^yearFraction using PRBMath
        uint256 baseRate = 1e18 + ratePerYear;
        uint256 compoundFactor;
        
        // Use a safe approach to handle potential overflow
        // For small values of yearFraction and reasonable APY rates, this should work fine
        if (yearFraction <= 1e18 && ratePerYear <= 5e17) { // Up to 1 year and 50% APY
            // Use PRBMath's pow function for accurate calculation
            compoundFactor = unwrap(pow(wrap(baseRate), wrap(yearFraction)));
        } else {
            // For larger values, use a simpler approximation to avoid potential overflow
            compoundFactor = 1e18 + (ratePerYear * yearFraction) / 1e18;
            
            // Add a second-order term for better approximation
            uint256 secondTerm = (ratePerYear * yearFraction * yearFraction) / (2 * 1e36);
            compoundFactor += secondTerm;
        }
        
        // Calculate final amount with compound interest: principal * compoundFactor
        uint256 finalAmount = (principal * compoundFactor) / 1e18;
        
        // Return only the interest portion (finalAmount - principal)
        return finalAmount > principal ? finalAmount - principal : 0;
    }

    /**
     * @notice Calculates the current utilization rate of the pool
     * @param totalBorrowed Total amount borrowed from the pool
     * @param totalDeposited Total amount deposited in the pool
     * @return The utilization rate in basis points (1 bp = 0.01%)
     */
    function calculateUtilizationRate(
        uint256 totalBorrowed,
        uint256 totalDeposited
    ) external pure returns (uint256) {
        if (totalDeposited == 0) return 0;
        return (totalBorrowed * BASIS_POINTS) / totalDeposited;
    }

    /**
     * @notice Calculates the dynamic borrow rate based on utilization
     * @param utilization The current utilization rate in basis points (10000 = 100%)
     * @return The borrow rate in basis points (10000 = 100%)
     */
    function calculateBorrowRate(
        uint256 utilization
    ) public pure returns (uint256) {
        // Base rate: 5% APY (500 basis points)
        uint256 baseRate = 500;
        
        // Optimal utilization: 80% (8000 basis points)
        uint256 optimalUtilization = 8000;
        
        if (utilization <= optimalUtilization) {
            // Below optimal: linear increase from base rate to 20% APY
            // At 80% utilization, rate will be 20% (2000 basis points)
            uint256 slope = ((2000 - baseRate) * BASIS_POINTS) / optimalUtilization;
            return baseRate + ((slope * utilization) / BASIS_POINTS);
        } else {
            // Above optimal: exponential increase
            // At 100% utilization, rate will be 50% (5000 basis points)
            uint256 excessUtilization = utilization - optimalUtilization;
            uint256 slope = ((5000 - 2000) * BASIS_POINTS) / (BASIS_POINTS - optimalUtilization);
            return 2000 + ((slope * excessUtilization) / BASIS_POINTS);
        }
    }

    /**
     * @notice Calculates the dynamic lending rate based on utilization
     * @param utilization The current utilization rate in basis points (10000 = 100%)
     * @return The lending rate in basis points (10000 = 100%)
     */
    function calculateLendRate(
        uint256 utilization
    ) external pure returns (uint256) {
        // Lending rate is 80% of the borrowing rate
        // This ensures lending rate is always lower than borrowing rate
        uint256 borrowRate = calculateBorrowRate(utilization);
        return (borrowRate * 80) / 100;
    }
}
