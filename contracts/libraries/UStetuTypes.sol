// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title UStetuTypes
/// @notice Canonical protocol enums and structs for UStetu V1.
/// @dev V1 deliberately has no admin/verifier/reputation/dispute state.
library UStetuTypes {
    enum ListingStatus {
        ACTIVE,
        PAUSED,
        CLOSED
    }

    enum OrderState {
        PAYMENT_PENDING,
        PAID,
        COMPLETED,
        EXPIRED
    }

    struct Token {
        uint256 chainId;
        address contractAddress;
        uint8 decimalsSnapshot;
        address registeredBy;
        uint64 registeredAt;
    }

    struct Seller {
        address wallet;
        address withdrawalWallet;
        uint64 registeredAt;
        uint64 withdrawalWalletChangeEffectiveAt;
    }

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        uint256 inventoryDeposited;
        uint256 inventoryLocked;
        uint256 minOrderAmount;
        uint256 maxOrderAmount;
        ListingStatus status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct Order {
        uint256 listingId;
        address buyer;
        address seller;
        address recipient;
        address token;
        address paymentToken;
        uint256 tokenAmount;
        uint256 unitPrice;
        uint256 grossPayment;
        uint256 marketplaceFee;
        uint256 sellerProceeds;
        OrderState state;
        uint64 createdAt;
        uint64 paidAt;
        uint64 completedAt;
        uint64 expiresAt;
    }
}
