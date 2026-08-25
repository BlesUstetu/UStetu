// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title UStetuTypes
/// @notice Canonical protocol enums and structs for UStetu v1.
/// @dev Design-stage foundation. Do not deploy until the full protocol and tests are reviewed.
library UStetuTypes {
    enum ListingStatus {
        DRAFT,
        ACTIVE,
        PAUSED,
        CLOSED,
        SUSPENDED
    }

    enum OrderState {
        CREATED,
        PAYMENT_PENDING,
        PAID,
        ESCROWED,
        RELEASABLE,
        COMPLETED,
        REFUNDED,
        CANCELLED,
        DISPUTED,
        EXPIRED
    }

    enum VerificationStatus {
        UNREGISTERED,
        PENDING,
        APPROVED,
        REJECTED,
        SUSPENDED,
        DELISTED
    }

    enum Resolution {
        RELEASE,
        REFUND
    }

    struct Token {
        uint256 chainId;
        address contractAddress;
        uint8 decimalsSnapshot;
        VerificationStatus status;
        address registeredBy;
        uint64 registeredAt;
    }

    struct Seller {
        address wallet;
        address withdrawalWallet;
        uint64 registeredAt;
        uint64 withdrawalWalletChangeEffectiveAt;
        VerificationStatus verificationStatus;
        uint32 activeListingCount;
        uint64 totalCompletedOrders;
        uint64 totalDisputedOrders;
    }

    struct Listing {
        uint256 tokenId;
        address seller;
        address paymentToken;
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
        uint64 refundedAt;
        uint64 expiresAt;
        uint256 disputeId;
    }

    struct Dispute {
        uint256 orderId;
        address openedBy;
        uint8 reasonCode;
        uint64 openedAt;
        uint64 resolvedAt;
        Resolution resolution;
        bool resolved;
    }
}
