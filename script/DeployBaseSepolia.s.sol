// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {UStetuRegistry} from "../contracts/core/UStetuRegistry.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";

/// @notice Base Sepolia deployment for the first UStetu testnet settlement domain.
/// @dev No private key is stored in this file. The deployer signs locally through Foundry.
contract DeployBaseSepolia is Script {
    uint256 internal constant BASE_SEPOLIA_CHAIN_ID = 84532;

    address internal constant DEPLOYER = 0x2aE207746cB381346388d8662f8A5d99010c3CE3;
    address internal constant FEE_RECIPIENT = 0x2aE207746cB381346388d8662f8A5d99010c3CE3;

    // Circle native USDC on Base Sepolia.
    address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run()
        external
        returns (UStetuRegistry registry, UStetuSellerRegistry sellerRegistry, UStetuEscrow escrow)
    {
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, "WRONG_CHAIN");
        require(msg.sender == DEPLOYER, "WRONG_DEPLOYER");

        vm.startBroadcast();

        registry = new UStetuRegistry(BASE_SEPOLIA_CHAIN_ID, DEPLOYER);
        sellerRegistry = new UStetuSellerRegistry(DEPLOYER);
        escrow = new UStetuEscrow(address(registry), FEE_RECIPIENT);

        // Enable the canonical Base Sepolia test USDC as a payment asset.
        registry.setPaymentTokenSupported(BASE_SEPOLIA_USDC, true);

        vm.stopBroadcast();

        console2.log("UStetu Base Sepolia deployment");
        console2.log("chainId:", BASE_SEPOLIA_CHAIN_ID);
        console2.log("deployer:", DEPLOYER);
        console2.log("feeRecipient:", FEE_RECIPIENT);
        console2.log("paymentToken USDC:", BASE_SEPOLIA_USDC);
        console2.log("registry:", address(registry));
        console2.log("sellerRegistry:", address(sellerRegistry));
        console2.log("escrow:", address(escrow));
    }
}
