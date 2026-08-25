# UStetu Threat Model v1.0

## Security Objective

Protect buyer payments, seller token inventory, seller claimable proceeds, and protocol integrity while minimizing privileged trust.

## Assets

1. Seller token inventory.
2. Buyer USDC/USDT payment.
3. Seller claimable proceeds.
4. Marketplace fee / treasury balance.
5. Order state and recipient.
6. Governance permissions.
7. Token and listing configuration.

## Trust Boundaries

```text
User Wallet
   │
   ▼
Frontend ───── Backend / Indexer
   │                 │
   ▼                 ▼
Smart Contracts ← Blockchain
   │
   ├── Escrow
   ├── Marketplace
   ├── Registry
   └── Governance
```

The frontend and backend are untrusted from a custody perspective. They must never be the authority for balances, ownership, recipient addresses, or settlement state.

## Threat Actors

### 1. Malicious Buyer

Potential actions:

- Attempt double payment / replay.
- Attempt unauthorized refund.
- Manipulate frontend state.
- Submit malformed token/payment inputs.
- Attempt reentrancy through malicious token behavior.

Primary controls:

- On-chain state machine.
- Explicit order identity.
- Safe token operations.
- Access control.
- Accounting invariants.

### 2. Malicious Seller

Potential actions:

- Attempt to withdraw locked inventory.
- Attempt to redirect proceeds.
- Attempt to change recipient or order facts.
- Register malicious/non-compatible token.
- Attempt double settlement.

Primary controls:

- Escrow custody of locked inventory.
- Immutable order recipient.
- Registered withdrawal wallet.
- Token compatibility policy.
- State-machine enforcement.

### 3. Compromised Frontend

Potential actions:

- Display incorrect recipient.
- Display incorrect price.
- Hide fees.
- Attempt to call unauthorized functions.
- Phishing-like UI manipulation.

Controls:

- User-facing confirmation of critical facts.
- On-chain validation.
- Recipient immutability.
- Contract-level fee/accounting rules.
- Wallet signature requirements.

### 4. Compromised Backend / Indexer

Potential actions:

- Modify displayed balances.
- Modify transaction status in UI.
- Provide stale or malicious metadata.

Controls:

- Blockchain as source of truth.
- TX hash verification.
- Event indexing with reorg handling.
- UI never authorizes financial transfers from database values.

### 5. Malicious Token Contract

Potential actions:

- Fee-on-transfer.
- Rebase balance.
- Revert transfer.
- Return non-standard values.
- Callback/reentrancy.
- Blacklist escrow.
- Change behavior through upgradeability.

Controls:

- Token allowlist/verification policy.
- Compatibility testing.
- SafeERC20.
- Explicit unsupported-token policy.
- Deposit amount verification.
- Isolation of risky token types.

### 6. Compromised Privileged Key

Potential actions:

- Attempt configuration takeover.
- Pause abuse.
- Role escalation.
- Governance manipulation.

Controls:

- Multisig.
- AccessManager.
- Timelock.
- Security Council.
- Least privilege.
- Event monitoring.
- Key rotation procedures.

### 7. Malicious Governance Participant

Potential actions:

- Approve harmful configuration.
- Attempt fee abuse.
- Attempt migration abuse.

Controls:

- Quorum / multisig policy.
- Timelock delay.
- Publicly auditable proposals.
- Migration safeguards.
- Separation between treasury and user escrow.

## Key Attack Classes

### Reentrancy

Risk: malicious token or callback causes nested state changes.

Mitigation: checks-effects-interactions, SafeERC20, ReentrancyGuard where appropriate, and invariant testing.

### Double Settlement

Risk: same order released twice.

Mitigation: terminal order state + unique order ID + invariant tests.

### Double Refund

Risk: same payment refunded more than once.

Mitigation: terminal state + accounting update before transfer + invariant tests.

### Recipient Substitution

Risk: attacker changes buyer receiving address or seller withdrawal destination.

Mitigation: immutable order recipient and registered seller withdrawal wallet enforced by contract.

### Price Manipulation

Risk: frontend changes price after user review.

Mitigation: order stores immutable execution price; settlement uses order values, not UI state.

### Fee Manipulation

Risk: unexpected marketplace fee.

Mitigation: contract-controlled fee configuration, bounded maximum, governance delay, explicit preview, deterministic accounting.

### Inventory Mismatch

Risk: seller lists one token but deposits another.

Mitigation: listing binds to `chainId + tokenContractAddress`; escrow verifies token identity.

### Unsupported Token Behavior

Risk: accounting breaks because token transfers are non-standard.

Mitigation: token eligibility policy and compatibility checks before listing activation.

### Frontend Phishing / Address Poisoning

Risk: user signs transfer to attacker address.

Mitigation: prominent recipient display, copy/verify UX, no arbitrary recipient field in normal buyer checkout, and contract-level recipient binding.

### Upgrade / Migration Abuse

Risk: new implementation loses or redirects user obligations.

Mitigation: timelocked governance, migration invariants, explicit migration plan, user asset reconciliation, and external review.

## Security Assumptions

- Users control their own wallet keys.
- Supported payment token contracts behave within the approved compatibility policy.
- Governance signers protect their keys.
- Blockchain consensus remains secure.
- External audits reduce but do not eliminate risk.

## Residual Risks

No smart-contract system can guarantee zero risk. UStetu must communicate remaining risks clearly, maintain monitoring, and require a staged testnet → audit → mainnet process.
