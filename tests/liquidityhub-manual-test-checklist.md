# LiquidityHub Manual Testing Checklist

## Prerequisites
- MetaMask extension installed and configured for Sepolia testnet
- Test account with Sepolia ETH for gas
- Test account with Sepolia USDT for lending/borrowing
- Test account with NFTs for collateral

## 1. Basic UI Testing
- [ ] Verify all tabs (Borrow, Lend, Protocol Stats) are visible
- [ ] Verify navigation between tabs works correctly
- [ ] Verify wallet connection works properly
- [ ] Verify responsive design on different screen sizes

## 2. Borrowing Functionality
- [ ] Verify NFT Selection interface shows owned NFTs
- [ ] Verify NFTs can be selected/deselected
- [ ] Verify borrowable amount updates correctly based on selected NFTs
- [ ] Verify NFT approval process works
- [ ] Verify locking NFTs as collateral works
- [ ] Verify borrowing USDT against locked collateral works
- [ ] Verify loan health indicator displays correctly
- [ ] Verify repayment functionality works
- [ ] Verify unlocking collateral after repayment works

## 3. Lending Functionality
- [ ] Verify USDT approval process works
- [ ] Verify depositing USDT into the lending pool works
- [ ] Verify interest accrual is displayed correctly
- [ ] Verify interest harvesting functionality works
- [ ] Verify withdrawal functionality works
- [ ] Verify withdrawal fees are applied correctly

## 4. Admin Functionality
- [ ] Verify admin panel is accessible only to authorized users
- [ ] Verify setting lending APY works
- [ ] Verify setting borrowing APY works
- [ ] Verify setting withdrawal fee works
- [ ] Verify setting borrowing limit works
- [ ] Verify setting default threshold works
- [ ] Verify emergency pause functionality works

## 5. Protocol Stats
- [ ] Verify total deposits are displayed correctly
- [ ] Verify total borrowed amount is displayed correctly
- [ ] Verify active loans count is displayed correctly
- [ ] Verify pool utilization is calculated and displayed correctly

## 6. Contract Interaction Testing
- [ ] Verify contract addresses in the frontend match the deployed contracts
- [ ] Verify all transaction confirmations are displayed properly
- [ ] Verify error handling for failed transactions
- [ ] Verify gas estimation is reasonable

## 7. Edge Cases
- [ ] Test behavior when trying to borrow more than allowed
- [ ] Test behavior when trying to withdraw more than deposited
- [ ] Test behavior when loan health approaches default threshold
- [ ] Test behavior when trying to unlock collateral that would breach minimum collateral ratio

## Testing Notes
- Contract Addresses:
  - LiquidityHub: `0x84DE604fc769819b510DC6277a41E2fDBf8b4A6E`
  - LiquidityHubAdmin: `0xC20DE4a10a6dB6D21939138F4F3CD8c8c5f82F9f`
  - InterestRateModel: `0x7845D9265874638C089f8A1399D98965060e6249`

- Configuration Parameters:
  - Borrowing Limit: 40%
  - Default Threshold: 50%
  - Lending APY: 3%
  - Borrowing APY: 6%
  - Withdrawal Fee: 0%

## Test Results
| Test Case | Status | Notes |
|-----------|--------|-------|
|           |        |       |
