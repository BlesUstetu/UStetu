// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuTypes} from "../libraries/UStetuTypes.sol";

interface IUStetuEscrow {
    function createOrder(uint256 listingId, uint256 tokenAmount) external returns (uint256 orderId);
    function fundOrder(uint256 orderId) external;
    function releaseOrder(uint256 orderId) external;
    function cancelOrder(uint256 orderId) external;
    function expireOrder(uint256 orderId) external;
    function openDispute(uint256 orderId, uint8 reasonCode) external returns (uint256 disputeId);
    function resolveDispute(uint256 disputeId, UStetuTypes.Resolution resolution) external;
    function refundOrder(uint256 orderId) external;
    function withdrawClaimable(address paymentToken, uint256 amount) external;
    function getOrder(uint256 orderId) external view returns (UStetuTypes.Order memory);
    function getDispute(uint256 disputeId) external view returns (UStetuTypes.Dispute memory);
    function claimable(address paymentToken, address seller) external view returns (uint256);
}
