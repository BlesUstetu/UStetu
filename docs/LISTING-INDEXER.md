# UStetu Listing Indexer

## Purpose

This document defines the off-chain read/discovery layer for marketplace listings. The indexer is an acceleration and discovery layer only. `UStetuEscrow` remains the source of truth for ownership, inventory, order state, payment, settlement, fees, and withdrawals.

## Event Sources

The indexer consumes canonical escrow events:

- `InventoryDeposited(listingId, seller, token, amount)`
- `InventoryWithdrawn(listingId, seller, token, amount)`
- `ListingPriceUpdated(listingId, seller, oldPrice, newPrice)`
- `ListingOrderLimitsUpdated(listingId, seller, oldMinOrderAmount, oldMaxOrderAmount, newMinOrderAmount, newMaxOrderAmount)`
- `ListingPaused(listingId, seller)`
- `ListingResumed(listingId, seller)`
- `ListingClosed(listingId, seller)`
- `OrderCreated(orderId, listingId, buyer, seller, recipient, tokenAmount, unitPrice, grossPayment, paymentToken)`
- `OrderCompleted(orderId, buyer, seller, tokenAmount)`
- `OrderRefunded(orderId, buyer, amount)`

The indexer must persist `chainId`, `contractAddress`, `blockNumber`, `transactionHash`, `logIndex`, and an ingestion timestamp for every event. The tuple `(chainId, contractAddress, transactionHash, logIndex)` is the event idempotency key.

## Listing Projection

Each listing projection should contain at minimum:

```text
listingId
seller
tokenId
tokenContract
paymentToken
price
inventoryDeposited
inventoryLocked
availableInventory
minOrderAmount
maxOrderAmount
status
createdAt
updatedAt
lastBlockNumber
lastTransactionHash
```

`availableInventory` is a derived display field. It must never be used as authorization for a purchase. Before any purchase transaction, the frontend must query the escrow contract and the transaction itself must be validated by the contract.

## State Rules

- `InventoryDeposited` increases deposited inventory.
- `InventoryWithdrawn` decreases deposited inventory.
- `ListingPriceUpdated` replaces the displayed unit price.
- `ListingOrderLimitsUpdated` replaces displayed min/max limits.
- `ListingPaused` sets status to `PAUSED`.
- `ListingResumed` sets status to `ACTIVE`.
- `ListingClosed` sets status to `CLOSED` and is terminal for discovery.
- `OrderCreated` increases the projected locked inventory by the order token amount.
- `OrderCompleted` decreases locked and deposited inventory by the completed token amount.
- `OrderRefunded` decreases locked inventory by the refunded token amount.

For production, the indexer should periodically reconcile projections against `UStetuEscrow.getListing(listingId)` and treat on-chain state as authoritative when a discrepancy exists.

## API Contract

Recommended read endpoints:

```text
GET /listings
GET /listings/:listingId
GET /listings?seller=0x...
GET /listings?status=ACTIVE
GET /listings?token=0x...
```

Pagination:

```text
GET /listings?status=ACTIVE&cursor=<cursor>&limit=25
```

Recommended response envelope:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "limit": 25,
    "nextCursor": null
  }
}
```

The API must never expose an endpoint that claims to execute settlement, release funds, or authorize withdrawals. Transaction execution remains a wallet-to-contract operation.

## Reorg and Finality

The indexer must support chain reorganization handling. Events should initially be considered provisional and promoted to finalized projections only after the configured confirmation depth. If a reorg removes an event, the affected projection must be rolled back and rebuilt from the canonical chain.

## Frontend Trust Boundary

The frontend may use the indexer for:

- search
- filtering
- sorting
- pagination
- seller discovery
- listing previews

The frontend must use the contract directly for:

- final listing state
- available inventory immediately before purchase
- order creation
- payment funding
- completion
- refunds
- claimable withdrawals

This separation prevents a stale or compromised discovery API from becoming a custody or settlement authority.
