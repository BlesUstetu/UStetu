# UStetu System Blueprint — V1

## 1. Product Principle

UStetu V1 is a non-custodial P2P marketplace whose financial source of truth is the Base Mainnet smart contracts.

Off-chain services provide discovery and presentation only.

## 2. Network and Payment

- Network: Base Mainnet
- Chain ID: 8453
- Payment asset: native Circle USDC
- Payment token: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Marketplace fee: immutable 1%

## 3. Actors

### Buyer

- Connect wallet.
- Browse listings.
- Create an order.
- Fund the exact USDC payment.
- Complete an eligible order.
- Receive purchased tokens at the immutable order recipient.

### Seller

- Self-register.
- Register token contracts permissionlessly.
- Deposit inventory.
- Create and manage own listings.
- Withdraw unlocked inventory.
- Withdraw claimable proceeds to the effective withdrawal wallet.

### Public/Permissionless Callers

Some maintenance operations are intentionally permissionless, including token registration and eligible order expiry/auto-release.

### Backend / Indexer

Provides discovery, search, pagination, and indexed history. It cannot authorize settlement or withdrawals.

## 4. Order Lifecycle

V1 states:

```text
PAYMENT_PENDING
      │
      ├── fundOrder() ──────> PAID
      │                         │
      │                         ├── completeOrder() ──> COMPLETED
      │                         └── autoReleaseOrder() -> COMPLETED
      │
      └── expireOrder() ─────> EXPIRED
```

The payment window is 15 minutes. Auto-release is permissionless after 24 hours from payment, according to the contract rules.

## 5. Settlement

For a successful completion:

- buyer payment is the immutable V1 payment token
- seller proceeds are credited as claimable balance
- 1% marketplace fee is credited as claimable balance
- exact token delivery to the order recipient is checked
- inventory accounting is updated atomically

## 6. Seller Withdrawal

Seller proceeds are withdrawn from claimable balance.

Withdrawal destination is the effective seller withdrawal wallet. Changing that wallet has a 24-hour delay.

## 7. No Admin

V1 has no centralized administrative control.

There is no privileged ability to:

- pause the protocol
- change fees
- replace payment token
- approve/reject tokens
- seize user assets
- rewrite order state
- upgrade contracts
- resolve disputes

## 8. Indexer Trust Boundary

The indexer can be stale or unavailable without changing on-chain ownership or settlement rules.

The frontend must use the contracts as the final authority for financial actions.

## 9. UX and Risk Disclosure

Listings should expose the token contract, network, price, available inventory, payment asset, fee, seller address, and token-registration risk.

“Registered” must not be presented as “Verified”.

## 10. V1 Non-Goals

- multi-chain settlement
- dispute/refund governance
- token verification authority
- protocol governance
- emergency pause
- upgradeability
- AI custody or settlement decisions
