# UStetu Governance & Emergency Security Architecture v1.0

## 1. Objective

Governance must control protocol configuration without creating a hidden custody path. The security model separates normal operations, delayed governance, treasury authority, and emergency response.

## 2. Layers

```text
                    ┌──────────────────────┐
                    │     Governance       │
                    │ Multisig / Governor  │
                    └──────────┬───────────┘
                               │
                         Timelock Delay
                               │
                    ┌──────────▼───────────┐
                    │     AccessManager    │
                    │ granular permissions │
                    └──────┬───────┬────────┘
                           │       │
                 Normal Ops│       │Critical Config
                           │       │
                    Contracts       │
                                   │
                         Security Council
                         Emergency Scope
```

The exact deployment topology may evolve, but the separation of duties must remain.

## 3. Multisig

Critical governance keys should be controlled by a multisig rather than one externally owned account.

Multisig responsibilities may include:

- Approving governance proposals.
- Managing critical role membership.
- Approving treasury operations.
- Approving upgrades if upgrades are enabled.

Recommended operational principle: no single signer should be able to unilaterally move user assets or bypass timelocked policy.

The exact signer count and threshold must be finalized during deployment planning.

## 4. AccessManager

OpenZeppelin AccessManager is the preferred authorization layer for granular function-level permissions.

Each privileged function should have:

- Explicit role.
- Explicit caller policy.
- Optional execution delay.
- Clearly defined target and selector.

Avoid broad roles such as `ADMIN_CAN_DO_ANYTHING`.

## 5. Timelock

High-impact changes should use a self-governed Timelock.

Typical delayed actions:

- Marketplace fee changes.
- Payment-token allowlist changes.
- Token verification policy changes.
- Contract reference changes.
- Role administration for sensitive roles.
- Upgrades, if upgradeability is enabled.
- Migration execution.

The delay gives users, security monitors, and governance participants time to inspect a pending change.

The exact delay duration must be selected before deployment based on operational needs and threat model.

## 6. Security Council

The Security Council is an emergency response role, not a second treasury.

Its powers should be limited to narrowly scoped protective actions such as:

- Pause new order creation.
- Pause seller withdrawals during an active incident when necessary.
- Pause affected token/listing paths where technically supported.
- Activate a predefined protective mode.

Security Council must NOT have:

- Arbitrary token transfer.
- Arbitrary USDC/USDT transfer.
- Arbitrary seller balance editing.
- Arbitrary buyer refund destination.
- Ability to rewrite historical orders.

## 7. Pause Architecture

Pause should be granular where practical.

Suggested scopes:

- `ORDER_CREATION`
- `LISTING_CREATION`
- `TOKEN_REGISTRATION`
- `SELLER_WITHDRAWAL`
- `TREASURY_OPERATIONS`
- `DISPUTE_OPERATIONS`

A global emergency pause may exist only if the implementation demonstrates that it does not strand user claim/refund paths unnecessarily.

## 8. Emergency Philosophy

Emergency response should minimize damage while preserving user exit paths where safe.

Example:

```text
Security Incident
       ↓
Pause New Orders
       ↓
Investigate
       ↓
Protect Existing Obligations
       ↓
Governance Review
       ↓
Resume / Migrate / Protective Refund
```

Emergency mode must not silently confiscate assets.

## 9. Treasury Separation

Treasury controls only protocol-owned marketplace fees after successful settlement accounting.

Treasury cannot access:

- Active seller inventory.
- Buyer escrow.
- Seller claimable balances.
- Refundable buyer balances.

Any treasury transfer must be independently auditable.

## 10. Upgradeability Decision

Default recommendation for v1: keep the core escrow/settlement logic as immutable as practical.

If upgradeability becomes necessary, use a well-understood proxy architecture and enforce:

- Timelocked upgrades.
- Multisig/governance approval.
- Storage-layout validation.
- Migration compatibility.
- User-obligation reconciliation.
- External security review.

An upgrade must never be a shortcut around the existing state machine.

## 11. Role Separation

Suggested separation:

| Role | Primary Authority |
|---|---|
| Seller | Own listing/inventory actions |
| Operator | Bounded operations |
| Token Verifier | Token eligibility status |
| Dispute Resolver | Predefined dispute outcomes |
| Security Council | Emergency pause/protection |
| Governor | Policy decisions |
| Timelock | Delayed critical execution |
| Treasury | Protocol-owned fee withdrawals |
| AccessManager Admin | Role/permission administration under governance |

No role should combine broad operational, treasury, and emergency transfer powers.

## 12. Governance Actions

A high-impact action should follow:

`Proposal → Review → Approval → Timelock → Execute → Event → Monitor`

The frontend should expose pending and executed governance actions where practical.

## 13. Emergency Monitoring

Security monitoring should watch for:

- Large or unusual seller withdrawals.
- Repeated failed settlement attempts.
- Unexpected token transfers.
- Governance configuration changes.
- Role changes.
- Pause/unpause events.
- Upgrade events.
- Abnormal order/refund patterns.

Monitoring may be off-chain, but monitoring cannot become a financial authorization layer.

## 14. Recovery / Migration

If a critical vulnerability requires migration:

1. Pause affected operations.
2. Preserve user obligations.
3. Publish migration scope where safe.
4. Governance approves migration.
5. Timelock delay applies.
6. Reconcile balances.
7. Execute migration.
8. Verify invariants.
9. Resume only after security sign-off.

## 15. Governance Invariants

1. No single operational signer can move user assets arbitrarily.
2. Critical configuration is delayed where specified.
3. Emergency pause does not create arbitrary custody.
4. Treasury cannot consume user obligations.
5. Governance cannot rewrite historical order recipient or execution price.
6. Role permissions are explicit and testable.
7. Migration preserves valid user obligations.

## 16. Implementation Gate

Before deployment, finalize:

- Multisig signer count and threshold.
- Timelock delay durations.
- AccessManager roles and function selectors.
- Security Council composition.
- Emergency pause scopes.
- Upgradeability decision.
- Treasury destination policy.
- Governance proposal process.
- Monitoring and incident response runbook.
