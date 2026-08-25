// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuMarketplaceDiscovery} from "../contracts/core/UStetuMarketplaceDiscovery.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";

contract MockEscrowReader {
    mapping(uint256 => UStetuTypes.Listing) internal listings;
    uint256[] internal ids;
    mapping(address => uint256[]) internal sellerIds;

    function addListing(uint256 id, address seller, UStetuTypes.ListingStatus status, uint256 inventory, uint256 locked)
        external
    {
        listings[id] = UStetuTypes.Listing({
            tokenId: 1,
            seller: seller,
            paymentToken: address(0xCAFE),
            price: 1e6,
            inventoryDeposited: inventory,
            inventoryLocked: locked,
            minOrderAmount: 1,
            maxOrderAmount: inventory,
            status: status,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });
        ids.push(id);
        sellerIds[seller].push(id);
    }

    function totalListings() external view returns (uint256) { return ids.length; }

    function getListingIds(uint256 offset, uint256 limit) external view returns (uint256[] memory result) {
        if (offset >= ids.length || limit == 0) return new uint256[](0);
        uint256 end = offset + limit;
        if (end > ids.length) end = ids.length;
        result = new uint256[](end - offset);
        for (uint256 i; i < result.length; ++i) result[i] = ids[offset + i];
    }

    function getActiveListingIds(uint256 offset, uint256 limit) external view returns (uint256[] memory result) {
        uint256 count;
        for (uint256 i; i < ids.length; ++i) {
            if (listings[ids[i]].status == UStetuTypes.ListingStatus.ACTIVE) ++count;
        }
        if (offset >= count || limit == 0) return new uint256[](0);
        uint256 wanted = limit;
        if (offset + wanted > count) wanted = count - offset;
        result = new uint256[](wanted);
        uint256 seen;
        for (uint256 i; i < ids.length && seen < offset + wanted; ++i) {
            if (listings[ids[i]].status != UStetuTypes.ListingStatus.ACTIVE) continue;
            if (seen >= offset) result[seen - offset] = ids[i];
            ++seen;
        }
    }

    function getSellerListingIds(address seller, uint256 offset, uint256 limit)
        external view returns (uint256[] memory result)
    {
        uint256[] storage source = sellerIds[seller];
        if (offset >= source.length || limit == 0) return new uint256[](0);
        uint256 end = offset + limit;
        if (end > source.length) end = source.length;
        result = new uint256[](end - offset);
        for (uint256 i; i < result.length; ++i) result[i] = source[offset + i];
    }

    function getListing(uint256 id) external view returns (UStetuTypes.Listing memory) {
        return listings[id];
    }
}

contract UStetuMarketplaceDiscoveryTest is Test {
    MockEscrowReader internal mock;
    UStetuMarketplaceDiscovery internal discovery;
    address internal seller = address(0xB0B);

    function setUp() public {
        mock = new MockEscrowReader();
        discovery = new UStetuMarketplaceDiscovery(address(mock));
        mock.addListing(1, seller, UStetuTypes.ListingStatus.ACTIVE, 100, 20);
        mock.addListing(2, seller, UStetuTypes.ListingStatus.PAUSED, 50, 10);
        mock.addListing(3, address(0xC0DE), UStetuTypes.ListingStatus.ACTIVE, 200, 0);
    }

    function testTotalAndPagination() public view {
        assertEq(discovery.totalListings(), 3);
        uint256[] memory ids = discovery.getListingIds(1, 2);
        assertEq(ids.length, 2);
        assertEq(ids[0], 2);
        assertEq(ids[1], 3);
    }

    function testActiveListings() public view {
        uint256[] memory ids = discovery.getActiveListingIds(0, 10);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 3);

        UStetuTypes.Listing[] memory listings = discovery.getActiveListings(0, 10);
        assertEq(listings.length, 2);
        assertEq(listings[0].seller, seller);
    }

    function testSellerListings() public view {
        uint256[] memory ids = discovery.getSellerListingIds(seller, 0, 10);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);

        UStetuTypes.Listing[] memory listings = discovery.getSellerListings(seller, 0, 10);
        assertEq(listings.length, 2);
    }

    function testAvailableInventoryAndPurchasable() public view {
        assertEq(discovery.getAvailableInventory(1), 80);
        assertTrue(discovery.isPurchasable(1, 50));
        assertFalse(discovery.isPurchasable(1, 81));
        assertFalse(discovery.isPurchasable(2, 10));
    }

    function testRangeValidation() public {
        vm.expectRevert(UStetuMarketplaceDiscovery.InvalidRange.selector);
        discovery.getListingIds(0, 0);

        vm.expectRevert(UStetuMarketplaceDiscovery.InvalidRange.selector);
        discovery.getActiveListingIds(0, 101);
    }

    function testInvalidSellerReverts() public {
        vm.expectRevert(UStetuMarketplaceDiscovery.InvalidAddress.selector);
        discovery.getSellerListings(address(0), 0, 10);
    }
}
