# UStetu V1 Storage & Fee Math

## Status

Current V1 implementation reference. Exact compiler-generated storage layout remains authoritative.

## Canonical Enums

```solidity
enum ListingStatus { ACTIVE, PAUSED, CLOSED }
enum OrderState { PAYMENT_PENDING, PAID, COMPLETED, EXPIRED }
```

## Token Identity

```text
keccak256(abi.encode("USTETU_TOKEN_V1", chainId, tokenContract))
```

## Fee

```text
BPS_DENOMINATOR = 10,000
FEE_BPS = 100
```

Therefore the marketplace fee is exactly 1%.

For a completed order:

```text
marketplaceFee = floor(grossPayment × 100 / 10,000)
sellerProceeds  = grossPayment - marketplaceFee
```

The conservation invariant is:

`marketplaceFee + sellerProceeds == grossPayment`

## Payment Math

Gross payment is calculated from token amount, unit price, and the registered token's decimal snapshot using the protocol's deterministic math library.

V1 payment is always Base native USDC with 6 decimals.

## Inventory

The listing stores:

- deposited inventory
- locked inventory

Available inventory is:

`inventoryDeposited - inventoryLocked`

## Order Facts

Historical order facts such as buyer, recipient, token amount, unit price, gross payment, fee, and seller proceeds are stored on the order.

Listing edits do not rewrite existing orders.

## V1 Boundaries

There is no governance fee setter, payment-token setter, dispute state, refund state, upgrade state, or emergency configuration in V1.