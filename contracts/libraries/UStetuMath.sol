// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
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

        fee = (grossPayment * feeBps) / BPS_DENOMINATOR;
        sellerProceeds = grossPayment - fee;

        if (fee + sellerProceeds != grossPayment) {
            revert UStetuErrors.AccountingInvariantViolation();
        }
    }

    /// @notice Converts a token-denominated amount into payment-token units.
    /// @dev `unitPrice` is the price of one whole token in payment-token
    ///      smallest units. `tokenAmount` is in the listed token's smallest units.
    function calculateGrossPayment(
        uint256 tokenAmount,
        uint256 unitPrice,
        uint8 tokenDecimals
    ) internal pure returns (uint256 grossPayment) {
        if (tokenAmount == 0 || unitPrice == 0) {
            revert UStetuErrors.InvalidAmount();
        }

        uint256 scale = 10 ** uint256(tokenDecimals);
        grossPayment = Math.mulDiv(tokenAmount, unitPrice, scale);
        if (grossPayment == 0) {
            revert UStetuErrors.InvalidAmount();
        }
    }
}
