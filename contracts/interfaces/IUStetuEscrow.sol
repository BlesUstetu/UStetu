// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuTypes} from "../libraries/UStetuTypes.sol";

interface IUStetuEscrow {
    function PAYMENT_WINDOW() external view returns (uint64);
    function AUTO_RELEASE_WINDOW() external view returns (uint64);
    function ORDER_EXPIRY() external view returns (uint64);

    function createOrder(uint256 listingId, uint256 tokenAmount) external returns (uint256 orderId);
    function fundOrder(uint256 orderId) external;
    function completeOrder(uint256 orderId) external;
    function autoReleaseOrder(uint256 orderId) external;
    function expireOrder(uint256 orderId) external;

    function withdrawClaimable(address token) external;

    function getListing(uint256 listingId) external view returns (UStetuTypes.Listing memory);
    function getOrder(uint256 orderId) external view returns (UStetuTypes.Order memory);

    function claimable(address account, address token) external view returns (uint256);
}
