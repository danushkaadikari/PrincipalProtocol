// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    uint8 private constant DECIMALS = 6;
    uint256 private constant INITIAL_SUPPLY = 100_000_000; // 100 million

    constructor() ERC20("Mock USDT", "USDT") {
        _mint(msg.sender, INITIAL_SUPPLY * (10 ** DECIMALS));
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}
