// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {UStetuRegistryBaseSepolia} from "../contracts/testnet/UStetuRegistryBaseSepolia.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Base Sepolia integration deployment for UStetu V1 core behavior.
/// @dev Uses test-only ERC20s and a Sepolia-only registry. Never use these addresses for Mainnet.
contract DeployBaseSepolia is Script {
    uint256 internal constant BASE_SEPOLIA_CHAIN_ID = 84532;

    function run()
        external
        returns (
            MockERC20 paymentToken,
            MockERC20 assetToken,
            UStetuRegistryBaseSepolia registry,
            UStetuSellerRegistry sellerRegistry,
            UStetuEscrow escrow
        )
    {
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, "WRONG_CHAIN");

        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        address feeRecipient = vm.envAddress("USTETU_FEE_RECIPIENT");
        require(feeRecipient != address(0), "INVALID_FEE_RECIPIENT");

        vm.startBroadcast();

        paymentToken = new MockERC20("UStetu Test USDC", "tUSDC", 6);
        assetToken = new MockERC20("UStetu Test Asset", "tASSET", 18);
        registry = new UStetuRegistryBaseSepolia(address(paymentToken));
        sellerRegistry = new UStetuSellerRegistry();
        escrow = new UStetuEscrow(
            address(registry),
            address(sellerRegistry),
            feeRecipient
        );

        paymentToken.mint(deployer, 1_000_000e6);
        assetToken.mint(deployer, 1_000_000e18);

        vm.stopBroadcast();

        console2.log("UStetu Base Sepolia integration deployment");
        console2.log("chainId:", BASE_SEPOLIA_CHAIN_ID);
        console2.log("deployer:", deployer);
        console2.log("feeRecipient:", feeRecipient);
        console2.log("paymentToken:", address(paymentToken));
        console2.log("assetToken:", address(assetToken));
        console2.log("registry:", address(registry));
        console2.log("sellerRegistry:", address(sellerRegistry));
        console2.log("escrow:", address(escrow));
    }
}
