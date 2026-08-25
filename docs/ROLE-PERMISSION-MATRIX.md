# UStetu Role & Permission Matrix v1.0

## Principles

- Least privilege.
- Separation of duties.
- No single operational role can freely move user assets.
- Governance changes are delayed and auditable.
- Emergency authority is narrowly scoped and cannot become a hidden custody path.

## Roles

| Role | Main Responsibility | May Change User Asset Balances? | Governance Required? |
|---|---|---:|---:|
| BUYER | Purchase and receive tokens | No | No |
| SELLER | List tokens and withdraw own claimable proceeds | Only own eligible proceeds through protocol rules | No |
| OPERATOR | Operational marketplace configuration within assigned limits | No | Usually no; bounded role |
| TOKEN_VERIFIER | Review token eligibility / verification state | No | Policy-defined |
| DISPUTE_RESOLVER | Execute deterministic dispute resolution authority | Only through approved dispute state transitions | Policy-defined |
| SECURITY_COUNCIL | Emergency response / pause authority | No arbitrary transfers | Yes / predefined emergency path |
| GOVERNOR | Governance decisions | No direct custody | Yes |
| TIMELOCK | Delays approved sensitive changes | No direct custody | Yes |
| TREASURY_ROLE | Execute approved treasury operations | Treasury fees only | Yes |
| ADMIN / DEFAULT_ADMIN | Manage role administration through AccessManager | No arbitrary user-asset transfer | Multisig / governance |

## Buyer Permissions

Buyer may:

- Connect wallet.
- Create eligible orders.
- Approve payment token in their wallet.
- Cancel only where the order state permits.
- Open disputes within defined rules.
- Claim eligible refunds.
- View transactions and receipts.

Buyer may not:

- Change seller inventory.
- Change order recipient after order creation.
- Change seller proceeds.
- Modify protocol configuration.

## Seller Permissions

Seller may:

- Register seller profile.
- Register eligible token.
- Create listings backed by deposited inventory.
- Update price within rules.
- Pause/close own listing where allowed.
- Withdraw own unlocked token inventory.
- Withdraw own claimable USDC/USDT to the registered wallet.
- Open/respond to disputes involving own orders.

Seller may not:

- Withdraw locked inventory.
- Withdraw another seller's assets.
- Change an existing order recipient.
- Bypass escrow settlement.
- Change marketplace fee configuration.

## Operator Permissions

Operators may perform bounded operational actions such as:

- Manage marketplace metadata.
- Process approved operational workflows.
- Suspend a listing or seller only where policy permits.
- Review system health.

Operators must not receive arbitrary transfer permissions over escrow assets.

## Token Verifier

The token verification role may:

- Review token contract metadata.
- Approve or reject token eligibility according to published policy.
- Record verification state.

It must not have permission to transfer user funds or inventory.

## Dispute Resolver

Dispute resolution must operate only on eligible order states and according to a documented resolution policy.

The resolver must not have a general-purpose transfer function. Resolution should cause the escrow contract to execute one of the explicitly allowed outcomes, such as release or refund.

## Security Council

Emergency powers should be limited to actions such as:

- Pause new order creation.
- Pause withdrawals where required by an active incident.
- Pause a specific affected module or listing path where technically supported.

Emergency authority must not include arbitrary withdrawal of seller or buyer assets.

Emergency actions must emit events and be reviewable through governance/audit logs.

## Governor / Timelock

Sensitive changes should follow:

`Proposal → Approval → Timelock Delay → Execution`

Examples:

- Marketplace fee configuration.
- Critical role assignment.
- Contract upgrade, if upgrades are enabled.
- Migration execution.
- Supported token policy changes.

## Treasury

Treasury may only move marketplace fees that have become treasury-owned according to settlement accounting. Treasury operations must never overlap with user escrow balances.

## Access Control Implementation Direction

Use OpenZeppelin AccessManager for granular function-level permissions and a self-governed Timelock for high-impact governance. Exact roles, selectors, delays, and emergency scopes must be finalized before Solidity implementation.

## Finalization Gate

This matrix is a design baseline. Before deployment, every externally callable privileged function must be mapped to exactly one or more authorized roles and tested for unauthorized access.
