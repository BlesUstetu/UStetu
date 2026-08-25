# UStetu System Blueprint v1.0

## 1. Product Principle

UStetu is designed as a security-first, non-custodial Web3 marketplace. Blockchain state is the source of truth for ownership, escrow, settlement, and transaction proof. Off-chain systems are indexing, presentation, notification, analytics, and operational layers.

## 2. Roles

### Buyer
- Connect wallet
- Browse and search listings
- Review token, network, contract, seller, price, stock, fees, and risk disclosure
- Purchase with USDC/USDT
- Receiving wallet is the connected wallet at order creation
- Receiving address is locked into the order
- Track order state
- Receive token after valid settlement
- Receive refund when an eligible order is refunded
- Download invoice using a minimal download-arrow icon

### Seller
- Connect wallet
- Register seller profile
- Register token with mandatory network + contract address
- Pass token compatibility / verification checks
- Deposit token into escrow
- Create and edit listing price within contract rules
- Manage stock and listing status
- View sales and settlement history
- Withdraw claimable USDC/USDT only to registered wallet

### Admin / Security Roles
- Operate marketplace configuration through governed roles
- Monitor transactions and system health
- Handle approved operational workflows
- Cannot freely withdraw buyer or seller assets
- Critical actions require multisig / AccessManager / Timelock / Security Council controls according to role

## 3. Token Identity

A token is uniquely identified by:

`chainId + tokenContractAddress`

Seller must provide the token contract address and selected network. UStetu verifies the contract and reads required token metadata on-chain before a listing can become active.

## 4. Order Lifecycle

`Created → PaymentPending → Paid → Escrowed → Releasable → Completed`

Alternative terminal states include:

- Cancelled
- Refunded
- Disputed
- Expired

An order cannot transition backward or complete twice.

## 5. Buyer Payment

1. Buyer selects listing.
2. UStetu displays token, network, contract, seller, quantity, price, fee, estimated gas, and receiving wallet.
3. Buyer confirms.
4. Payment is transferred according to escrow rules.
5. Payment confirmation is recorded from blockchain state/events.
6. Eligible settlement releases the seller proceeds and token to the buyer according to the order state machine.
7. Transaction receipt and invoice reference the on-chain transaction.

## 6. Buyer Receiving Wallet

The buyer does not manually type a receiving address during normal checkout.

`connectedWalletAtOrderCreation == order.recipient`

The recipient is immutable for the order. If the buyer changes wallets later, existing orders remain associated with their original recipient.

## 7. Seller Withdrawal

Seller withdrawal flow:

`Claimable Balance → Registered Wallet Check → Asset Check → Amount Check → Security Policy → Transfer`

The withdrawal screen always displays:

- Asset
- Amount
- Network
- Registered wallet

The withdrawal destination cannot be edited during withdrawal.

Wallet changes require a separate signed process and may be subject to a timelock / withdrawal protection period.

## 8. Fees

Marketplace fee is 1% of successful settlement value unless changed through governed configuration.

Fee accounting must be deterministic and auditable.

## 9. Refund / Dispute

The system must define deterministic refund conditions. Refunds return eligible buyer funds to the buyer address recorded on the order. Dispute state prevents conflicting settlement actions.

## 10. Transaction Visibility

### User Transaction Dashboard

Users can filter and inspect their own Buy/Sell transactions.

### Admin Transaction Center

Admin/security roles can monitor global transaction activity, status, volume, fees, disputes, refunds, and withdrawals subject to authorization.

### Security Transaction Monitor

Rule-based alerts for unusual activity, large withdrawals, repeated failures, and security incidents.

## 11. Invoice

Every finalized transaction can expose a download icon using a minimal downward-arrow icon. Invoice is a human-readable transaction/settlement document and is not itself the blockchain source of truth.

Invoice states:

- Pending
- Completed
- Refunded
- Cancelled
- Disputed

Invoices reference order ID, transaction hash, network, token contract, amount, price, fees, and settlement status where applicable.

## 12. Security Center

Public Security Center:

- Non-custodial model
- Escrow architecture
- Multisig governance
- AccessManager
- Timelock
- Emergency protection
- Contract verification
- On-chain transparency
- Audit status
- Bug bounty status
- Security activity

Internal Security Center:

- Contract monitoring
- Rule-based anomaly monitoring
- Emergency controls
- Governance actions
- Incident management
- Migration status
- Security logs

Sensitive secrets, keys, internal thresholds, and exploitable security procedures are never exposed publicly.

## 13. UX System

### UStetu Fluid Motion

- Soft fade / slide transitions
- 180–350 ms typical duration
- transform + opacity preferred
- subtle scale and glow
- skeleton loading
- smooth toast transitions
- reduced-motion support

### Theme

- Dark mode is the default
- Light mode is fully supported
- One icon toggles Dark ↔ Light
- Theme transition follows Fluid Motion
- User preference is persisted

### Mobile-first

- Bottom navigation
- One-hand-friendly controls
- Sticky primary action
- Cards instead of dense tables
- Lightweight animation
- Reduced motion / battery-conscious behavior

## 14. Notifications

- Toast for quick feedback
- Notification Center for history
- Modal for critical confirmations
- Transaction detail for permanent evidence
- Optional haptic / sound only for important events

## 15. Transparency

Listings should expose, where available:

- Token contract
- Network
- Price
- Available stock
- Sold amount
- Order count
- Seller reputation
- Verification status
- Risk disclosure
- Exact fee preview

UStetu verification does not guarantee token value, liquidity, legitimacy, profitability, or future performance.

## 16. Emergency UX

If the marketplace enters emergency mode, new actions can be paused according to governed security controls while existing assets remain governed by the smart-contract state. The UI must clearly communicate system status without exposing sensitive response procedures.

## 17. AI

AI is excluded from v1. No AI component may become an authority for custody, transfer, settlement, or security-critical state transitions.
