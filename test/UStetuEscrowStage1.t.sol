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

    address internal feeRecipient = address(0xA11CE);
    address internal seller = address(0xB0B);
    address internal buyer = address(0xCAFE);
    address internal attacker = address(0xBAD);
    address internal withdrawalWallet = address(0xC0DE);
    bytes32 internal tokenId;

    function setUp() public {
        vm.chainId(8453);

        asset = new MockERC20("Test Asset", "TAST", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vm.etch(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, address(usdc).code);
        usdc = MockERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
        registry = new UStetuRegistry(8453, address(usdc));
        sellerRegistry = new UStetuSellerRegistry();
        escrow = new UStetuEscrow(
            address(registry),
            address(sellerRegistry),
            feeRecipient
        );
        tokenId = registry.registerToken(8453, address(asset));

        vm.prank(seller);
        sellerRegistry.registerSeller(withdrawalWallet);

        asset.mint(seller, 1_000 ether);
        usdc.mint(buyer, 10_000e6);
    }

    function testPermissionlessRegistryAndDeterministicPaymentAsset() public {
        assertEq(registry.getPaymentToken(), address(usdc));
        assertEq(registry.getDeploymentChainId(), 8453);
        assertTrue(registry.isRegisteredToken(tokenId));
        assertEq(escrow.paymentToken(), address(usdc));
        assertEq(escrow.FEE_BPS(), 100);
    }

    function testSellerCanCreateListingAndDepositExactInventory() public {
        _createListing(500 ether);

        UStetuTypes.Listing memory listing = escrow.getListing(1);
        assertEq(listing.seller, seller);
        assertEq(listing.inventoryDeposited, 500 ether);
        assertEq(listing.inventoryLocked, 0);
    }

    function testUnregisteredSellerCannotCreateListing() public {
        address unregistered = address(0x1234);
        asset.mint(unregistered, 100 ether);

        vm.startPrank(unregistered);
        asset.approve(address(escrow), 100 ether);
        vm.expectRevert();
        escrow.createListingAndDeposit(
            99, tokenId, unregistered, 2_700_000, 100 ether, 1 ether, 100 ether
        );
        vm.stopPrank();
    }

    function testAttackerCannotCreateListingForAnotherSeller() public {
        vm.expectRevert();
        vm.prank(attacker);
        escrow.createListingAndDeposit(
            99, tokenId, seller, 2_700_000, 100 ether, 1 ether, 100 ether
        );
    }

    function testSellerCanUpdateListing() public {
        _createListing(500 ether);

        vm.prank(seller);
        escrow.updateListingPrice(1, 3_000_000);
        vm.prank(seller);
        escrow.updateListingOrderLimits(1, 2 ether, 400 ether);

        UStetuTypes.Listing memory listing = escrow.getListing(1);
        assertEq(listing.price, 3_000_000);
        assertEq(listing.minOrderAmount, 2 ether);
        assertEq(listing.maxOrderAmount, 400 ether);
    }

    function testPauseResumeAndClose() public {
        _createListing(500 ether);

        vm.prank(seller);
        escrow.pauseListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.PAUSED));

        vm.prank(seller);
        escrow.resumeListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.ACTIVE));

        vm.prank(seller);
        escrow.closeListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.CLOSED));
    }

    function testInventoryCannotBeWithdrawnWhileLocked() public {
        _createListing(500 ether);

        vm.prank(buyer);
        escrow.createOrder(1, 100 ether);

        vm.expectRevert();
        vm.prank(seller);
        escrow.withdrawListingInventory(1, 401 ether);
    }

    function testCreateOrderLocksInventoryAndSnapshotsEconomics() public {
        _createListing(500 ether);

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

    function testExactFundingRequiresExactPaymentReceived() public {
        _createListing(500 ether);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        vm.stopPrank();

        assertEq(uint8(escrow.getOrder(orderId).state), uint8(UStetuTypes.OrderState.PAID));
        assertEq(usdc.balanceOf(address(escrow)), 270e6);
    }

    function testUnauthorizedFundingReverts() public {
        _createListing(500 ether);
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.expectRevert();
        vm.prank(attacker);
        escrow.fundOrder(orderId);
    }

    function testBuyerCompletionTransfersInventoryAndCreatesClaims() public {
        _createListing(500 ether);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        assertEq(asset.balanceOf(buyer), 100 ether);
        assertEq(escrow.claimable(seller, address(usdc)), 267.3e6);
        assertEq(escrow.claimable(feeRecipient, address(usdc)), 2.7e6);
        assertEq(escrow.getListing(1).inventoryDeposited, 400 ether);
        assertEq(escrow.getListing(1).inventoryLocked, 0);
        assertEq(uint8(escrow.getOrder(orderId).state), uint8(UStetuTypes.OrderState.COMPLETED));
    }

    function testSettlementRevertsWhenRecipientReceivesLessThanOrderAmount() public {
        _createListing(500 ether);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        vm.stopPrank();

        asset.setTransferFeeBps(1_000);

        vm.expectRevert();
        vm.prank(buyer);
        escrow.completeOrder(orderId);

        UStetuTypes.Order memory order = escrow.getOrder(orderId);
        UStetuTypes.Listing memory listing = escrow.getListing(1);

        assertEq(uint8(order.state), uint8(UStetuTypes.OrderState.PAID));
        assertEq(listing.inventoryDeposited, 500 ether);
        assertEq(listing.inventoryLocked, 100 ether);
        assertEq(escrow.claimable(seller, address(usdc)), 0);
        assertEq(escrow.claimable(feeRecipient, address(usdc)), 0);
        assertEq(asset.balanceOf(buyer), 0);
    }

    function testSellerWithdrawalUsesRegisteredWallet() public {
        _createListing(500 ether);

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
        assertEq(escrow.claimable(seller, address(usdc)), 0);
    }

    function testAutoReleaseIsPermissionlessAfter24Hours() public {
        _createListing(500 ether);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        vm.stopPrank();

        vm.warp(block.timestamp + 24 hours);

        vm.prank(attacker);
        escrow.autoReleaseOrder(orderId);

        assertEq(uint8(escrow.getOrder(orderId).state), uint8(UStetuTypes.OrderState.COMPLETED));
        assertEq(asset.balanceOf(buyer), 100 ether);
    }

    function testAutoReleaseBefore24HoursReverts() public {
        _createListing(500 ether);

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

    function testPendingOrderExpiresAfter15Minutes() public {
        _createListing(500 ether);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.warp(block.timestamp + 15 minutes);
        vm.prank(attacker);
        escrow.expireOrder(orderId);

        assertEq(uint8(escrow.getOrder(orderId).state), uint8(UStetuTypes.OrderState.EXPIRED));
        assertEq(escrow.getListing(1).inventoryLocked, 0);
        assertEq(escrow.getListing(1).inventoryDeposited, 500 ether);
    }

    function testFundingAfter15MinutesReverts() public {
        _createListing(500 ether);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.warp(block.timestamp + 15 minutes);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        vm.expectRevert();
        escrow.fundOrder(orderId);
        vm.stopPrank();
    }

    function testWithdrawalWalletDelayDoesNotBlockExistingClaimable() public {
        _createListing(500 ether);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270e6);
        escrow.fundOrder(orderId);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        vm.prank(seller);
        sellerRegistry.requestWithdrawalWalletChange(address(0xD00D));

        vm.prank(seller);
        escrow.withdrawClaimable();

        assertEq(usdc.balanceOf(withdrawalWallet), 267.3e6);
    }

    function _createListing(uint256 inventoryAmount) internal {
        vm.startPrank(seller);
        asset.approve(address(escrow), inventoryAmount);
        escrow.createListingAndDeposit(
            1,
            tokenId,
            seller,
            2_700_000,
            inventoryAmount,
            1 ether,
            inventoryAmount
        );
        vm.stopPrank();
    }
}
