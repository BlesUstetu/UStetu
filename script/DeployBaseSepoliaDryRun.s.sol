// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {UStetuRegistryBaseSepolia} from "../contracts/testnet/UStetuRegistryBaseSepolia.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice No-broadcast Base Sepolia deployment simulation.
/// @dev This script never signs or broadcasts a transaction.
contract DeployBaseSepoliaDryRun is Script {
    uint256 internal constant BASE_SEPOLIA_CHAIN_ID = 84532;

    function run() external {
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, "WRONG_CHAIN");

        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address feeRecipient = vm.envAddress("USTETU_FEE_RECIPIENT");
        require(deployer != address(0), "INVALID_DEPLOYER_ADDRESS");
        require(feeRecipient != address(0), "INVALID_FEE_RECIPIENT");

        MockERC20 paymentToken = new MockERC20("UStetu Test USDC", "tUSDC", 6);
        MockERC20 assetToken = new MockERC20("UStetu Test Asset", "tASSET", 18);
        UStetuRegistryBaseSepolia registry =
            new UStetuRegistryBaseSepolia(address(paymentToken));
        UStetuSellerRegistry sellerRegistry = new UStetuSellerRegistry();
        UStetuEscrow escrow = new UStetuEscrow(
            address(registry),
            address(sellerRegistry),
            feeRecipient
        );

        paymentToken.mint(deployer, 1_000_000e6);
        assetToken.mint(deployer, 1_000_000e18);

        require(registry.getDeploymentChainId() == BASE_SEPOLIA_CHAIN_ID, "BAD_REGISTRY_CHAIN");
        require(registry.getPaymentToken() == address(paymentToken), "BAD_PAYMENT_TOKEN");
        require(escrow.paymentToken() == address(paymentToken), "BAD_ESCROW_PAYMENT_TOKEN");
        require(escrow.feeRecipient() == feeRecipient, "BAD_FEE_RECIPIENT");

        console2.log("Base Sepolia dry run OK");
        console2.log("deployer:", deployer);
        console2.log("feeRecipient:", feeRecipient);
        console2.log("paymentToken:", address(paymentToken));
        console2.log("assetToken:", address(assetToken));
        console2.log("registry:", address(registry));
        console2.log("sellerRegistry:", address(sellerRegistry));
        console2.log("escrow:", address(escrow));
    }
}
