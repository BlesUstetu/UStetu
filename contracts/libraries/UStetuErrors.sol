// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title UStetuErrors
/// @notice Canonical custom errors for the UStetu V1 protocol.
library UStetuErrors {
    error Unauthorized();
    error InvalidAddress();
    error AlreadyRegistered();
    error NotRegisteredSeller();

    error UnsupportedToken();
    error UnsupportedPaymentToken();
    error TokenAlreadyRegistered();
    error TokenNotRegistered();
    error InvalidTokenDecimals();
    error InvalidPaymentToken();

    error InvalidChainId();
    error NotAContract();

    error InvalidListingState();
    error InvalidOrderState();

    error InsufficientInventory();
    error InsufficientClaimable();

    error InvalidAmount();
    error InvalidPrice();
    error InvalidOrderLimits();

    error WithdrawalLocked();
    error AccountingInvariantViolation();
    error TokenTransferMismatch();

    error DeadlineExpired();
    error DeadlineNotReached();
}
