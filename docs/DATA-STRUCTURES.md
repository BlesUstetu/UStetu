# UStetu Data Structures v1.0

## 1. Design Rule

Storage is optimized for deterministic settlement, explicit ownership, and auditability. Human-readable metadata may exist off-chain, but critical financial state must be represented and enforced on-chain.

## 2. Seller

Conceptual fields:

- `sellerId`
- `wallet`
- `registeredAt`
- `status`
- `verificationStatus`
- `registeredWithdrawalWallet`
- `withdrawalWalletChangeEffectiveAt`
- `totalCompletedOrders`
- `totalDisputedOrders`
- `activeListingCount`

The seller's registered withdrawal wallet is separate from arbitrary UI input and is protected by wallet-change rules.

## 3. Token

Conceptual identity:

`tokenId = hash(chainId, tokenContractAddress)`

Fields:

- `chainId`
- `contractAddress`
- `symbolSnapshot`
- `decimalsSnapshot`
- `status`
- `verificationStatus`
- `registeredBy`
- `registeredAt`

The contract address and chain are authoritative. Metadata snapshots are informational and must not override the address identity.

## 4. Listing

Fields:

- `listingId`
- `sellerId`
- `tokenId`
- `price`
- `paymentAsset`
- `inventoryDeposited`
- `inventoryLocked`
- `inventoryAvailable`
- `minOrderAmount`
- `maxOrderAmount`
- `status`
- `createdAt`
- `updatedAt`

Listing state is separate from token verification state.

## 5. Order

Fields:

- `orderId`
- `listingId`
- `buyer`
- `seller`
- `recipient`
- `tokenId`
- `paymentToken`
- `tokenAmount`
- `unitPrice`
- `grossPayment`
- `marketplaceFee`
- `sellerProceeds`
- `state`
- `createdAt`
- `paidAt`
- `completedAt`
- `refundedAt`
- `disputeId`

`buyer` and `recipient` are recorded when the order is created. The recipient is immutable for that order.

## 6. Claimable Balances

Seller proceeds should be represented as claimable balances rather than immediately transferred to an arbitrary destination.

Conceptual mapping:

`claimable[paymentToken][seller] => amount`

Withdrawals validate the seller's registered withdrawal wallet and protocol limits before transfer.

## 7. Escrow Accounting

The protocol must distinguish:

- Deposited inventory.
- Locked inventory.
- Available inventory.
- Buyer payment held for active orders.
- Refundable buyer payment.
- Seller claimable proceeds.
- Marketplace fee.
- Treasury-owned balance.

## 8. Dispute

Fields:

- `disputeId`
- `orderId`
- `openedBy`
- `reasonCode`
- `openedAt`
- `status`
- `resolution`
- `resolvedAt`
- `resolver`

A dispute must lock conflicting settlement paths.

## 9. Governance / Security Configuration

Configuration must be separated from user balances and include, where applicable:

- Marketplace fee basis points.
- Timelock references.
- AccessManager references.
- Pause state.
- Emergency mode.
- Supported payment tokens.
- Limits and policy parameters.
- Contract version / migration state.

## 10. Numeric Safety

Use Solidity 0.8+ checked arithmetic and explicit bounds. Fee calculations must be designed to avoid rounding surprises and must define who receives residual units after integer division.

## 11. Storage Principles

- Prefer compact structs and mappings where safe.
- Avoid storing redundant data that can be derived from immutable identifiers.
- Never use an off-chain database balance as authorization for a financial transfer.
- Emit events for every critical state transition.
