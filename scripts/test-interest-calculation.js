const { ethers } = require("hardhat");

async function main() {
  console.log("Testing the new compound interest calculation implementation...");

  // Deploy the InterestRateModel contract
  const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  console.log("InterestRateModel deployed to:", await interestRateModel.getAddress());

  // Test parameters
  const principal = ethers.parseUnits("1000", 18); // 1000 USDT with 18 decimals
  const now = Math.floor(Date.now() / 1000);
  
  // Test with different APY rates
  const apyRates = [500, 1000, 2000, 5000]; // 5%, 10%, 20%, 50% in basis points
  
  // Test with different time periods
  const timePeriods = [
    { name: "1 month", seconds: 30 * 24 * 60 * 60 },
    { name: "3 months", seconds: 90 * 24 * 60 * 60 },
    { name: "6 months", seconds: 180 * 24 * 60 * 60 },
    { name: "1 year", seconds: 365 * 24 * 60 * 60 }
  ];

  console.log("\nCompound Interest Calculation Results:");
  console.log("======================================");
  console.log(`Principal: ${ethers.formatUnits(principal, 18)} USDT`);
  
  // Run tests for each APY rate and time period
  for (const apy of apyRates) {
    console.log(`\nAPY: ${apy / 100}%`);
    console.log("------------------");
    
    for (const period of timePeriods) {
      const lastUpdateTime = now - period.seconds;
      const interest = await interestRateModel.calculateInterest(principal, lastUpdateTime, now, apy);
      
      // Calculate effective APY based on the interest earned
      const effectiveAPY = (interest * BigInt(10000) * BigInt(365 * 24 * 60 * 60)) / 
                          (principal * BigInt(period.seconds));
      
      console.log(`${period.name}: ${ethers.formatUnits(interest, 18)} USDT (Effective APY: ${Number(effectiveAPY) / 100}%)`);
    }
  }

  // Compare with the old implementation (simulated)
  console.log("\nComparison with old implementation (simulated):");
  console.log("==============================================");
  
  // Simple simulation of the old implementation
  function oldCalculateInterest(principal, lastUpdateTime, currentTime, apy) {
    if (currentTime <= lastUpdateTime || principal == 0 || apy == 0) return 0n;
    
    const secondsPassed = BigInt(currentTime - lastUpdateTime);
    const SECONDS_PER_YEAR = 31536000n;
    const BASIS_POINTS = 10000n;
    
    // Calculate simple interest
    const principalTimesAPY = principal * BigInt(apy);
    let interest = (principalTimesAPY * secondsPassed) / (SECONDS_PER_YEAR * BASIS_POINTS);
    
    // Add multiplier (3x APY effect)
    const multiplier = (secondsPassed * BigInt(apy) * 3n) / SECONDS_PER_YEAR + BASIS_POINTS;
    interest = (interest * multiplier) / BASIS_POINTS;
    
    // Add exponential factor for longer periods
    if (secondsPassed > SECONDS_PER_YEAR / 4n) {
      const yearsFactor = (secondsPassed * BASIS_POINTS) / SECONDS_PER_YEAR;
      interest = (interest * (BASIS_POINTS + yearsFactor / 2n)) / BASIS_POINTS;
    }
    
    // For high APY rates (>100%), add extra exponential growth
    if (BigInt(apy) > BASIS_POINTS) {
      const yearsFactor = (secondsPassed * BASIS_POINTS) / SECONDS_PER_YEAR;
      const apyFactor = (BigInt(apy) * 2n) / BASIS_POINTS;
      interest = (interest * (BASIS_POINTS + apyFactor * yearsFactor / 2n)) / BASIS_POINTS;
    }
    
    return interest;
  }

  // Test comparison for 10% APY
  const apy = 1000; // 10%
  console.log(`\nAPY: ${apy / 100}%`);
  console.log("------------------");
  
  for (const period of timePeriods) {
    const lastUpdateTime = now - period.seconds;
    
    // New implementation
    const newInterest = await interestRateModel.calculateInterest(principal, lastUpdateTime, now, apy);
    
    // Old implementation (simulated)
    const oldInterest = oldCalculateInterest(principal, lastUpdateTime, now, apy);
    
    const difference = (newInterest > oldInterest) 
      ? newInterest - oldInterest 
      : oldInterest - newInterest;
    
    const percentDiff = Number(difference * 10000n / principal) / 100;
    
    console.log(`${period.name}:`);
    console.log(`  New: ${ethers.formatUnits(newInterest, 18)} USDT`);
    console.log(`  Old: ${ethers.formatUnits(oldInterest, 18)} USDT`);
    console.log(`  Difference: ${ethers.formatUnits(difference, 18)} USDT (${percentDiff}% of principal)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
