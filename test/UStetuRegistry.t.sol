// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuRegistry} from "../contracts/core/UStetuRegistry.sol";
import {UStetuErrors} from "../contracts/libraries/UStetuErrors.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract UStetuRegistryTest is Test {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    UStetuRegistry internal registry;
    MockERC20 internal usdc;
    MockERC20 internal otherToken;

    function setUp() public {
        vm.chainId(8453);

        usdc = new MockERC20("USD Coin", "USDC", 6);
        vm.etch(BASE_USDC, address(usdc).code);
        usdc = MockERC20(BASE_USDC);

        registry = new UStetuRegistry(8453, BASE_USDC);
        otherToken = new MockERC20("Other", "OTH", 18);
    }

    function testPaymentTokenIsCanonicalBaseUSDC() public view {
        assertEq(registry.paymentToken(), BASE_USDC);
        assertEq(registry.deploymentChainId(), 8453);
        assertEq(registry.BASE_MAINNET_USDC(), BASE_USDC);
    }

    function testRejectsNonCanonicalPaymentToken() public {
        vm.expectRevert(UStetuErrors.InvalidPaymentToken.selector);
        new UStetuRegistry(8453, address(otherToken));
    }

    function testRejectsNonBaseChain() public {
        vm.expectRevert(UStetuErrors.InvalidChainId.selector);
        new UStetuRegistry(1, BASE_USDC);
    }

    function testPermissionlessTokenRegistrationSnapshotsDecimals() public {
        bytes32 tokenId = registry.registerToken(8453, address(otherToken));

        UStetuTypes.Token memory token = registry.getToken(tokenId);

        assertEq(token.chainId, 8453);
        assertEq(token.contractAddress, address(otherToken));
        assertEq(token.decimalsSnapshot, 18);
        assertEq(token.registeredBy, address(this));
        assertGt(token.registeredAt, 0);
    }

    function testDuplicateTokenRegistrationReverts() public {
        registry.registerToken(8453, address(otherToken));

        vm.expectRevert(UStetuErrors.TokenAlreadyRegistered.selector);
        registry.registerToken(8453, address(otherToken));
    }
}
