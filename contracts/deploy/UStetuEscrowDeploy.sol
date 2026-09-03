// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuEscrow} from "../core/UStetuEscrow.sol";

/// @notice Dedicated Remix deployment entrypoint for UStetuEscrow.
/// @dev Inherits the production escrow without changing any escrow logic.
contract UStetuEscrowDeploy is UStetuEscrow {
    constructor(address registryAddress, address feeRecipientAddress)
        UStetuEscrow(registryAddress, feeRecipientAddress)
    {}
}
