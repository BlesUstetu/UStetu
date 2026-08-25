// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {UStetuSellerRegistry} from "../contracts/core/UStetuSellerRegistry.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";

contract UStetuSellerRegistryTest is Test {
    UStetuSellerRegistry internal registry;
    address internal admin = address(0xA11CE);
    address internal seller = address(0xB0B);
    address internal secondWallet = address(0xC0DE);
    address internal attacker = address(0xBAD);

    function setUp() public {
        registry = new UStetuSellerRegistry(admin);
    }

    function testSellerCanRegister() public {
        vm.prank(seller);
        registry.registerSeller(seller);

        UStetuTypes.Seller memory data = registry.getSeller(seller);
        assertEq(data.wallet, seller);
        assertEq(data.withdrawalWallet, seller);
        assertEq(uint8(data.verificationStatus), uint8(UStetuTypes.VerificationStatus.PENDING));
        assertTrue(registry.isRegisteredSeller(seller));
        assertFalse(registry.isVerifiedSeller(seller));
    }

    function testDuplicateRegistrationReverts() public {
        vm.prank(seller);
        registry.registerSeller(seller);

        vm.expectRevert();
        vm.prank(seller);
        registry.registerSeller(seller);
    }

    function testVerifierCanApproveSeller() public {
        vm.prank(seller);
        registry.registerSeller(seller);

        vm.prank(admin);
        registry.setSellerVerification(seller, UStetuTypes.VerificationStatus.APPROVED);

        assertTrue(registry.isVerifiedSeller(seller));
    }

    function testAttackerCannotVerifySeller() public {
        vm.prank(seller);
        registry.registerSeller(seller);

        vm.expectRevert();
        vm.prank(attacker);
        registry.setSellerVerification(seller, UStetuTypes.VerificationStatus.APPROVED);
    }

    function testWithdrawalWalletChangeHasDelay() public {
        vm.prank(seller);
        registry.registerSeller(seller);

        vm.prank(seller);
        registry.requestWithdrawalWalletChange(secondWallet);

        UStetuTypes.Seller memory pending = registry.getSeller(seller);
        assertEq(pending.withdrawalWallet, secondWallet);
        assertGt(pending.withdrawalWalletChangeEffectiveAt, block.timestamp);

        vm.expectRevert();
        vm.prank(seller);
        registry.activateWithdrawalWalletChange();

        vm.warp(block.timestamp + registry.WITHDRAWAL_WALLET_CHANGE_DELAY());
        vm.prank(seller);
        registry.activateWithdrawalWalletChange();

        assertEq(registry.getWithdrawalWallet(seller), secondWallet);
    }

    function testListingAndOrderCounters() public {
        vm.prank(seller);
        registry.registerSeller(seller);

        vm.startPrank(admin);
        registry.setActiveListingCount(seller, 3);
        registry.recordCompletedOrder(seller, false);
        registry.recordCompletedOrder(seller, true);
        vm.stopPrank();

        UStetuTypes.Seller memory data = registry.getSeller(seller);
        assertEq(data.activeListingCount, 3);
        assertEq(data.totalCompletedOrders, 2);
        assertEq(data.totalDisputedOrders, 1);
    }

    function testUnregisteredSellerOperationsRevert() public {
        vm.expectRevert();
        registry.getSeller(seller);

        vm.expectRevert();
        vm.prank(seller);
        registry.requestWithdrawalWalletChange(secondWallet);
    }
}
