// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title UStetuErrors
/// @notice Canonical custom errors for the UStetu protocol.
library UStetuErrors {
    error Unauthorized();
    error InvalidAddress();
    error AlreadyRegistered();
    error NotRegisteredSeller();
    error UnsupportedToken();
    error UnsupportedPaymentToken();
    error TokenNotApproved();
    error TokenAlreadyRegistered();
    error InvalidListingState();
    error InvalidOrderState();
    error InvalidVerificationState();
    error InsufficientInventory();
    error InsufficientPayment();
    error InsufficientClaimable();
    error InvalidAmount();
    error InvalidPrice();
    error InvalidOrderLimits();
    error DisputeActive();
    error DisputeNotFound();
    error NotDisputeParty();
    error NotExpired();
    error WithdrawalLocked();
    error RecipientImmutable();
    error AccountingInvariantViolation();
    error UnsupportedChain();
    error WrongChain();
    error Paused();
    error DeadlineExpired();
    error DeadlineNotReached();
    error InvalidResolution();
}
