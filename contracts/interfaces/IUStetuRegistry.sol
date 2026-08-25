// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuTypes} from "../libraries/UStetuTypes.sol";

interface IUStetuRegistry {
    function getToken(bytes32 tokenId) external view returns (UStetuTypes.Token memory);
    function isApprovedToken(bytes32 tokenId) external view returns (bool);
    function isSupportedPaymentToken(address token) external view returns (bool);
    function getDeploymentChainId() external view returns (uint256);
}
