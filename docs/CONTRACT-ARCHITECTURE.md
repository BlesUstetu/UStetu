# UStetu Smart Contract Architecture v1.0

## Status

Design specification — not production code.

## Design Goals

1. Non-custodial asset protection.
2. Deterministic order settlement.
3. Minimal privileged authority.
4. Explicit separation of funds, marketplace logic, and governance.
5. Safe future migration without silently abandoning seller assets.
6. Auditability through events and deterministic accounting.
7. No AI dependency in the core protocol.

## Proposed Contract Modules

### 1. UStetuEscrow

Core settlement contract responsible for:

- Seller token deposits allocated to listings/orders.
- Buyer payment escrow where applicable.
- Order state transitions.
- Token release to the recorded buyer recipient.
- Seller proceeds accounting.
- Refund accounting.
- Dispute state locks.
- Anti-double-release invariants.

The escrow contract must not expose arbitrary administrator withdrawal of user assets.

### 2. UStetuMarketplace

Marketplace coordination layer responsible for:

- Seller registration references.
- Token/listing registration.
- Listing price and stock rules.
- Order creation.
- Listing status.
- Marketplace fee calculation.
- Interaction with escrow.

It must not be treated as a wallet or treasury for user assets.

### 3. UStetuRegistry

Canonical registry for protocol objects and configuration references:

- Supported networks/configuration where applicable.
- Approved token contracts.
- Seller verification status references.
- Contract version references.
- Marketplace configuration references.

Registry updates must be governed and must not retroactively alter immutable order facts.

### 4. UStetuTreasury

Receives marketplace fees only after successful settlement according to protocol rules.

Treasury withdrawals are governance-controlled and separate from seller/buyer balances.

### 5. UStetuSecurity / Governance Layer

Governed controls using OpenZeppelin AccessManager and a self-governed Timelock, with a Security Council for emergency response according to the final governance policy.

Responsibilities may include:

- Configuration changes.
- Role administration.
- Emergency pause/unpause within tightly defined scope.
- Contract upgrades only if an upgradeable architecture is explicitly approved.
- Migration execution under predefined safeguards.

No role may arbitrarily transfer seller inventory or buyer funds.

## Upgrade / Migration Principle

UStetu should prefer immutable core settlement logic where practical. If an upgradeable proxy is required, upgrades must be governed by multisig + timelock and must preserve user obligations.

A migration must provide a deterministic path for all active seller inventory, buyer payments, claimable proceeds, refunds, and pending orders. No upgrade may silently make an existing user obligation inaccessible.

## Asset Accounting

The protocol must maintain separate accounting for:

- Seller deposited token inventory.
- Tokens locked against active orders.
- Seller claimable proceeds.
- Buyer escrowed payment.
- Refundable buyer payment.
- Marketplace fee.
- Treasury balance.

A key invariant is:

`Escrow-controlled assets >= Outstanding user obligations`

The exact invariant set will be formalized before implementation.

## Token Handling

ERC-20 operations must use SafeERC20-compatible patterns. Token contracts are identified by `chainId + contractAddress`.

The protocol must define behavior for:

- Standard ERC-20.
- Fee-on-transfer tokens.
- Rebasing tokens.
- Pausable tokens.
- Blacklist-restricted tokens.
- Upgradeable token contracts.
- Non-standard return values.

Unsupported token behaviors must be rejected or explicitly isolated before a listing becomes active.

## Events

Critical state changes must emit indexed events, including:

- SellerRegistered
- SellerVerificationUpdated
- TokenRegistered
- ListingCreated
- ListingUpdated
- ListingPaused
- ListingClosed
- InventoryDeposited
- OrderCreated
- PaymentEscrowed
- PaymentVerified
- OrderReleased
- OrderRefunded
- DisputeOpened
- DisputeResolved
- SellerWithdrawal
- EmergencyStateChanged
- GovernanceActionScheduled
- GovernanceActionExecuted
- ContractVersionChanged / MigrationExecuted where applicable

## Explicit Non-Goals for v1

- AI-driven settlement.
- AI-driven custody decisions.
- Centralized custody of buyer or seller assets.
- Manual database-based balance adjustments.
- Arbitrary admin token seizure.
- Hidden transfer mechanisms.

## Implementation Gate

Do not deploy this design to mainnet until the following are complete:

1. Final role matrix.
2. Threat model.
3. State-machine specification.
4. Accounting invariants.
5. Solidity implementation review.
6. Unit/integration/fuzz/invariant tests.
7. Static analysis.
8. Testnet validation.
9. Independent security audit.
10. Mainnet deployment checklist.
