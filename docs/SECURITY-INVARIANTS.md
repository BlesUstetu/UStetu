# UStetu Security Invariants v1.0

These invariants are the minimum formal properties the Solidity test suite must enforce. They are design requirements, not a claim that the system is already secure.

## Order Invariants

### INV-ORDER-01 — Unique Completion

An order can reach `COMPLETED` at most once.

### INV-ORDER-02 — Unique Refund

An order can reach `REFUNDED` at most once.

### INV-ORDER-03 — Terminal Immutability

`COMPLETED`, `REFUNDED`, `CANCELLED`, and `EXPIRED` orders cannot execute an incompatible terminal transition.

### INV-ORDER-04 — Recipient Immutability

`order.recipient` cannot change after order creation.

### INV-ORDER-05 — Price Immutability Per Order

Once an order is created, later listing-price changes cannot alter that order's execution price.

## Inventory Invariants

### INV-INV-01 — No Negative Inventory

Available and locked inventory cannot become negative.

### INV-INV-02 — Locked Inventory Protection

Seller cannot withdraw inventory that is locked against an active order.

### INV-INV-03 — Token Identity Binding

Inventory for a listing must correspond to the listing's exact `chainId + tokenContractAddress` identity.

## Payment Invariants

### INV-PAY-01 — Exact Payment

An order cannot be considered paid unless the required payment amount in the exact supported payment token has been secured/verified according to the final payment model.

### INV-PAY-02 — No Unsupported Payment Asset

Unsupported payment token contracts cannot be used to create valid settlement state.

### INV-PAY-03 — No Negative Claimable Balance

Seller claimable balances can never become negative.

## Settlement Invariants

### INV-SETTLE-01 — Conservation

For every completed order:

`grossPayment = sellerProceeds + marketplaceFee`

subject to explicitly defined integer rounding rules.

### INV-SETTLE-02 — No Double Release

The same token inventory and payment obligation cannot be released twice for the same order.

### INV-SETTLE-03 — No Release After Refund

A refunded order cannot later release its token or seller proceeds.

### INV-SETTLE-04 — No Refund After Completion

A completed order cannot later refund the same payment obligation in v1.

### INV-SETTLE-05 — Dispute Lock

An active blocking dispute prevents conflicting release/refund actions.

## Withdrawal Invariants

### INV-WD-01 — Registered Destination

Seller withdrawal proceeds can only be transferred to the seller's registered withdrawal wallet.

### INV-WD-02 — Sufficient Claimable Balance

Withdrawal amount cannot exceed the seller's claimable balance.

### INV-WD-03 — No Unauthorized Withdrawal

A caller cannot withdraw another seller's claimable proceeds.

### INV-WD-04 — Withdrawal Accounting

Successful withdrawal decreases the claimable balance by exactly the transferred amount.

## Governance Invariants

### INV-GOV-01 — Least Privilege

No operational role has a generic arbitrary-transfer function over user escrow assets.

### INV-GOV-02 — Timelocked Critical Changes

Critical governance changes requiring a timelock cannot execute before the configured delay.

### INV-GOV-03 — Emergency Scope

Emergency controls cannot be used as an unrestricted user-asset seizure mechanism.

### INV-GOV-04 — Treasury Separation

Treasury-owned fee balances cannot be accounted as buyer or seller obligations.

## Token Safety Invariants

### INV-TOKEN-01 — Supported Token Policy

A token that fails the approved compatibility policy cannot become an active listing.

### INV-TOKEN-02 — Transfer Accounting

For supported tokens, escrow accounting must reconcile actual token movements with recorded obligations according to the token policy.

### INV-TOKEN-03 — Reentrancy Safety

No external token call can cause an invalid intermediate state that permits double settlement, double withdrawal, or balance corruption.

## Upgrade / Migration Invariants

### INV-MIG-01 — Obligation Preservation

Migration cannot silently erase or reduce valid buyer refunds, seller inventory, seller proceeds, or other defined user obligations.

### INV-MIG-02 — Recipient Preservation

Migration cannot change an existing order's recorded buyer recipient.

### INV-MIG-03 — Versioned Execution

Only the authorized migration path may change contract version state.

## Testing Standard

Every invariant must have at least one automated property test. High-risk invariants should have fuzz and invariant tests with adversarial actors and randomized sequences.

Before mainnet, the invariant suite must be reviewed alongside the threat model and external audit findings.
