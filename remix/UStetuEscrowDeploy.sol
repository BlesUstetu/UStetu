// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuEscrow} from "./UStetuEscrow.sol";

/// @notice Remix deployment wrapper for UStetuEscrow.
/// @dev No escrow logic is changed. This wrapper only exposes a dedicated
///      deployable artifact so Remix can select it reliably in Deploy & Run.
contract UStetuEscrowDeploy is UStetuEscrow {
    constructor(address registryAddress, address feeRecipientAddress)
        UStetuEscrow(registryAddress, feeRecipientAddress)
    {}
}
