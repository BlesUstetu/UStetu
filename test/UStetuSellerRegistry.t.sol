// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";

contract UStetuSellerRegistryTest is Test {
    UStetuSellerRegistry internal registry;
    address internal seller = address(0xB0B);
    address internal wallet = address(0xC0DE);
    address internal nextWallet = address(0xD00D);

    function setUp() public {
        registry = new UStetuSellerRegistry();
    }

    function testSellerCanRegisterWithoutAdmin() public {
        vm.prank(seller);
        registry.registerSeller(wallet);

        UStetuTypes.Seller memory data = registry.getSeller(seller);
        assertEq(data.wallet, seller);
        assertEq(data.withdrawalWallet, wallet);
        assertTrue(registry.isRegisteredSeller(seller));
    }

    function testDuplicateRegistrationReverts() public {
        vm.prank(seller);
        registry.registerSeller(wallet);

        vm.expectRevert();
        vm.prank(seller);
        registry.registerSeller(wallet);
    }

    function testWithdrawalWalletChangeHas24HourDelay() public {
        vm.prank(seller);
        registry.registerSeller(wallet);

        vm.prank(seller);
        registry.requestWithdrawalWalletChange(nextWallet);

        assertEq(registry.getWithdrawalWallet(seller), wallet);
        assertEq(registry.getPendingWithdrawalWallet(seller), nextWallet);

        vm.expectRevert();
        vm.prank(seller);
        registry.activateWithdrawalWalletChange();

        vm.warp(block.timestamp + registry.WITHDRAWAL_WALLET_CHANGE_DELAY());

        vm.prank(seller);
        registry.activateWithdrawalWalletChange();

        assertEq(registry.getWithdrawalWallet(seller), nextWallet);
        assertEq(registry.getPendingWithdrawalWallet(seller), address(0));
    }

    function testPendingWalletCanBeReplaced() public {
        vm.prank(seller);
        registry.registerSeller(wallet);

        vm.prank(seller);
        registry.requestWithdrawalWalletChange(nextWallet);

        vm.warp(block.timestamp + 1 hours);
        address thirdWallet = address(0xE00E);

        vm.prank(seller);
        registry.requestWithdrawalWalletChange(thirdWallet);

        assertEq(registry.getWithdrawalWallet(seller), wallet);
        assertEq(registry.getPendingWithdrawalWallet(seller), thirdWallet);
    }

    function testUnregisteredSellerOperationsRevert() public {
        vm.expectRevert();
        registry.getSeller(seller);

        vm.expectRevert();
        vm.prank(seller);
        registry.requestWithdrawalWalletChange(nextWallet);
    }
}
