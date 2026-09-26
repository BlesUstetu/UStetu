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

    // Official USTETU Mainnet deployer.
    address internal constant EXPECTED_DEPLOYER =
        0x52dF1Ff4c9CD41869a691627cb1c903e68a3863b;

    // Official USTETU fee recipient.
    address internal constant EXPECTED_FEE_RECIPIENT =
        0x393c8Ab9FA306D0e3631AA9e027B467c61d7Bc29;

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

        uint256 deployerPrivateKey = vm.envUint("USTETU_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        require(deployer == EXPECTED_DEPLOYER, "WRONG_DEPLOYER");

        address feeRecipient = vm.envAddress("USTETU_FEE_RECIPIENT");
        require(feeRecipient == EXPECTED_FEE_RECIPIENT, "WRONG_FEE_RECIPIENT");

        vm.startBroadcast(deployerPrivateKey);

        registry = new UStetuRegistry(BASE_MAINNET_CHAIN_ID, BASE_MAINNET_USDC);
        sellerRegistry = new UStetuSellerRegistry();
        escrow = new UStetuEscrow(
            address(registry),
            address(sellerRegistry),
            feeRecipient
        );

        vm.stopBroadcast();

        // Post-deployment invariants. These checks must pass before the script succeeds.
        require(address(registry).code.length > 0, "REGISTRY_NO_CODE");
        require(address(sellerRegistry).code.length > 0, "SELLER_REGISTRY_NO_CODE");
        require(address(escrow).code.length > 0, "ESCROW_NO_CODE");

        require(registry.getDeploymentChainId() == BASE_MAINNET_CHAIN_ID, "REGISTRY_WRONG_CHAIN");
        require(registry.getPaymentToken() == BASE_MAINNET_USDC, "REGISTRY_WRONG_PAYMENT_TOKEN");
        require(address(escrow.registry()) == address(registry), "ESCROW_WRONG_REGISTRY");
        require(address(escrow.sellerRegistry()) == address(sellerRegistry), "ESCROW_WRONG_SELLER_REGISTRY");
        require(escrow.paymentToken() == BASE_MAINNET_USDC, "ESCROW_WRONG_PAYMENT_TOKEN");
        require(escrow.feeRecipient() == feeRecipient, "ESCROW_WRONG_FEE_RECIPIENT");

        console2.log("UStetu Base Mainnet V1 deployment");
        console2.log("chainId:", BASE_MAINNET_CHAIN_ID);
        console2.log("deployer:", deployer);
        console2.log("feeRecipient:", feeRecipient);
        console2.log("paymentToken USDC:", BASE_MAINNET_USDC);
        console2.log("registry:", address(registry));
        console2.log("sellerRegistry:", address(sellerRegistry));
        console2.log("escrow:", address(escrow));
        console2.log("post-deployment checks: PASSED");
    }
}
