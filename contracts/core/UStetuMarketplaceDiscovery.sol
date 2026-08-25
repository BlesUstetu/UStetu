// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuTypes} from "../libraries/UStetuTypes.sol";

/// @title UStetuMarketplaceDiscovery
/// @notice Read-only marketplace discovery adapter.
/// @dev Reads listing data from the canonical escrow contract. No custody or state mutation.
contract UStetuMarketplaceDiscovery {
    interface IEscrowReader {
        function totalListings() external view returns (uint256);
        function getListingIds(uint256 offset, uint256 limit) external view returns (uint256[] memory);
        function getActiveListingIds(uint256 offset, uint256 limit) external view returns (uint256[] memory);
        function getSellerListingIds(address seller, uint256 offset, uint256 limit)
            external
            view
            returns (uint256[] memory);
        function getListing(uint256 listingId) external view returns (UStetuTypes.Listing memory);
    }

    IEscrowReader public immutable escrow;

    error InvalidAddress();
    error InvalidRange();

    constructor(address escrowAddress) {
        if (escrowAddress == address(0)) revert InvalidAddress();
        escrow = IEscrowReader(escrowAddress);
    }

    function totalListings() external view returns (uint256) {
        return escrow.totalListings();
    }

    function getListingIds(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        _validateRange(limit);
        return escrow.getListingIds(offset, limit);
    }

    function getActiveListingIds(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        _validateRange(limit);
        return escrow.getActiveListingIds(offset, limit);
    }

    function getSellerListingIds(address seller, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        if (seller == address(0)) revert InvalidAddress();
        _validateRange(limit);
        return escrow.getSellerListingIds(seller, offset, limit);
    }

    function getListing(uint256 listingId) external view returns (UStetuTypes.Listing memory) {
        return escrow.getListing(listingId);
    }

    function getActiveListings(uint256 offset, uint256 limit)
        external
        view
        returns (UStetuTypes.Listing[] memory listings)
    {
        _validateRange(limit);
        uint256[] memory ids = escrow.getActiveListingIds(offset, limit);
        listings = new UStetuTypes.Listing[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            listings[i] = escrow.getListing(ids[i]);
        }
    }

    function getSellerListings(address seller, uint256 offset, uint256 limit)
        external
        view
        returns (UStetuTypes.Listing[] memory listings)
    {
        if (seller == address(0)) revert InvalidAddress();
        _validateRange(limit);
        uint256[] memory ids = escrow.getSellerListingIds(seller, offset, limit);
        listings = new UStetuTypes.Listing[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            listings[i] = escrow.getListing(ids[i]);
        }
    }

    function getAvailableInventory(uint256 listingId) external view returns (uint256) {
        UStetuTypes.Listing memory listing = escrow.getListing(listingId);
        return listing.inventoryDeposited - listing.inventoryLocked;
    }

    function isPurchasable(uint256 listingId, uint256 amount) external view returns (bool) {
        UStetuTypes.Listing memory listing = escrow.getListing(listingId);
        if (listing.seller == address(0)) return false;
        if (listing.status != UStetuTypes.ListingStatus.ACTIVE) return false;
        if (amount < listing.minOrderAmount || amount > listing.maxOrderAmount) return false;
        return listing.inventoryDeposited - listing.inventoryLocked >= amount;
    }

    function _validateRange(uint256 limit) internal pure {
        if (limit == 0 || limit > 100) revert InvalidRange();
    }
}
