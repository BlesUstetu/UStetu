// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";
import {UStetuRegistry} from "../contracts/core/UStetuRegistry.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract UStetuEscrowStage1Test is Test {
    UStetuRegistry internal registry;
    UStetuSellerRegistry internal sellerRegistry;
    UStetuEscrow internal escrow;
    MockERC20 internal asset;
    MockERC20 internal usdc;

    address internal admin = address(0xA11CE);
    address internal seller = address(0xB0B);
    address internal buyer = address(0xCAFE);
    address internal attacker = address(0xBAD);
    address internal secondSeller = address(0xD00D);
    address internal withdrawalWallet = address(0xC0DE);

    bytes32 internal tokenId;

    function setUp() public {
        vm.chainId(8453);
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

        vm.prank(secondSeller);
        sellerRegistry.registerSeller(secondSeller);

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
        assertEq(sellerRegistry.getSeller(seller).activeListingCount, 1);
    }

    function testUnregisteredSellerCannotCreateListing() public {
        address unregistered = address(0x1234);
        asset.mint(unregistered, 100 ether);
        vm.startPrank(unregistered);
        asset.approve(address(escrow), 100 ether);
        vm.expectRevert();
        escrow.createListingAndDeposit(99, tokenId, unregistered, address(usdc), 2_700_000, 100 ether, 1 ether, 100 ether);
        vm.stopPrank();
    }

    function testAttackerCannotCreateListingForAnotherSeller() public {
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

    function testSellerCanPauseAndResumeListingAndCounterTracksState() public {
        _createListing(500 ether, 2_700_000);
        assertEq(sellerRegistry.getSeller(seller).activeListingCount, 1);

        vm.prank(seller);
        escrow.pauseListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.PAUSED));
        assertEq(sellerRegistry.getSeller(seller).activeListingCount, 0);

        vm.expectRevert();
        vm.prank(buyer);
        escrow.createOrder(1, 10 ether);

        vm.prank(seller);
        escrow.resumeListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.ACTIVE));
        assertEq(sellerRegistry.getSeller(seller).activeListingCount, 1);
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
        assertEq(sellerRegistry.getSeller(seller).activeListingCount, 0);

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
        assertEq(order.expiresAt, uint64(block.timestamp + escrow.AUTO_RELEASE_WINDOW()));
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
        assertEq(sellerRegistry.getSeller(seller).totalCompletedOrders, 1);
    }

    function testSellerProceedsWithdrawToRegisteredWallet() public {
        _createListing(500 ether, 2_700_000);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        uint256 proceeds = escrow.claimable(seller, address(usdc));
        assertEq(usdc.balanceOf(withdrawalWallet), 0);

        vm.prank(seller);
        escrow.withdrawClaimable(address(usdc));

        assertEq(escrow.claimable(seller, address(usdc)), 0);
        assertEq(usdc.balanceOf(withdrawalWallet), proceeds);
        assertEq(usdc.balanceOf(seller), 0);
    }

    function testCannotWithdrawClaimableAsUnregisteredSeller() public {
        vm.expectRevert();
        vm.prank(attacker);
        escrow.withdrawClaimable(address(usdc));
    }

    function testCannotWithdrawSellerClaimableToArbitraryCallerWallet() public {
        _createListing(500 ether, 2_700_000);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        uint256 proceeds = escrow.claimable(seller, address(usdc));
        assertGt(proceeds, 0);
        vm.expectRevert();
        vm.prank(attacker);
        escrow.withdrawClaimable(address(usdc));
    }

    function testAutoReleaseAfter24HoursIsPermissionless() public {
        _createListing(500 ether, 2_700_000);
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        vm.stopPrank();

        vm.warp(block.timestamp + 24 hours);
        uint256 buyerTokenBefore = asset.balanceOf(buyer);

        vm.prank(attacker);
        escrow.autoReleaseOrder(orderId);

        UStetuTypes.Order memory order = escrow.getOrder(orderId);
        UStetuTypes.Listing memory listing = escrow.getListing(1);
        assertEq(uint8(order.state), uint8(UStetuTypes.OrderState.COMPLETED));
        assertEq(asset.balanceOf(buyer) - buyerTokenBefore, 100 ether);
        assertEq(escrow.claimable(seller, address(usdc)), 267.3e6);
        assertEq(escrow.claimable(admin, address(usdc)), 2.7e6);
        assertEq(listing.inventoryLocked, 0);
        assertEq(listing.inventoryDeposited, 400 ether);
        assertEq(sellerRegistry.getSeller(seller).totalCompletedOrders, 1);
    }

    function testAutoReleaseBefore24HoursReverts() public {
        _createListing(500 ether, 2_700_000);
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        vm.stopPrank();

        vm.expectRevert();
        vm.prank(attacker);
        escrow.autoReleaseOrder(orderId);
    }

    function testPendingOrderExpiresAfter15MinutesAndUnlocksInventory() public {
        _createListing(500 ether, 2_700_000);
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.warp(block.timestamp + 15 minutes);
        vm.prank(attacker);
        escrow.expireOrder(orderId);

        UStetuTypes.Order memory order = escrow.getOrder(orderId);
        UStetuTypes.Listing memory listing = escrow.getListing(1);
        assertEq(uint8(order.state), uint8(UStetuTypes.OrderState.EXPIRED));
        assertEq(listing.inventoryLocked, 0);
        assertEq(listing.inventoryDeposited, 500 ether);
        assertEq(escrow.sellerInventory(seller, address(asset)), 500 ether);
    }

    function testFundingAfter15MinutePaymentWindowReverts() public {
        _createListing(500 ether, 2_700_000);
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.warp(block.timestamp + 15 minutes);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        vm.expectRevert();
        escrow.fundOrder(orderId);
        vm.stopPrank();
    }

    function testFeeCanBeSetBetweenZeroAndFivePercent() public {
        vm.startPrank(admin);
        escrow.setFeeBps(0);
        assertEq(escrow.feeBps(), 0);
        escrow.setFeeBps(500);
        assertEq(escrow.feeBps(), 500);
        vm.stopPrank();
    }

    function testFeeAboveFivePercentReverts() public {
        vm.expectRevert();
        vm.prank(admin);
        escrow.setFeeBps(501);
    }

    function testNonOwnerCannotChangeFee() public {
        vm.expectRevert();
        vm.prank(attacker);
        escrow.setFeeBps(0);
    }

    function testFeeChangeOnlyAppliesToNewOrders() public {
        _createListing(500 ether, 2_700_000);

        vm.prank(buyer);
        uint256 order1 = escrow.createOrder(1, 100 ether);
        assertEq(escrow.getOrder(order1).marketplaceFee, 2.7e6);

        vm.prank(admin);
        escrow.setFeeBps(0);

        vm.prank(buyer);
        uint256 order2 = escrow.createOrder(1, 100 ether);
        assertEq(escrow.getOrder(order2).marketplaceFee, 0);
        assertEq(escrow.getOrder(order1).marketplaceFee, 2.7e6);
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
