// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";
import {UStetuRegistry} from "../contracts/core/UStetuRegistry.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract UStetuMarketplaceListingTest is Test {
    UStetuRegistry internal registry;
    UStetuEscrow internal escrow;
    MockERC20 internal asset;
    MockERC20 internal usdc;
    address internal admin = address(0xA11CE);
    address internal seller = address(0xB0B);
    address internal attacker = address(0xBAD);
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
    }

    function testCreateListingRequiresSellerCaller() public {
        asset.mint(attacker, 100 ether);
        vm.prank(attacker);
        asset.approve(address(escrow), 100 ether);
        vm.expectRevert();
        escrow.createListingAndDeposit(1, tokenId, seller, address(usdc), 2_700_000, 100 ether, 1 ether, 100 ether);
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

    function testPauseResumeChangesAvailability() public {
        _createListing();
        vm.prank(seller);
        escrow.pauseListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.PAUSED));
        vm.prank(seller);
        escrow.resumeListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.ACTIVE));
    }

    function testCloseListingIsPermanent() public {
        _createListing();
        vm.prank(seller);
        escrow.closeListing(1);
        assertEq(uint8(escrow.getListing(1).status), uint8(UStetuTypes.ListingStatus.CLOSED));
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
        vm.prank(address(0xCAFE));
        uint256 orderId = escrow.createOrder(1, 100 ether);
        orderId;
        vm.expectRevert();
        vm.prank(seller);
        escrow.withdrawListingInventory(1, 401 ether);
    }

    function _createListing() internal {
        vm.startPrank(seller);
        asset.approve(address(escrow), 500 ether);
        escrow.createListingAndDeposit(1, tokenId, seller, address(usdc), 2_700_000, 500 ether, 1 ether, 500 ether);
        vm.stopPrank();
    }
}
