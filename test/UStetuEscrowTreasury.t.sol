// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";
import {UStetuRegistry} from "../contracts/core/UStetuRegistry.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract UStetuEscrowTreasuryTest is Test {
    UStetuRegistry internal registry;
    UStetuSellerRegistry internal sellerRegistry;
    UStetuEscrow internal escrow;
    MockERC20 internal asset;
    MockERC20 internal usdc;

    address internal feeRecipient = address(0xA11CE);
    address internal seller = address(0xB0B);
    address internal buyer = address(0xCAFE);
    address internal attacker = address(0xBAD);
    address internal withdrawalWallet = address(0xC0DE);
    bytes32 internal tokenId;

    function setUp() public {
        vm.chainId(8453);
        registry = new UStetuRegistry(8453, address(0x1111));
        sellerRegistry = new UStetuSellerRegistry();
        asset = new MockERC20("Test Asset", "TAST", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        registry = new UStetuRegistry(8453, address(usdc));
        escrow = new UStetuEscrow(address(registry), address(sellerRegistry), feeRecipient);
        tokenId = registry.registerToken(8453, address(asset));

        vm.prank(seller);
        sellerRegistry.registerSeller(withdrawalWallet);

        asset.mint(seller, 1_000 ether);
        usdc.mint(buyer, 10_000e6);
    }

    function testFeeRecipientCanWithdrawMarketplaceFee() public {
        _createListing();
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        assertEq(escrow.claimable(feeRecipient, address(usdc)), 2.7e6);

        vm.prank(feeRecipient);
        escrow.withdrawMarketplaceFee();

        assertEq(escrow.claimable(feeRecipient, address(usdc)), 0);
        assertEq(usdc.balanceOf(feeRecipient), 2.7e6);
        assertEq(usdc.balanceOf(address(escrow)), 267.3e6);
    }

    function testNonFeeRecipientCannotWithdrawMarketplaceFee() public {
        _createListing();
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        vm.expectRevert();
        vm.prank(attacker);
        escrow.withdrawMarketplaceFee();
    }

    function testClaimableWithdrawDoesNotDependOnRegistrySupportFlag() public {
        _createListing();
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        vm.prank(seller);
        escrow.withdrawClaimable();

        assertEq(usdc.balanceOf(withdrawalWallet), 267.3e6);
    }

    function _createListing() internal {
        vm.startPrank(seller);
        asset.approve(address(escrow), 500 ether);
        escrow.createListingAndDeposit(
            1,
            tokenId,
            seller,
            2_700_000,
            500 ether,
            1 ether,
            500 ether
        );
        vm.stopPrank();
    }
}
