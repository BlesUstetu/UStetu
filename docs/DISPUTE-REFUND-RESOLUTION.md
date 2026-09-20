# UStetu Dispute & Refund Resolution — Future Design

> **Status: FUTURE DESIGN / NOT IMPLEMENTED IN V1**

UStetu V1 does not contain a dispute resolver, dispute state, governance-controlled refund path, or manual resolution authority.

This document is retained only to preserve research for a future protocol version.

## V1 Boundary

V1 order states are:

- PAYMENT_PENDING
- PAID
- COMPLETED
- EXPIRED

There is no V1 `DISPUTED`, `REFUNDED`, `CANCELLED`, or resolver-controlled state.

## Future Considerations

A future version that adds disputes would need to define, before implementation:

- who may open a dispute
- what evidence is admissible
- whether a resolver is trusted or decentralized
- how user funds remain protected
- exact refund/release outcomes
- timeout behavior
- appeal behavior
- accounting invariants
- replay protection
- migration of existing obligations

No section of this document should be interpreted as an implemented V1 capability.
