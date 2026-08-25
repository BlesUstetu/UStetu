// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuTypes} from "../libraries/UStetuTypes.sol";

interface IUStetuMarketplace {
    function registerSeller(address withdrawalWallet) external;
    function requestWithdrawalWalletChange(address newWallet) external;
    function finalizeWithdrawalWalletChange() external;

    function registerToken(uint256 chainId, address token) external returns (bytes32 tokenId);

    function createListing(
        bytes32 tokenId,
        address paymentToken,
        uint256 price,
        uint256 inventoryAmount,
        uint256 minOrderAmount,
        uint256 maxOrderAmount
    ) external returns (uint256 listingId);

    function updateListingPrice(uint256 listingId, uint256 newPrice) external;
    function updateListingLimits(uint256 listingId, uint256 minOrderAmount, uint256 maxOrderAmount) external;
    function pauseListing(uint256 listingId) external;
    function closeListing(uint256 listingId) external;
    function withdrawListingInventory(uint256 listingId, uint256 amount) external;

    function getSeller(address seller) external view returns (UStetuTypes.Seller memory);
    function getListing(uint256 listingId) external view returns (UStetuTypes.Listing memory);
}
