# UStetu Dispute & Refund Resolution v1.0

## 1. Principle

Disputes exist to protect buyers and sellers when a deterministic normal settlement cannot safely complete. A dispute is a state-machine control, not a generic admin transfer mechanism.

## 2. Who Can Open a Dispute

Eligible parties:

- Buyer recorded on the order.
- Seller recorded on the order.

Security/governance roles may trigger a protective path only where the emergency policy explicitly permits it.

A third party cannot open a dispute on an unrelated order merely by knowing the order ID.

## 3. Eligible Order States

A dispute may be opened only in states defined by policy, initially expected to include:

- `PAID`
- `ESCROWED`
- `RELEASABLE`

The exact window must be finalized before implementation.

Terminal orders such as `COMPLETED`, `REFUNDED`, and `CANCELLED` cannot be reopened in v1.

## 4. Dispute Opening

```text
Buyer/Seller
    ↓
Open Dispute
    ↓
Order = DISPUTED
    ↓
Release/Refund paths locked
    ↓
Evidence / review
    ↓
Authorized Resolution
    ↓
COMPLETED or REFUNDED
```

Opening a dispute must record:

- Dispute ID.
- Order ID.
- Opener.
- Reason code.
- Timestamp.
- Initial status.

## 5. Reason Codes

Initial reason-code framework:

- `SELLER_NON_DELIVERY`
- `PAYMENT_PROBLEM`
- `TOKEN_COMPATIBILITY`
- `WRONG_ASSET`
- `SYSTEM_FAILURE`
- `SECURITY_INCIDENT`
- `OTHER_POLICY_APPROVED`

Reason codes are classification data, not automatic proof of fault.

## 6. Resolution Authority

The resolver must operate under least privilege.

A resolver does not receive an arbitrary token-transfer function.

Instead, the resolver chooses a predefined outcome and the escrow contract executes only that outcome for the specified order.

Allowed v1 outcomes:

### A. Release

Use when the buyer should receive the token and seller should receive proceeds.

Effects:

- Release token to recorded buyer recipient.
- Credit seller proceeds.
- Credit treasury fee.
- Mark order `COMPLETED`.

### B. Refund

Use when buyer payment should be returned.

Effects:

- Return eligible payment to recorded buyer.
- Handle seller inventory according to the defined inventory path.
- Reverse or exclude fee according to the final refund-fee policy.
- Mark order `REFUNDED`.

## 7. Seller Inventory After Refund

If a refund occurs before token release, seller inventory associated with the order becomes available again only after the refund state transition has completed and accounting is reconciled.

Seller cannot manually unlock inventory while the order is disputed.

## 8. Buyer Protection

Buyer protection requirements:

- Refund destination is immutable buyer address.
- Refund amount is deterministic.
- Refund cannot be claimed twice.
- Completion cannot occur after refund.
- Dispute blocks conflicting settlement.
- Transaction history records the dispute and resolution.

## 9. Seller Protection

Seller protection requirements:

- Seller cannot be refunded and charged twice for the same obligation.
- Seller inventory cannot be permanently lost merely because a dispute was opened.
- Seller proceeds are credited only once.
- Resolution must be based on the defined state machine.

## 10. Security Council Emergency Path

During a genuine security incident, Security Council authority may pause selected operations according to the emergency matrix.

The Security Council must not have a generic function such as:

`withdraw(orderId, arbitraryAddress, amount)`

Instead, emergency controls should be limited to protocol state changes such as:

- Pause new orders.
- Pause withdrawals if necessary.
- Pause affected listings or token classes where supported.
- Enable a predefined protective refund path if explicitly designed and tested.

Emergency actions emit events and are subject to post-incident governance review.

## 11. No Admin Override

There is no administrative shortcut that changes an order directly from:

`DISPUTED → arbitrary transfer`

Every resolution must be one of the explicitly implemented outcomes.

## 12. Timeout / Non-Response

If a party fails to respond within a defined dispute window, the protocol may allow a deterministic escalation or resolution path.

This timeout must be based on on-chain timestamps and documented policy, not an off-chain operator's private decision.

## 13. Evidence

Evidence may be stored or referenced off-chain, but the financial resolution must be represented on-chain.

The protocol should store compact references such as hashes rather than large documents.

## 14. Refund Fee Policy

Before implementation, UStetu must choose one consistent rule. Recommended baseline:

**Marketplace fee is only considered earned upon successful completion.**

Therefore, if an order is refunded before completion, no marketplace fee should remain as earned protocol revenue unless a separately disclosed policy and legal review supports another treatment.

This recommendation reduces accounting ambiguity and improves buyer protection.

## 15. Dispute Limits

To reduce griefing and spam, the protocol may enforce:

- One active dispute per order.
- Minimum dispute window.
- Maximum dispute window.
- Optional dispute bond only if justified and carefully designed.

For v1, avoid adding a dispute bond unless testing shows a clear need; complexity should not be introduced prematurely.

## 16. Events

Required events:

- `DisputeOpened`
- `DisputeResolved`
- `OrderRefunded`
- `OrderCompleted`
- `EmergencyStateChanged`

Events should contain order/dispute identifiers and relevant resolver/reason information.

## 17. Security Invariants

1. A dispute cannot cause arbitrary asset transfer.
2. An order cannot be completed twice.
3. An order cannot be refunded twice.
4. A refunded order cannot later complete.
5. A completed order cannot later refund in v1.
6. Dispute state blocks conflicting settlement.
7. Refund destination is immutable.
8. Seller inventory accounting remains conserved.
9. Seller proceeds cannot become negative.
10. Emergency authority cannot bypass accounting invariants.

## 18. Implementation Gate

Before Solidity implementation, finalize:

- Exact dispute opening window.
- Exact eligible states.
- Resolver role composition.
- Evidence model.
- Timeout behavior.
- Refund inventory path.
- Refund fee policy.
- Emergency protective-refund scope.
