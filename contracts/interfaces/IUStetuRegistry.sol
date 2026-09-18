// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuTypes} from "../libraries/UStetuTypes.sol";

interface IUStetuRegistry {
    function registerToken(uint256 chainId, address token) external returns (bytes32 tokenId);
    function getToken(bytes32 tokenId) external view returns (UStetuTypes.Token memory);
    function isRegisteredToken(bytes32 tokenId) external view returns (bool);
    function getPaymentToken() external view returns (address);
    function getDeploymentChainId() external view returns (uint256);
    function getTokenId(uint256 chainId, address token) external pure returns (bytes32);
}
