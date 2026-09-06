// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {USTETUToken} from "../contracts/token/USTETUToken.sol";

contract DeployUSTETUTokenBaseSepoliaFixed is Script {
    uint256 internal constant BASE_SEPOLIA_CHAIN_ID = 84532;
    address internal constant DEPLOYER = 0x568A2C9A2fC86909d9410E31f9A9287258B9928b;

    function run() external returns (USTETUToken token) {
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, "WRONG_CHAIN");
        vm.startBroadcast();
        token = new USTETUToken();
        vm.stopBroadcast();
        require(token.totalSupply() == token.TOTAL_SUPPLY(), "WRONG_SUPPLY");
        require(token.balanceOf(DEPLOYER) == token.TOTAL_SUPPLY(), "WRONG_DEPLOYER_BALANCE");
        require(token.decimals() == 18, "WRONG_DECIMALS");
    }
}
