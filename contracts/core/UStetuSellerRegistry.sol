// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UStetuTypes} from "../libraries/UStetuTypes.sol";
import {UStetuErrors} from "../libraries/UStetuErrors.sol";

/// @title UStetuSellerRegistry
/// @notice Permissionless seller registration and withdrawal-wallet registry.
/// @dev No admin, verifier, reputation, or settlement privileges exist in V1.
contract UStetuSellerRegistry {
    uint64 public constant WITHDRAWAL_WALLET_CHANGE_DELAY = 24 hours;

    mapping(address => UStetuTypes.Seller) private _sellers;
    mapping(address => bool) private _sellerExists;
    mapping(address => address) private _pendingWithdrawalWallet;

    event SellerRegistered(address indexed seller, address indexed withdrawalWallet);
    event WithdrawalWalletChangeRequested(
        address indexed seller,
        address indexed newWallet,
        uint64 effectiveAt
    );
    event WithdrawalWalletChanged(
        address indexed seller,
        address indexed oldWallet,
        address indexed newWallet
    );

    function registerSeller(address withdrawalWallet)
        external
        returns (UStetuTypes.Seller memory seller)
    {
        if (_sellerExists[msg.sender]) revert UStetuErrors.AlreadyRegistered();
        if (withdrawalWallet == address(0)) revert UStetuErrors.InvalidAddress();

        _sellerExists[msg.sender] = true;
        _sellers[msg.sender] = UStetuTypes.Seller({
            wallet: msg.sender,
            withdrawalWallet: withdrawalWallet,
            registeredAt: uint64(block.timestamp),
            withdrawalWalletChangeEffectiveAt: 0
        });

        emit SellerRegistered(msg.sender, withdrawalWallet);
        return _sellers[msg.sender];
    }

    function requestWithdrawalWalletChange(address newWallet) external {
        if (!_sellerExists[msg.sender]) revert UStetuErrors.NotRegisteredSeller();
        if (newWallet == address(0)) revert UStetuErrors.InvalidAddress();
        if (newWallet == _sellers[msg.sender].withdrawalWallet) {
            revert UStetuErrors.InvalidAddress();
        }

        uint64 effectiveAt = uint64(block.timestamp + WITHDRAWAL_WALLET_CHANGE_DELAY);
        _pendingWithdrawalWallet[msg.sender] = newWallet;
        _sellers[msg.sender].withdrawalWalletChangeEffectiveAt = effectiveAt;

        emit WithdrawalWalletChangeRequested(msg.sender, newWallet, effectiveAt);
    }

    function activateWithdrawalWalletChange() external {
        if (!_sellerExists[msg.sender]) revert UStetuErrors.NotRegisteredSeller();

        UStetuTypes.Seller storage seller = _sellers[msg.sender];
        uint64 effectiveAt = seller.withdrawalWalletChangeEffectiveAt;
        if (effectiveAt == 0 || block.timestamp < effectiveAt) {
            revert UStetuErrors.WithdrawalLocked();
        }

        address oldWallet = seller.withdrawalWallet;
        address newWallet = _pendingWithdrawalWallet[msg.sender];
        if (newWallet == address(0)) revert UStetuErrors.InvalidAddress();

        seller.withdrawalWallet = newWallet;
        seller.withdrawalWalletChangeEffectiveAt = 0;
        delete _pendingWithdrawalWallet[msg.sender];

        emit WithdrawalWalletChanged(msg.sender, oldWallet, newWallet);
    }

    function getPendingWithdrawalWallet(address seller)
        external
        view
        returns (address)
    {
        if (!_sellerExists[seller]) revert UStetuErrors.NotRegisteredSeller();
        return _pendingWithdrawalWallet[seller];
    }

    function getSeller(address seller)
        external
        view
        returns (UStetuTypes.Seller memory)
    {
        if (!_sellerExists[seller]) revert UStetuErrors.NotRegisteredSeller();
        return _sellers[seller];
    }

    function isRegisteredSeller(address seller) external view returns (bool) {
        return _sellerExists[seller];
    }
    function getWithdrawalWallet(address seller) external view returns (address) {
        if (!_sellerExists[seller]) revert UStetuErrors.NotRegisteredSeller();
        return _sellers[seller].withdrawalWallet;
    }
}
