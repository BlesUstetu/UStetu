# UStetu Storage Layout & Fee Math v1.0

## Status

Design freeze candidate. This document must be reviewed before production Solidity implementation.

## 1. Canonical Enums

Enum numeric ordering must remain stable once deployed.

```solidity
enum ListingStatus {
    DRAFT,      // 0
    ACTIVE,     // 1
    PAUSED,     // 2
    CLOSED,     // 3
    SUSPENDED   // 4
}

enum OrderState {
    CREATED,          // 0
    PAYMENT_PENDING,  // 1
    PAID,             // 2
    ESCROWED,         // 3
    RELEASABLE,       // 4
    COMPLETED,        // 5
    REFUNDED,         // 6
    CANCELLED,        // 7
    DISPUTED,         // 8
    EXPIRED           // 9
}

enum VerificationStatus {
    UNREGISTERED, // 0
    PENDING,      // 1
    APPROVED,     // 2
    REJECTED,     // 3
    SUSPENDED,    // 4
    DELISTED      // 5
}

enum Resolution {
    RELEASE, // 0
    REFUND   // 1
}
```

## 2. Token Structure

Conceptual canonical structure:

```solidity
struct Token {
    uint256 chainId;
    address contractAddress;
    uint8 decimalsSnapshot;
    VerificationStatus status;
    address registeredBy;
    uint64 registeredAt;
}
```

`symbol` and `name` should remain off-chain metadata/snapshots unless a strong on-chain use case requires storing them. The contract address remains authoritative.

## 3. Seller Structure

```solidity
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
```

Exact field widths must be validated against expected lifetime scale before deployment. If overflow risk outweighs packing benefit, use wider types.

## 4. Listing Structure

```solidity
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
```

`inventoryAvailable` should be derived as:

`inventoryDeposited - inventoryLocked - withdrawnInventory`

or represented explicitly only if the implementation can guarantee reconciliation. Avoid redundant mutable balances where possible.

## 5. Order Structure

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
    uint64 refundedAt;
    uint64 expiresAt;
    uint256 disputeId;
}
```

Historical order execution values are stored directly in the order so listing edits cannot mutate existing obligations.

## 6. Dispute Structure

```solidity
struct Dispute {
    uint256 orderId;
    address openedBy;
    uint8 reasonCode;
    uint64 openedAt;
    uint64 resolvedAt;
    Resolution resolution;
    bool resolved;
}
```

A boolean `resolved` may be derived from timestamps/resolution depending on final implementation. Avoid redundant mutable fields if they create inconsistency risk.

## 7. Mapping Model

Conceptual storage:

```solidity
mapping(address => Seller) sellers;
mapping(bytes32 => Token) tokens;
mapping(uint256 => Listing) listings;
mapping(uint256 => Order) orders;
mapping(uint256 => Dispute) disputes;
mapping(address => mapping(address => uint256)) claimable;
```

Where practical, IDs should be monotonic counters beginning at 1 so zero can represent non-existent objects.

## 8. Token ID

Use a collision-resistant domain-separated hash:

```text
keccak256("USTETU_TOKEN_V1", chainId, tokenContract)
```

The implementation should use `abi.encode` rather than ambiguous packed concatenation for heterogeneous dynamic-width values.

## 9. Payment Token Identity

Payment tokens are identified by deployment chain plus verified contract address. Because each contract instance already runs on a specific chain, the final implementation may use the payment-token address as the local key while the registry remains chain-scoped.

## 10. Fee Configuration

Default marketplace fee:

`FEE_BPS = 100`

Basis-point denominator:

`BPS_DENOMINATOR = 10_000`

Recommended governance safety bound:

`MAX_FEE_BPS` must be a fixed protocol maximum established before deployment. Governance cannot set a fee above that bound.

## 11. Fee Calculation

For a successful settlement:

```text
fee = floor(grossPayment × feeBps / 10_000)
sellerProceeds = grossPayment - fee
```

The final implementation should use multiplication-before-division with Solidity 0.8 checked arithmetic and explicit bounds.

The conservation invariant is:

`fee + sellerProceeds == grossPayment`

## 12. Example

For `270 USDC` at `100 bps`:

```text
fee = 270 × 100 / 10,000
    = 2.70 USDC

sellerProceeds = 270 - 2.70
               = 267.30 USDC
```

The actual smallest-unit integer arithmetic is authoritative.

## 13. Rounding Policy

Fee calculation rounds down in favor of the seller for fractional smallest units. The remainder stays with seller proceeds because:

`sellerProceeds = grossPayment - fee`

This guarantees exact conservation and avoids creating an unaccounted remainder.

## 14. Refund Fee Policy — Frozen for v1

Marketplace fee is earned only on successful `COMPLETED` settlement.

Therefore, if an order is refunded before completion:

- Marketplace fee credited for that order = `0`.
- Buyer receives the defined refundable payment amount.
- No protocol fee remains earned from the incomplete order.

This policy is simpler to audit and avoids fee ambiguity in refunds.

## 15. Overpayment Policy — Frozen for v1

The normal payment function accepts only the exact required amount.

If the payment amount does not equal the order's required amount, the transaction reverts.

No silent overpayment credit exists in v1.

## 16. Expiry Baseline

Orders must have an explicit `expiresAt` timestamp.

The final duration should be configured before implementation deployment. Expiry cannot be used to bypass a valid completed state.

A permissionless `expireOrder()` path is preferred where it is safe and gas-feasible.

## 17. Storage Safety Rules

1. Zero ID means non-existent object.
2. Historical order facts are immutable after creation unless the state-machine explicitly permits a change.
3. No off-chain database value authorizes a transfer.
4. Redundant accounting fields must be avoided or invariant-checked.
5. Mapping keys must use canonical identities.
6. Struct packing is subordinate to correctness.

## 18. Deployment Freeze Checklist

Before writing production contracts, freeze:

- Enum ordering.
- Struct fields.
- ID strategy.
- Token ID hash domain.
- Fee BPS.
- Maximum fee BPS.
- Rounding direction.
- Refund fee rule.
- Overpayment behavior.
- Expiry duration.
- Exact storage visibility.
- Upgradeability decision.

## 19. Important Implementation Note

This layout is a design baseline, not an audited storage layout. Once a production implementation is compiled, storage layout must be inspected from compiler artifacts and reviewed before deployment. If upgradeability is ever introduced, storage compatibility becomes a formal deployment gate.
