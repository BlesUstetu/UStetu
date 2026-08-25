// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuErrors} from "./UStetuErrors.sol";

/// @title UStetuMath
/// @notice Deterministic protocol math helpers.
library UStetuMath {
    uint256 internal constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant DEFAULT_FEE_BPS = 100;

    function calculateFee(uint256 grossPayment, uint256 feeBps)
        internal
        pure
        returns (uint256 fee, uint256 sellerProceeds)
    {
        if (feeBps > BPS_DENOMINATOR) {
            revert UStetuErrors.InvalidAmount();
        }

        // Solidity 0.8 checked arithmetic protects multiplication overflow.
        // The protocol implementation must additionally bound grossPayment
        // according to the supported payment-token denomination.
        fee = (grossPayment * feeBps) / BPS_DENOMINATOR;
        sellerProceeds = grossPayment - fee;

        if (fee + sellerProceeds != grossPayment) {
            revert UStetuErrors.AccountingInvariantViolation();
        }
    }

    function calculateGrossPayment(uint256 tokenAmount, uint256 unitPrice)
        internal
        pure
        returns (uint256 grossPayment)
    {
        if (tokenAmount == 0 || unitPrice == 0) {
            revert UStetuErrors.InvalidAmount();
        }

        grossPayment = tokenAmount * unitPrice;
    }
}
