# UStetu V1 Threat Model

## Security Objective

Protect seller inventory, buyer payments, seller claimable proceeds, and order integrity while minimizing privileged trust.

## Trust Boundaries

```text
User Wallet
    │
    ▼
Frontend ───── Backend / Indexer
    │                  │
    ▼                  │
Base Mainnet Contracts ◄┘
    │
    ├── UStetuRegistry
    ├── UStetuSellerRegistry
    └── UStetuEscrow
```

The frontend and backend are untrusted for custody and settlement. Smart contracts are the financial authority.

## Threat Actors

### Malicious Buyer

Possible actions:

- submit repeated transactions
- provide malformed inputs
- attempt to fund or complete another user's order
- attempt reentrancy through token behavior
- exploit stale frontend/indexer data

Controls:

- order-state validation
- buyer/order binding
- immutable recipient
- ReentrancyGuard
- SafeERC20
- exact payment accounting

### Malicious Seller

Possible actions:

- attempt to withdraw locked inventory
- manipulate listing price for future orders
- attempt to redirect proceeds
- register a risky token
- attempt duplicate settlement

Controls:

- listing ownership checks
- inventory locking
- order facts stored at creation
- withdrawal-wallet delay
- exact token-delivery accounting
- permissionless registration with explicit risk disclosure

### Malicious Token Contract

Possible behavior:

- fee-on-transfer
- rebasing
- blacklist/freeze
- unusual balance changes
- reverting transfers
- upgradeable behavior

Controls:

- contract-code check
- decimals snapshot and bounds
- exact received-payment/inventory/delivery checks where implemented
- SafeERC20
- settlement invariants

Important limitation: V1 does not prove that an arbitrary registered ERC-20 is economically safe.

### Compromised Frontend or Indexer

Possible actions:

- display incorrect price or inventory
- hide a listing
- provide stale state
- attempt to construct a malicious transaction

Controls:

- on-chain financial state
- wallet transaction confirmation
- contract-side authorization and accounting
- frontend/indexer treated as untrusted

### Compromised Seller Withdrawal Wallet

Impact is limited by the 24-hour withdrawal-wallet change delay, but a compromised effective wallet can still receive seller proceeds. Users remain responsible for wallet security.

## Explicitly Absent Threat Surface

V1 does not contain privileged governance, so there is no V1 admin-key threat involving:

- AccessManager
- Timelock
- Security Council
- pause authority
- fee setter
- payment-token setter
- upgrade administrator
- token verifier
- dispute resolver

These mechanisms may exist in future research only.

## Main Security Invariants

- A completed order cannot complete twice.
- An expired order cannot later complete.
- Locked inventory cannot be withdrawn.
- Order recipient is immutable.
- Existing order price is immutable.
- Seller proceeds plus fee equals gross payment.
- Claimable balances cannot become negative.
- Unsupported payment assets cannot settle.
- Financial authorization never depends on an off-chain database.

## Residual Risks

1. Permissionless token registration means registered tokens may be malicious or economically unsafe.
2. Non-standard ERC-20 behavior can create integration risk despite transfer checks.
3. The discovery indexer can be unavailable or stale.
4. Wallet/RPC/hosting compromise remains outside contract control.
5. Seller-chosen listing IDs can create operational griefing/squatting risk.

## Review Boundary

This threat model describes the implemented V1 architecture. It is not an independent security audit and does not guarantee the safety of third-party tokens or infrastructure.
