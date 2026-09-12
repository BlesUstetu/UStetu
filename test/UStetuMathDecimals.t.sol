// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuMath} from "../contracts/libraries/UStetuMath.sol";

contract UStetuMathDecimalsTest is Test {
    function testGrossPaymentSupports6DecimalToken() public pure {
        uint256 tokenAmount = 100e6;
        uint256 unitPrice = 2_700_000;
        assertEq(UStetuMath.calculateGrossPayment(tokenAmount, unitPrice, 6), 270e6);
    }

    function testGrossPaymentSupports8DecimalToken() public pure {
        uint256 tokenAmount = 100e8;
        uint256 unitPrice = 2_700_000;
        assertEq(UStetuMath.calculateGrossPayment(tokenAmount, unitPrice, 8), 270e6);
    }

    function testGrossPaymentSupports9DecimalToken() public pure {
        uint256 tokenAmount = 100e9;
        uint256 unitPrice = 2_700_000;
        assertEq(UStetuMath.calculateGrossPayment(tokenAmount, unitPrice, 9), 270e6);
    }

    function testGrossPaymentRoundsDownAtTokenPrecision() public pure {
        uint256 tokenAmount = 1;
        uint256 unitPrice = 1_000_000;
        assertEq(UStetuMath.calculateGrossPayment(tokenAmount, unitPrice, 6), 1);
    }
}
