# UStetu Payment & Expiry Specification — V1

## Status

**Current V1 implementation.**

V1 uses one immutable payment asset on Base Mainnet: native Circle USDC.

## 1. Payment Asset

- Chain ID: 8453
- Payment token: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Decimals: 6
- Seller listings cannot select an alternative payment token.

## 2. Exact Payment

The order stores the required gross payment.

`grossPayment = tokenAmount × unitPrice` using the protocol's deterministic decimal-aware math.

`fundOrder()` must receive exactly the required payment amount.

Overpayment and underpayment do not create credit balances; invalid payment amounts revert.

## 3. Settlement Fee

Marketplace fee is immutable at 100 bps (1%).

`marketplaceFee + sellerProceeds == grossPayment`

Fee is credited only when an order reaches successful completion.

## 4. Payment Window

A newly created order has a 15-minute payment window.

An unpaid order can be expired permissionlessly after the deadline.

Expiry releases the order's locked inventory and marks the order `EXPIRED`.

## 5. Completion

After payment:

- the buyer may complete the order under the contract rules;
- eligible auto-release is permissionless after the 24-hour release window;
- the token transfer is checked for the exact amount received by the order recipient;
- seller proceeds and marketplace fee become claimable balances.

## 6. Refund / Dispute Boundary

V1 does **not** implement a dispute resolver or a generalized refund workflow.

The old dispute/refund architecture is retained only as future design documentation and is not part of the V1 contract API.

## 7. Off-Chain Data

The backend/indexer cannot authorize payment, completion, refund, or withdrawal. It is a read/discovery layer only.

## 8. Security Rules

- Never treat an indexer balance as authoritative.
- Never allow an alternate payment token through frontend configuration.
- Never change historical order payment facts through listing edits.
- Never rely on a database to authorize financial transfers.
