# UStetu V1 Data Structures

Canonical definitions are in `contracts/libraries/UStetuTypes.sol`.

## Token

```solidity
struct Token {
    uint256 chainId;
    address contractAddress;
    uint8 decimalsSnapshot;
    address registeredBy;
    uint64 registeredAt;
}
```

## Seller

```solidity
struct Seller {
    address wallet;
    address withdrawalWallet;
    uint64 registeredAt;
    uint64 withdrawalWalletChangeEffectiveAt;
}
```

## Listing

```solidity
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
```

Available inventory is derived as deposited minus locked inventory.

## Order

```solidity
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
```

V1 has no dispute, refund, verification, or governance fields in these core structs.

## Enums

```solidity
enum ListingStatus { ACTIVE, PAUSED, CLOSED }
enum OrderState { PAYMENT_PENDING, PAID, COMPLETED, EXPIRED }
```

The Solidity source is authoritative for exact storage layout.