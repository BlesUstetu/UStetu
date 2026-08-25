// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuMath} from "../contracts/libraries/UStetuMath.sol";

contract UStetuMathTest is Test {
    function testFeeAtOnePercent() public pure {
        uint256 gross = 270e6;
        (uint256 fee, uint256 sellerProceeds) = UStetuMath.calculateFee(gross, 100);
        assertEq(fee, 2.7e6);
        assertEq(sellerProceeds, 267.3e6);
    }

    function testZeroFee() public pure {
        (uint256 fee, uint256 sellerProceeds) = UStetuMath.calculateFee(1_000_000, 0);
        assertEq(fee, 0);
        assertEq(sellerProceeds, 1_000_000);
    }

    function testRoundingDown() public pure {
        uint256 gross = 101;
        (uint256 fee, uint256 sellerProceeds) = UStetuMath.calculateFee(gross, 100);
        assertEq(fee, 1);
        assertEq(sellerProceeds, 100);
    }

    function testGrossPaymentNormalizes18To6Decimals() public pure {
        uint256 tokenAmount = 100 ether;
        uint256 unitPrice = 2_700_000;

        uint256 grossPayment = UStetuMath.calculateGrossPayment(tokenAmount, unitPrice, 18);

        assertEq(grossPayment, 270e6);
    }

    function testGrossPaymentSupportsFractionalTokenAmount() public pure {
        uint256 tokenAmount = 100.5 ether;
        uint256 unitPrice = 2_700_000;

        uint256 grossPayment = UStetuMath.calculateGrossPayment(tokenAmount, unitPrice, 18);

        assertEq(grossPayment, 271.35e6);
    }

    function testFuzzFeeConservation(uint256 gross, uint16 feeBps) public pure {
        feeBps = uint16(bound(feeBps, 0, 1_000));
        gross = bound(gross, 0, type(uint256).max / 1_000);

        (uint256 fee, uint256 sellerProceeds) = UStetuMath.calculateFee(gross, feeBps);

        assertLe(fee, gross);
        assertEq(fee + sellerProceeds, gross);
    }
}
