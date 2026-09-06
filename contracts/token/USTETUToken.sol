// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title USTETUToken
 * @notice Native USTETU ERC-20 token for the UStetu marketplace.
 * @dev Fixed supply. No public mint function, transfer tax, blacklist,
 *      pause mechanism, or rebasing logic.
 */
contract USTETUToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 88_000_000 ether;

    constructor() ERC20("USTETU", "USTETU") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
