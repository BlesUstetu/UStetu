// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {UStetuEscrow} from "../contracts/core/UStetuEscrow.sol";

/// @notice Deploy only the upgraded UStetuEscrow against the existing Base Sepolia registry.
/// @dev This preserves the already-deployed registry, token registry state, and payment-token configuration.
contract DeployEscrowBaseSepolia is Script {
    uint256 internal constant BASE_SEPOLIA_CHAIN_ID = 84532;

    // Existing UStetuRegistry on Base Sepolia.
    address internal constant REGISTRY = 0x72ca75932e5Bd1364A889DD6329D6016f78e17A7;

    // Deployment signer / fee recipient.
    address internal constant DEPLOYER = 0x568A2C9A2fC86909d9410E31f9A9287258B9928b;
    address internal constant FEE_RECIPIENT = 0x568A2C9A2fC86909d9410E31f9A9287258B9928b;

    function run() external returns (UStetuEscrow escrow) {
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, "WRONG_CHAIN");

        vm.startBroadcast();
        escrow = new UStetuEscrow(REGISTRY, FEE_RECIPIENT);
        vm.stopBroadcast();

        require(escrow.owner() == DEPLOYER, "WRONG_OWNER");

        console2.log("UStetu Escrow Base Sepolia deployment");
        console2.log("chainId:", BASE_SEPOLIA_CHAIN_ID);
        console2.log("registry:", REGISTRY);
        console2.log("deployer:", DEPLOYER);
        console2.log("feeRecipient:", FEE_RECIPIENT);
        console2.log("escrow:", address(escrow));
        console2.log("feeBps:", escrow.feeBps());
    }
}
