# UStetu Smart Contract Architecture — V1

## Status

**Current V1 architecture — Base Mainnet pre-mainnet release.**

UStetu V1 is non-custodial and intentionally has no platform administrator, owner, verifier, governance controller, upgrade administrator, or dispute resolver.

## Deployed Contract Set

```text
UStetuRegistry
       │
       ├── token registration / token metadata snapshot
       └── immutable Base Mainnet payment-token configuration
       
UStetuSellerRegistry
       │
       └── permissionless seller registration + withdrawal-wallet delay

UStetuEscrow
       │
       ├── listings + deposited inventory
       ├── orders + payment escrow
       ├── exact settlement accounting
       ├── claimable seller proceeds
       └── claimable marketplace fees
```

## 1. UStetuRegistry

Responsibilities:

- Pin the deployment to Base Mainnet (chain ID 8453).
- Pin the V1 payment asset to native Circle USDC:
  `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Permissionlessly register token contracts on the deployment chain.
- Snapshot token decimals at registration.
- Derive deterministic token IDs from chain ID + token address.

**Registration is not verification, audit, endorsement, or safety certification.**

The registry has no privileged token verifier or token allowlist administrator.

## 2. UStetuSellerRegistry

Responsibilities:

- Permissionless self-registration.
- Store seller wallet and withdrawal wallet.
- Protect withdrawal-wallet changes with a 24-hour delay.

There is no seller approval role, reputation authority, or admin role.

## 3. UStetuEscrow

Responsibilities:

- Create and manage seller listings.
- Hold deposited seller inventory.
- Lock inventory against orders.
- Create and fund orders using the immutable V1 payment token.
- Complete orders after valid payment.
- Support permissionless auto-release after the defined release window.
- Expire unpaid orders after the payment deadline.
- Credit seller proceeds and marketplace fees as claimable balances.
- Allow seller and fee-recipient withdrawals under the protocol rules.

The contract uses OpenZeppelin `SafeERC20` and `ReentrancyGuard`.

## 4. Accounting Model

For a completed order:

```text
gross payment
├── 99% seller claimable proceeds
└──  1% marketplace fee claimable balance
```

The contract verifies actual payment/token movements where required and enforces conservation of recorded settlement amounts.

## 5. Permission Model

There is intentionally no:

- `owner`
- `AccessControl` administrator
- fee setter
- payment-token setter
- registry setter
- pause authority
- upgrade path
- token seizure function
- privileged token verifier
- dispute resolver

Seller and token registration are permissionless where safe.

## 6. Immutability

V1 is not upgradeable. Critical deployment configuration is fixed at construction:

- deployment chain ID
- payment token
- seller registry address
- registry address
- fee recipient
- marketplace fee basis points

Existing order facts are recorded on-chain and are not rewritten by later listing edits.

## 7. Off-Chain Components

The backend/indexer is a discovery and projection layer only.

It may provide:

- listing search
- pagination
- filtering
- indexed event history

It is never the authority for:

- balances
- ownership
- payment
- settlement
- withdrawals
- order authorization

The frontend uses the contracts for financial actions.

## 8. V1 Boundaries

V1 intentionally excludes:

- disputes/refunds as a governance workflow
- multi-chain settlement
- upgradeability
- centralized verification
- protocol governance
- emergency pause controls
- AI-driven settlement

Future architecture documents must be explicitly marked as future design and are not implementation requirements for V1.
