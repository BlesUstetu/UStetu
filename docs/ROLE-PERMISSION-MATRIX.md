# UStetu V1 Role & Permission Model

## Status

**Current V1 architecture — no privileged role system.**

UStetu V1 deliberately does not implement an operator/admin/governance role hierarchy.

## Actors

| Actor | V1 permissions |
|---|---|
| Buyer | Create orders, fund own orders, complete eligible orders, use normal wallet actions |
| Seller | Self-register, register tokens permissionlessly, create/manage own listings, withdraw own claimable proceeds |
| Any caller | Register eligible token, trigger permissionless expiry/auto-release when conditions are met, read public state |
| Fee recipient | Withdraw only marketplace fee claimable balance |
| Backend/indexer | Read/index public blockchain state; no settlement authority |
| Frontend | Construct wallet transactions; no custody authority |

## Explicitly Absent

V1 has no:

- ADMIN / DEFAULT_ADMIN
- OPERATOR
- TOKEN_VERIFIER
- DISPUTE_RESOLVER
- SECURITY_COUNCIL
- GOVERNOR
- TIMELOCK
- ACCESSMANAGER_ADMIN
- treasury operator role

There is no privileged function that can rewrite user balances or historical order facts.

## Seller Boundaries

A seller can only operate on listings they own and inventory they control through the protocol.

A seller cannot:

- withdraw locked inventory
- withdraw another seller's proceeds
- change an existing order recipient
- change an existing order price
- bypass settlement accounting

## Withdrawal Wallet

Seller proceeds are claimable and can be withdrawn only to the seller's effective withdrawal wallet.

A withdrawal-wallet change has a 24-hour delay.

## Protocol Boundary

The absence of privileged roles is intentional. It also means V1 cannot provide centralized emergency recovery or manual dispute resolution.

Future governance designs must be documented separately and must not be treated as V1 functionality.
