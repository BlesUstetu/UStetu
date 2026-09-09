// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";
import {UStetuRegistry} from "../contracts/core/UStetuRegistry.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract UStetuMarketplaceListingTest is Test {
    UStetuRegistry internal registry;
    UStetuSellerRegistry internal sellerRegistry;
    UStetuEscrow internal escrow;
    MockERC20 internal asset;
    MockERC20 internal usdc;
    address internal admin = address(0xA11CE);
    address internal seller = address(0xB0B);
    address internal withdrawalWallet = address(0xC0DE);
    address internal buyer = address(0xBEEF);
    address internal attacker = address(0xBAD);
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
        asset.mint(seller, 1_000 ether);
    }

    function testCreateListingRequiresSellerCaller() public {
        asset.mint(attacker, 100 ether);
        vm.prank(attacker);
        asset.approve(address(escrow), 100 ether);
        vm.expectRevert();
        escrow.createListingAndDeposit(1, tokenId, seller, address(usdc), 2_700_000, 100 ether, 1 ether, 100 ether);
    }

    function testUnregisteredSellerCannotCreateListing() public {
        address unregistered = address(0x1234);
        asset.mint(unregistered, 100 ether);
        vm.startPrank(unregistered);
        asset.approve(address(escrow), 100 ether);
        vm.expectRevert();
        escrow.createListingAndDeposit(1, tokenId, unregistered, address(usdc), 2_700_000, 100 ether, 1 ether, 100 ether);
        vm.stopPrank();
    }

    function testSellerCanUpdatePriceAndLimits() public {
        _createListing();
        vm.startPrank(seller);
        escrow.updateListingPrice(1, 3_000_000);
        escrow.updateListingOrderLimits(1, 2 ether, 200 ether);
        vm.stopPrank();
        UStetuTypes.Listing memory listing = escrow.getListing(1);
        assertEq(listing.price, 3_000_000);
        assertEq(listing.minOrderAmount, 2 ether);
        assertEq(listing.maxOrderAmount, 200 ether);
    }

    function testUnauthorizedListingManagementReverts() public {
        _createListing();
        vm.expectRevert();
        vm.prank(attacker);
        escrow.updateListingPrice(1, 3_000_000);
        vm.expectRevert();
        vm.prank(attacker);
        escrow.pauseListing(1);
    }

    function testPauseResumeChangesAvailabilityAndCounter() public {
        _createListing();
        assertEq(sellerRegistry.getSeller(seller).activeListingCount, 1);
        vm.prank(seller);
        escrow.pauseListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.PAUSED));
        assertEq(sellerRegistry.getSeller(seller).activeListingCount, 0);
        vm.prank(seller);
        escrow.resumeListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.ACTIVE));
        assertEq(sellerRegistry.getSeller(seller).activeListingCount, 1);
    }

    function testCloseListingIsPermanentAndUpdatesCounter() public {
        _createListing();
        vm.prank(seller);
        escrow.closeListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.CLOSED));
        assertEq(sellerRegistry.getSeller(seller).activeListingCount, 0);
        vm.expectRevert();
        vm.prank(seller);
        escrow.resumeListing(1);
    }

    function testInventoryCanBeAddedAndWithdrawnOnlyUnlocked() public {
        _createListing();
        vm.startPrank(seller);
        asset.approve(address(escrow), 200 ether);
        escrow.addListingInventory(1, 200 ether);
        escrow.withdrawListingInventory(1, 100 ether);
        vm.stopPrank();
        assertEq(escrow.getListing(1).inventoryDeposited, 600 ether);
        assertEq(escrow.sellerInventory(seller, address(asset)), 600 ether);
    }

    function testCannotWithdrawLockedInventory() public {
        _createListing();
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);
        orderId;
        vm.expectRevert();
        vm.prank(seller);
        escrow.withdrawListingInventory(1, 401 ether);
    }

    function testSellerProceedsWithdrawToRegisteredWallet() public {
        _createListing();
        usdc.mint(buyer, 270_000_000);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(1, 100 ether);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), 270_000_000);
        escrow.fundOrder(orderId);
        escrow.completeOrder(orderId);
        vm.stopPrank();

        uint256 proceeds = escrow.claimable(seller, address(usdc));
        assertEq(proceeds, 267_300_000);
        assertEq(usdc.balanceOf(withdrawalWallet), 0);

        vm.prank(seller);
        escrow.withdrawClaimable(address(usdc));

        assertEq(escrow.claimable(seller, address(usdc)), 0);
        assertEq(usdc.balanceOf(withdrawalWallet), proceeds);
        assertEq(usdc.balanceOf(seller), 0);
    }

    function _createListing() internal {
        vm.startPrank(seller);
        asset.approve(address(escrow), 500 ether);
        escrow.createListingAndDeposit(1, tokenId, seller, address(usdc), 2_700_000, 500 ether, 1 ether, 500 ether);
        vm.stopPrank();
    }
}
