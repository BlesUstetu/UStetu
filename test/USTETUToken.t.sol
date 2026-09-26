// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {USTETUToken} from "../contracts/token/USTETUToken.sol";

contract USTETUTokenTest is Test {
    USTETUToken internal token;

    address internal deployer = address(0xD3P10);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant TOTAL_SUPPLY = 88_000_000 ether;

    function setUp() public {
        vm.prank(deployer);
        token = new USTETUToken();
    }

    function testMetadataIsFixed() public view {
        assertEq(token.name(), "USTETU");
        assertEq(token.symbol(), "USTETU");
        assertEq(token.decimals(), 18);
        assertEq(token.TOTAL_SUPPLY(), TOTAL_SUPPLY);
    }

    function testEntireFixedSupplyIsMintedToDeployer() public view {
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
        assertEq(token.balanceOf(deployer), TOTAL_SUPPLY);
        assertEq(token.balanceOf(alice), 0);
    }

    function testTransferMovesExactAmount() public {
        uint256 amount = 1_250 ether;

        vm.prank(deployer);
        token.transfer(alice, amount);

        assertEq(token.balanceOf(deployer), TOTAL_SUPPLY - amount);
        assertEq(token.balanceOf(alice), amount);
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }

    function testApproveAndTransferFrom() public {
        uint256 amount = 500 ether;

        vm.prank(deployer);
        token.approve(alice, amount);

        assertEq(token.allowance(deployer, alice), amount);

        vm.prank(alice);
        token.transferFrom(deployer, bob, amount);

        assertEq(token.balanceOf(deployer), TOTAL_SUPPLY - amount);
        assertEq(token.balanceOf(bob), amount);
        assertEq(token.allowance(deployer, alice), 0);
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }

    function testTransferFromCannotExceedAllowance() public {
        uint256 allowanceAmount = 100 ether;
        uint256 transferAmount = 101 ether;

        vm.prank(deployer);
        token.approve(alice, allowanceAmount);

        vm.expectRevert();
        vm.prank(alice);
        token.transferFrom(deployer, bob, transferAmount);

        assertEq(token.balanceOf(deployer), TOTAL_SUPPLY);
        assertEq(token.balanceOf(bob), 0);
        assertEq(token.allowance(deployer, alice), allowanceAmount);
    }

    function testTransferCannotExceedBalance() public {
        vm.expectRevert();
        vm.prank(alice);
        token.transfer(bob, 1);

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), 0);
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }

    function testMultipleTransfersPreserveFixedTotalSupply() public {
        uint256 first = 1_000 ether;
        uint256 second = 250 ether;

        vm.startPrank(deployer);
        token.transfer(alice, first);
        token.transfer(bob, second);
        vm.stopPrank();

        vm.prank(alice);
        token.transfer(bob, 400 ether);

        assertEq(token.balanceOf(deployer), TOTAL_SUPPLY - first - second);
        assertEq(token.balanceOf(alice), first - 400 ether);
        assertEq(token.balanceOf(bob), second + 400 ether);
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }
}
