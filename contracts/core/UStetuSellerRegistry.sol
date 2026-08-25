// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {UStetuTypes} from "../libraries/UStetuTypes.sol";
import {UStetuErrors} from "../libraries/UStetuErrors.sol";

/// @title UStetuSellerRegistry
/// @notice Canonical seller registration and withdrawal-wallet registry.
/// @dev This contract does not custody funds and does not perform settlement.
contract UStetuSellerRegistry is AccessControl {
    bytes32 public constant SELLER_VERIFIER_ROLE = keccak256("USTETU_SELLER_VERIFIER_ROLE");
    bytes32 public constant CONFIG_ROLE = keccak256("USTETU_SELLER_CONFIG_ROLE");

    uint64 public constant WITHDRAWAL_WALLET_CHANGE_DELAY = 24 hours;

    mapping(address => UStetuTypes.Seller) private _sellers;
    mapping(address => bool) private _sellerExists;
    mapping(address => address) private _pendingWithdrawalWallet;

    event SellerRegistered(address indexed seller, address indexed withdrawalWallet);
    event SellerVerificationUpdated(address indexed seller, UStetuTypes.VerificationStatus status);
    event WithdrawalWalletChangeRequested(address indexed seller, address indexed newWallet, uint64 effectiveAt);
    event WithdrawalWalletChanged(address indexed seller, address indexed oldWallet, address indexed newWallet);
    event SellerListingCountUpdated(address indexed seller, uint32 activeListingCount);
    event SellerCompletedOrderRecorded(address indexed seller, bool disputed);

    constructor(address admin) {
        if (admin == address(0)) revert UStetuErrors.InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SELLER_VERIFIER_ROLE, admin);
        _grantRole(CONFIG_ROLE, admin);
    }

    function registerSeller(address withdrawalWallet) external returns (UStetuTypes.Seller memory seller) {
        if (_sellerExists[msg.sender]) revert UStetuErrors.AlreadyRegistered();
        if (withdrawalWallet == address(0)) revert UStetuErrors.InvalidAddress();

        _sellerExists[msg.sender] = true;
        _sellers[msg.sender] = UStetuTypes.Seller({
            wallet: msg.sender,
            withdrawalWallet: withdrawalWallet,
            registeredAt: uint64(block.timestamp),
            withdrawalWalletChangeEffectiveAt: 0,
            verificationStatus: UStetuTypes.VerificationStatus.PENDING,
            activeListingCount: 0,
            totalCompletedOrders: 0,
            totalDisputedOrders: 0
        });

        emit SellerRegistered(msg.sender, withdrawalWallet);
        return _sellers[msg.sender];
    }

    function setSellerVerification(address seller, UStetuTypes.VerificationStatus status)
        external
        onlyRole(SELLER_VERIFIER_ROLE)
    {
        if (!_sellerExists[seller]) revert UStetuErrors.NotRegisteredSeller();
        if (status == UStetuTypes.VerificationStatus.UNREGISTERED) {
            revert UStetuErrors.InvalidVerificationState();
        }
        _sellers[seller].verificationStatus = status;
        emit SellerVerificationUpdated(seller, status);
    }

    function requestWithdrawalWalletChange(address newWallet) external {
        if (!_sellerExists[msg.sender]) revert UStetuErrors.NotRegisteredSeller();
        if (newWallet == address(0)) revert UStetuErrors.InvalidAddress();
        if (newWallet == _sellers[msg.sender].withdrawalWallet) revert UStetuErrors.InvalidAddress();

        uint64 effectiveAt = uint64(block.timestamp + WITHDRAWAL_WALLET_CHANGE_DELAY);
        _pendingWithdrawalWallet[msg.sender] = newWallet;
        _sellers[msg.sender].withdrawalWalletChangeEffectiveAt = effectiveAt;
        emit WithdrawalWalletChangeRequested(msg.sender, newWallet, effectiveAt);
    }

    function activateWithdrawalWalletChange() external {
        if (!_sellerExists[msg.sender]) revert UStetuErrors.NotRegisteredSeller();
        UStetuTypes.Seller storage seller = _sellers[msg.sender];
        uint64 effectiveAt = seller.withdrawalWalletChangeEffectiveAt;
        if (effectiveAt == 0 || block.timestamp < effectiveAt) revert UStetuErrors.WithdrawalLocked();

        address oldWallet = seller.withdrawalWallet;
        address newWallet = _pendingWithdrawalWallet[msg.sender];
        if (newWallet == address(0)) revert UStetuErrors.InvalidAddress();

        seller.withdrawalWallet = newWallet;
        seller.withdrawalWalletChangeEffectiveAt = 0;
        delete _pendingWithdrawalWallet[msg.sender];
        emit WithdrawalWalletChanged(msg.sender, oldWallet, newWallet);
    }

    function getPendingWithdrawalWallet(address seller) external view returns (address) {
        if (!_sellerExists[seller]) revert UStetuErrors.NotRegisteredSeller();
        return _pendingWithdrawalWallet[seller];
    }

    function setActiveListingCount(address seller, uint32 count) external onlyRole(CONFIG_ROLE) {
        if (!_sellerExists[seller]) revert UStetuErrors.NotRegisteredSeller();
        _sellers[seller].activeListingCount = count;
        emit SellerListingCountUpdated(seller, count);
    }

    function recordCompletedOrder(address seller, bool disputed) external onlyRole(CONFIG_ROLE) {
        if (!_sellerExists[seller]) revert UStetuErrors.NotRegisteredSeller();
        _sellers[seller].totalCompletedOrders += 1;
        if (disputed) _sellers[seller].totalDisputedOrders += 1;
        emit SellerCompletedOrderRecorded(seller, disputed);
    }

    function getSeller(address seller) external view returns (UStetuTypes.Seller memory) {
        if (!_sellerExists[seller]) revert UStetuErrors.NotRegisteredSeller();
        return _sellers[seller];
    }

    function isRegisteredSeller(address seller) external view returns (bool) {
        return _sellerExists[seller];
    }

    function isVerifiedSeller(address seller) external view returns (bool) {
        if (!_sellerExists[seller]) return false;
        UStetuTypes.VerificationStatus status = _sellers[seller].verificationStatus;
        return status == UStetuTypes.VerificationStatus.APPROVED;
    }

    function getWithdrawalWallet(address seller) external view returns (address) {
        if (!_sellerExists[seller]) revert UStetuErrors.NotRegisteredSeller();
        return _sellers[seller].withdrawalWallet;
    }
}
