// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {UStetuRegistry} from "../contracts/core/UStetuRegistry.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";

/// @notice Base Mainnet V1 deployment for the UStetu permissionless settlement domain.
/// @dev Set USTETU_FEE_RECIPIENT in the Foundry environment before broadcasting.
contract DeployBaseMainnet is Script {
    uint256 internal constant BASE_MAINNET_CHAIN_ID = 8453;

    // Circle native USDC on Base Mainnet.
    address internal constant BASE_MAINNET_USDC =
        0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run()
        external
        returns (
            UStetuRegistry registry,
            UStetuSellerRegistry sellerRegistry,
            UStetuEscrow escrow
        )
    {
        require(block.chainid == BASE_MAINNET_CHAIN_ID, "WRONG_CHAIN");

        address feeRecipient = vm.envAddress("USTETU_FEE_RECIPIENT");
        require(feeRecipient != address(0), "INVALID_FEE_RECIPIENT");

        vm.startBroadcast();

        registry = new UStetuRegistry(BASE_MAINNET_CHAIN_ID, BASE_MAINNET_USDC);
        sellerRegistry = new UStetuSellerRegistry();
        escrow = new UStetuEscrow(
            address(registry),
            address(sellerRegistry),
            feeRecipient
        );

        vm.stopBroadcast();

        console2.log("UStetu Base Mainnet V1 deployment");
        console2.log("chainId:", BASE_MAINNET_CHAIN_ID);
        console2.log("feeRecipient:", feeRecipient);
        console2.log("paymentToken USDC:", BASE_MAINNET_USDC);
        console2.log("registry:", address(registry));
        console2.log("sellerRegistry:", address(sellerRegistry));
        console2.log("escrow:", address(escrow));
    }
}
