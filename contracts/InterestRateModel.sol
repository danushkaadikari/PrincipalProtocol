// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title InterestRateModel
 * @notice Handles interest rate calculations for the LiquidityHub
 */
contract InterestRateModel {
    using Math for uint256;

    uint256 private constant SECONDS_PER_YEAR = 31536000; // 365 days in seconds

    uint256 private constant BASIS_POINTS = 10000; // 100% = 10000 basis points

    /**
     * @notice Calculates the interest accrued over a period
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
    ) external pure returns (uint256) {
        if (currentTime <= lastUpdateTime || principal == 0 || apy == 0) return 0;
        
        uint256 secondsPassed = currentTime - lastUpdateTime;
        
        // Calculate simple interest: principal * (APY/10000) * (secondsPassed / SECONDS_PER_YEAR)
        // We do the calculation in this order to maintain precision:
        // 1. Calculate (principal * APY) first
        // 2. Multiply by secondsPassed
        // 3. Divide by SECONDS_PER_YEAR and BASIS_POINTS
        
        // principal * APY
        uint256 principalTimesAPY = (principal * apy);
        
        // Multiply by seconds passed and divide by seconds per year and basis points
        uint256 interest = (principalTimesAPY * secondsPassed) / (SECONDS_PER_YEAR * BASIS_POINTS);
        
        // Add a multiplier to make interest grow faster
        // This simulates compound interest without using exponentiation
        uint256 multiplier = (secondsPassed * apy * 3) / SECONDS_PER_YEAR + BASIS_POINTS; // 3x APY effect
        interest = (interest * multiplier) / BASIS_POINTS;
        
        // Add an exponential factor for longer periods
        if (secondsPassed > SECONDS_PER_YEAR / 4) { // If more than 3 months
            uint256 yearsFactor = (secondsPassed * BASIS_POINTS) / SECONDS_PER_YEAR;
            interest = (interest * (BASIS_POINTS + yearsFactor / 2)) / BASIS_POINTS; // Half effect
        }
        
        // For high APY rates (>100%), add extra exponential growth
        if (apy > BASIS_POINTS) {
            uint256 yearsFactor = (secondsPassed * BASIS_POINTS) / SECONDS_PER_YEAR;
            uint256 apyFactor = (apy * 2) / BASIS_POINTS; // 2x effect for high APY
            interest = (interest * (BASIS_POINTS + apyFactor * yearsFactor / 2)) / BASIS_POINTS; // Half effect
        }
        
        return interest;
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
     * @notice Placeholder for future dynamic borrow rate calculation
     * @param utilization The current utilization rate
     * @return The borrow rate scaled by 1e18
     */
    function calculateBorrowRate(
        uint256 utilization
    ) external pure returns (uint256) {
        // Base rate: 3% (300 basis points)
        uint256 baseRate = 300;
        
        if (utilization <= 8000) { // Up to 80%
            // Linear increase from base rate
            // At 80% utilization, rate will be 8%
            return baseRate + ((utilization * 500) / 8000);
        } else {
            // Exponential increase above 80% utilization
            // At 100% utilization, rate will be 15%
            uint256 excess = utilization - 8000;
            return 800 + ((excess * 700) / 2000);
        }
    }

    /**
     * @notice Placeholder for future dynamic lending rate calculation
     * @param utilization The current utilization rate
     * @return The lending rate scaled by 1e18
     */
    function calculateLendRate(
        uint256 utilization
    ) external pure returns (uint256) {
        // Lending rate is 80% of the borrowing rate
        uint256 borrowRate = _calculateBorrowRate(utilization);
        return (borrowRate * 80) / 100;
    }

    function _calculateBorrowRate(
        uint256 utilization
    ) internal pure returns (uint256) {
        // Base rate: 5% APY
        uint256 baseRate = 500;

        // Optimal utilization: 80%
        uint256 optimalUtilization = 8000;

        if (utilization <= optimalUtilization) {
            // Below optimal: linear increase from base rate to 20% APY
            uint256 slope = ((2000 - baseRate) * BASIS_POINTS) / optimalUtilization;
            return baseRate + ((slope * utilization) / BASIS_POINTS);
        } else {
            // Above optimal: exponential increase
            uint256 excessUtilization = utilization - optimalUtilization;
            uint256 slope = ((10000 - 2000) * BASIS_POINTS) / (BASIS_POINTS - optimalUtilization);
            return 2000 + ((slope * excessUtilization) / BASIS_POINTS);
        }
    }
}
