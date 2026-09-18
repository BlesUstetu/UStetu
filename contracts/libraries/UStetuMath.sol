// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {UStetuErrors} from "./UStetuErrors.sol";

/// @title UStetuMath
/// @notice Deterministic arithmetic helpers for UStetu V1.
library UStetuMath {
    uint256 internal constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant DEFAULT_FEE_BPS = 100;
    uint8 internal constant MAX_TOKEN_DECIMALS = 36;

    /// @notice Calculates the marketplace fee and seller proceeds.
    /// @dev Fee calculation rounds down. The two outputs always conserve grossPayment.
    function calculateFee(uint256 grossPayment, uint256 feeBps)
        internal
        pure
        returns (uint256 fee, uint256 sellerProceeds)
    {
        if (feeBps > BPS_DENOMINATOR) {
            revert UStetuErrors.InvalidAmount();
        }

        fee = Math.mulDiv(grossPayment, feeBps, BPS_DENOMINATOR);
        sellerProceeds = grossPayment - fee;

        if (fee + sellerProceeds != grossPayment) {
            revert UStetuErrors.AccountingInvariantViolation();
        }
    }

    /// @notice Converts listed-token units and a unit price into payment-token base units.
    /// @dev Integer division deliberately rounds down. A zero result is rejected.
    function calculateGrossPayment(
        uint256 tokenAmount,
        uint256 unitPrice,
        uint8 tokenDecimals
    ) internal pure returns (uint256 grossPayment) {
        if (tokenAmount == 0 || unitPrice == 0) {
            revert UStetuErrors.InvalidAmount();
        }
        if (tokenDecimals > MAX_TOKEN_DECIMALS) {
            revert UStetuErrors.InvalidTokenDecimals();
        }

        uint256 scale = 10 ** uint256(tokenDecimals);
        grossPayment = Math.mulDiv(tokenAmount, unitPrice, scale);

        if (grossPayment == 0) {
            revert UStetuErrors.InvalidAmount();
        }
    }
}
