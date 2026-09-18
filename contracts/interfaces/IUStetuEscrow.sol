// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuTypes} from "../libraries/UStetuTypes.sol";

interface IUStetuEscrow {
    function PAYMENT_WINDOW() external view returns (uint64);
    function AUTO_RELEASE_WINDOW() external view returns (uint64);
    function ORDER_EXPIRY() external view returns (uint64);
    function BPS_DENOMINATOR() external view returns (uint256);
    function FEE_BPS() external view returns (uint256);
    function paymentToken() external view returns (address);

    function createListingAndDeposit(
        uint256 listingId,
        bytes32 tokenId,
        address seller,
        uint256 price,
        uint256 inventoryAmount,
        uint256 minOrderAmount,
        uint256 maxOrderAmount
    ) external;

    function addListingInventory(uint256 listingId, uint256 amount) external;
    function withdrawListingInventory(uint256 listingId, uint256 amount) external;
    function updateListingPrice(uint256 listingId, uint256 newPrice) external;
    function updateListingOrderLimits(
        uint256 listingId,
        uint256 newMinOrderAmount,
        uint256 newMaxOrderAmount
    ) external;
    function pauseListing(uint256 listingId) external;
    function resumeListing(uint256 listingId) external;
    function closeListing(uint256 listingId) external;

    function createOrder(
        uint256 listingId,
        uint256 tokenAmount
    ) external returns (uint256 orderId);
    function fundOrder(uint256 orderId) external;
    function completeOrder(uint256 orderId) external;
    function autoReleaseOrder(uint256 orderId) external;
    function expireOrder(uint256 orderId) external;

    function withdrawClaimable() external;
    function withdrawMarketplaceFee() external;

    function getListing(uint256 listingId)
        external
        view
        returns (UStetuTypes.Listing memory);
    function getOrder(uint256 orderId)
        external
        view
        returns (UStetuTypes.Order memory);

    function claimable(address account, address token)
        external
        view
        returns (uint256);
}
