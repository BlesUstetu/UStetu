// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuMath} from "../contracts/libraries/UStetuMath.sol";

contract UStetuMathTest is Test {
    function testFeeAtOnePercent() public pure {
        uint256 gross = 270e6;
        uint256 fee = UStetuMath.calculateFee(gross, 100);
        assertEq(fee, 2.7e6);
        assertEq(gross - fee, 267.3e6);
    }

    function testZeroFee() public pure {
        assertEq(UStetuMath.calculateFee(1_000_000, 0), 0);
    }

    function testRoundingDown() public pure {
        uint256 gross = 101;
        uint256 fee = UStetuMath.calculateFee(gross, 100);
        assertEq(fee, 1);
        assertEq(gross - fee, 100);
    }

    function testFuzzFeeConservation(uint256 gross, uint16 feeBps) public pure {
        feeBps = uint16(bound(feeBps, 0, 1_000));
        gross = bound(gross, 0, type(uint256).max / 1_000);

        uint256 fee = UStetuMath.calculateFee(gross, feeBps);
        uint256 sellerProceeds = gross - fee;

        assertLe(fee, gross);
        assertEq(fee + sellerProceeds, gross);
    }
}
