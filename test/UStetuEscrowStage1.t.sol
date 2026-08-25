// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";
import {UStetuRegistry} from "../contracts/core/UStetuRegistry.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract UStetuEscrowStage1Test is Test {
    UStetuRegistry internal registry;
    UStetuEscrow internal escrow;
    MockERC20 internal asset;
    MockERC20 internal usdc;

    address internal admin = address(0xA11CE);
    address internal seller = address(0xB0B);
    address internal buyer = address(0xCAFE);
    address internal attacker = address(0xBAD);
    address internal secondSeller = address(0xD00D);

    bytes32 internal tokenId;

    function setUp() public {
        vm.chainId(8453);
        vm.startPrank(admin);
        registry = new UStetuRegistry(8453, admin);
        escrow = new UStetuEscrow(address(registry), admin);

        asset = new MockERC20("Test Asset", "TAST", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        tokenId = registry.registerToken(8453, address(asset));
        registry.setTokenVerification(tokenId, UStetuTypes.VerificationStatus.APPROVED);
        registry.setPaymentTokenSupported(address(usdc), true);
        vm.stopPrank();

        asset.mint(seller, 1_000 ether);
        asset.mint(secondSeller, 1_000 ether);
        usdc.mint(buyer, 10_000e6);
    }

    function testSellerCanCreateListingAndDepositExactInventory() public {
        vm.startPrank(seller);
        asset.approve(address(escrow), 500 ether);
        escrow.createListingAndDeposit(1, tokenId, seller, address(usdc), 2_700_000, 500 ether, 1 ether, 500 ether);
        vm.stopPrank();

        UStetuTypes.Listing memory listing = escrow.getListing(1);
        assertEq(listing.seller, seller);
        assertEq(listing.inventoryDeposited, 500 ether);
        assertEq(escrow.sellerInventory(seller, address(asset)), 500 ether);
    }

    function testAttackerCannotCreateListingForAnotherSeller() public {
        asset.mint(seller, 100 ether);
        vm.startPrank(attacker);
        vm.expectRevert();
        escrow.createListingAndDeposit(99, tokenId, seller, address(usdc), 2_700_000, 100 ether, 1 ether, 100 ether);
        vm.stopPrank();
    }

    function testSellerCanUpdatePriceAndOrderLimits() public {
        _createListing(500 ether, 2_700_000);

        vm.prank(seller);
        escrow.updateListingPrice(1, 3_000_000);
        vm.prank(seller);
        escrow.updateListingOrderLimits(1, 2 ether, 400 ether);

        UStetuTypes.Listing memory listing = escrow.getListing(1);
        assertEq(listing.price, 3_000_000);
        assertEq(listing.minOrderAmount, 2 ether);
        assertEq(listing.maxOrderAmount, 400 ether);
    }

    function testAttackerCannotManageListing() public {
        _createListing(500 ether, 2_700_000);

        vm.expectRevert();
        vm.prank(attacker);
        escrow.updateListingPrice(1, 3_000_000);

        vm.expectRevert();
        vm.prank(attacker);
        escrow.pauseListing(1);
    }

    function testSellerCanPauseAndResumeListing() public {
        _createListing(500 ether, 2_700_000);

        vm.prank(seller);
        escrow.pauseListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.PAUSED));

        vm.expectRevert();
        vm.prank(buyer);
        escrow.createOrder(1, 10 ether);

        vm.prank(seller);
        escrow.resumeListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.ACTIVE));
    }

    function testSellerCanAddAndWithdrawAvailableInventory() public {
        _createListing(500 ether, 2_700_000);

        vm.startPrank(seller);
        asset.approve(address(escrow), 200 ether);
        escrow.addListingInventory(1, 200 ether);
        uint256 before = asset.balanceOf(seller);
        escrow.withdrawListingInventory(1, 150 ether);
        vm.stopPrank();

        assertEq(asset.balanceOf(seller) - before, 150 ether);
        assertEq(escrow.sellerInventory(seller, address(asset)), 550 ether);
        assertEq(escrow.getListing(1).inventoryDeposited, 550 ether);
    }

    function testCannotWithdrawLockedInventory() public {
        _createListing(500 ether, 2_700_000);
        vm.prank(buyer);
        escrow.createOrder(1, 100 ether);

        vm.expectRevert();
        vm.prank(seller);
        escrow.withdrawListingInventory(1, 401 ether);
    }

    function testSellerCanCloseListingButOpenOrdersRemainLocked() public {
        _createListing(500 ether, 2_700_000);
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.prank(seller);
        escrow.closeListing(1);

        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.CLOSED));
        assertEq(escrow.getListing(1).inventoryLocked, 100 ether);
        assertEq(escrow.getOrder(orderId).tokenAmount, 100 ether);

        vm.expectRevert();
        vm.prank(buyer);
        escrow.createOrder(1, 10 ether);
    }

    function testCreateOrderLocksInventoryAndSnapshotsPrice() public {
        _createListing(500 ether, 2_700_000);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        UStetuTypes.Order memory order = escrow.getOrder(orderId);
        UStetuTypes.Listing memory listing = escrow.getListing(1);

        assertEq(order.buyer, buyer);
        assertEq(order.recipient, buyer);
        assertEq(order.seller, seller);
        assertEq(order.tokenAmount, 100 ether);
        assertEq(order.unitPrice, 2_700_000);
        assertEq(order.grossPayment, 270e6);
        assertEq(order.marketplaceFee, 2.7e6);
        assertEq(order.sellerProceeds, 267.3e6);
        assertEq(uint8(order.state), uint8(UStetuTypes.OrderState.PAYMENT_PENDING));
        assertEq(listing.inventoryLocked, 100 ether);
    }

    function testUnauthorizedFundingReverts() public {
        _createListing(500 ether, 2_700_000);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.expectRevert();
        vm.prank(attacker);
        escrow.fundOrder(orderId);
    }

    function testExactFundingMovesOrderToPaid() public {
        _createListing(500 ether, 2_700_000);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        vm.stopPrank();

        UStetuTypes.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(UStetuTypes.OrderState.PAID));
        assertEq(usdc.balanceOf(address(escrow)), 270e6);
        assertEq(order.paidAt, uint64(block.timestamp));
    }

    function testBuyerCanCompleteAndSellerFeeIsOnePercent() public {
        _createListing(500 ether, 2_700_000);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        uint256 buyerTokenBefore = asset.balanceOf(buyer);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        UStetuTypes.Order memory order = escrow.getOrder(orderId);
        UStetuTypes.Listing memory listing = escrow.getListing(1);

        assertEq(uint8(order.state), uint8(UStetuTypes.OrderState.COMPLETED));
        assertEq(asset.balanceOf(buyer) - buyerTokenBefore, 100 ether);
        assertEq(escrow.claimable(seller, address(usdc)), 267.3e6);
        assertEq(escrow.claimable(admin, address(usdc)), 2.7e6);
        assertEq(listing.inventoryLocked, 0);
        assertEq(listing.inventoryDeposited, 400 ether);
        assertEq(escrow.sellerInventory(seller, address(asset)), 400 ether);
        assertEq(usdc.balanceOf(address(escrow)), 270e6);
    }

    function testCannotCompleteOrderByAttacker() public {
        _createListing(500 ether, 2_700_000);
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        vm.stopPrank();

        vm.expectRevert();
        vm.prank(attacker);
        escrow.completeOrder(orderId);
    }

    function testExpiredPaidOrderCanBeRefunded() public {
        _createListing(500 ether, 2_700_000);
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        uint256 balanceBefore = usdc.balanceOf(buyer);
        vm.warp(block.timestamp + 1 days);
        escrow.refundExpiredOrder(orderId);
        vm.stopPrank();

        UStetuTypes.Order memory order = escrow.getOrder(orderId);
        UStetuTypes.Listing memory listing = escrow.getListing(1);
        assertEq(uint8(order.state), uint8(UStetuTypes.OrderState.REFUNDED));
        assertEq(usdc.balanceOf(buyer) - balanceBefore, 270e6);
        assertEq(listing.inventoryLocked, 0);
        assertEq(listing.inventoryDeposited, 500 ether);
        assertEq(escrow.sellerInventory(seller, address(asset)), 500 ether);
    }

    function testFundingAfterExpiryReverts() public {
        _createListing(500 ether, 2_700_000);
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.warp(block.timestamp + 1 days);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        vm.expectRevert();
        escrow.fundOrder(orderId);
        vm.stopPrank();
    }

    function testCannotCreateOrderAboveAvailableInventory() public {
        _createListing(50 ether, 2_700_000);
        vm.expectRevert();
        vm.prank(buyer);
        escrow.createOrder(1, 51 ether);
    }

    function testCannotDuplicateListingId() public {
        _createListing(500 ether, 2_700_000);
        vm.startPrank(seller);
        asset.approve(address(escrow), 500 ether);
        vm.expectRevert();
        escrow.createListingAndDeposit(1, tokenId, seller, address(usdc), 2_700_000, 500 ether, 1 ether, 500 ether);
        vm.stopPrank();
    }

    function _createListing(uint256 inventoryAmount, uint256 price) internal {
        vm.startPrank(seller);
        asset.approve(address(escrow), inventoryAmount);
        escrow.createListingAndDeposit(1, tokenId, seller, address(usdc), price, inventoryAmount, 1 ether, inventoryAmount);
        vm.stopPrank();
    }
}
