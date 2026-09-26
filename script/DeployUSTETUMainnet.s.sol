// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {USTETUToken} from "../contracts/token/USTETUToken.sol";

/// @notice Mainnet-only deployment script for the immutable USTETU token.
/// @dev The deployer address is intentionally pinned as a pre-broadcast guard.
///      The private key is supplied to Foundry externally and must correspond
///      to EXPECTED_DEPLOYER.
contract DeployUSTETUMainnet is Script {
    uint256 internal constant BASE_MAINNET_CHAIN_ID = 8453;
    address internal constant EXPECTED_DEPLOYER =
        0x52dF1Ff4c9CD41869a691627cb1c903e68a3863b;

    function run() external returns (USTETUToken token) {
        require(block.chainid == BASE_MAINNET_CHAIN_ID, "WRONG_CHAIN");
        require(msg.sender == EXPECTED_DEPLOYER, "WRONG_DEPLOYER");

        vm.startBroadcast();

        token = new USTETUToken();

        vm.stopBroadcast();

        console2.log("USTETU Base Mainnet token deployment");
        console2.log("chainId:", BASE_MAINNET_CHAIN_ID);
        console2.log("deployer:", EXPECTED_DEPLOYER);
        console2.log("token:", address(token));
        console2.log("name:", token.name());
        console2.log("symbol:", token.symbol());
        console2.log("decimals:", token.decimals());
        console2.log("totalSupply:", token.totalSupply());
    }
}
