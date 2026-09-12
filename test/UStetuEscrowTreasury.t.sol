// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";
import {UStetuRegistry} from "../contracts/core/UStetuRegistry.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract UStetuEscrowTreasuryTest is Test {
    UStetuRegistry internal registry;
    UStetuSellerRegistry internal sellerRegistry;
    UStetuEscrow internal escrow;
    MockERC20 internal asset;
    MockERC20 internal usdc;

    address internal admin = address(0xA11CE);
    address internal seller = address(0xB0B);
    address internal buyer = address(0xCAFE);
    address internal attacker = address(0xBAD);
    address internal withdrawalWallet = address(0xC0DE);
    bytes32 internal tokenId;

    function setUp() public {
        vm.startPrank(admin);
        registry = new UStetuRegistry(8453, admin);
        sellerRegistry = new UStetuSellerRegistry(admin);
        escrow = new UStetuEscrow(address(registry), address(sellerRegistry), admin);
        sellerRegistry.grantRole(sellerRegistry.CONFIG_ROLE(), address(escrow));

        asset = new MockERC20("Test Asset", "TAST", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        tokenId = registry.registerToken(8453, address(asset));
        registry.setTokenVerification(tokenId, UStetuTypes.VerificationStatus.APPROVED);
        registry.setPaymentTokenSupported(address(usdc), true);
        vm.stopPrank();

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

        uint256 fee = escrow.claimable(admin, address(usdc));
        assertEq(fee, 2.7e6);
        assertEq(usdc.balanceOf(admin), 0);

        vm.prank(admin);
        escrow.withdrawMarketplaceFee(address(usdc));

        assertEq(escrow.claimable(admin, address(usdc)), 0);
        assertEq(usdc.balanceOf(admin), fee);
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
        escrow.withdrawMarketplaceFee(address(usdc));
    }

    function testFeeWithdrawalCannotBeRepeated() public {
        _createListing();

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        vm.prank(admin);
        escrow.withdrawMarketplaceFee(address(usdc));

        vm.expectRevert();
        vm.prank(admin);
        escrow.withdrawMarketplaceFee(address(usdc));
    }

    function _createListing() internal {
        vm.startPrank(seller);
        asset.approve(address(escrow), 500 ether);
        escrow.createListingAndDeposit(1, tokenId, seller, address(usdc), 2_700_000, 500 ether, 1 ether, 500 ether);
        vm.stopPrank();
    }
}
