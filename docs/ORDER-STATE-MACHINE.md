# UStetu Order State Machine v1.0

## Purpose

The order state machine prevents ambiguous settlement, double release, double refund, and conflicting dispute actions.

## States

### `NONE`

No order exists.

### `CREATED`

Order exists with immutable buyer, seller, recipient, token, payment asset, quantity, and pricing facts. No settlement has occurred.

### `PAYMENT_PENDING`

Order is waiting for valid payment confirmation.

### `PAID`

Required buyer payment has been verified according to the payment model.

### `ESCROWED`

The assets required to satisfy the order are secured under the escrow rules.

### `RELEASABLE`

All deterministic conditions for settlement have been satisfied and no blocking dispute exists.

### `COMPLETED`

Token and payment settlement has completed. This is terminal.

### `REFUNDED`

Eligible buyer payment has been returned. This is terminal unless a future architecture explicitly defines another state transition; v1 should not reopen refunded orders.

### `CANCELLED`

Order was cancelled before irreversible settlement, according to the applicable cancellation rules. Terminal.

### `DISPUTED`

A permitted party opened a dispute. Conflicting settlement actions are blocked until resolution.

### `EXPIRED`

The order exceeded its permitted lifetime without reaching a valid settlement state. Refund/cancellation behavior must be deterministic. Terminal after the defined resolution action.

## Allowed Transitions

```text
NONE
  ↓
CREATED
  ↓
PAYMENT_PENDING
  ↓
PAID
  ↓
ESCROWED
  ↓
RELEASABLE
  ↓
COMPLETED
```

Alternative paths:

```text
CREATED → CANCELLED
PAYMENT_PENDING → CANCELLED
PAYMENT_PENDING → EXPIRED
PAID → DISPUTED
ESCROWED → DISPUTED
RELEASABLE → DISPUTED   (only if policy permits)
DISPUTED → COMPLETED
DISPUTED → REFUNDED
PAID → REFUNDED         (only if deterministic refund rule permits)
ESCROWED → REFUNDED    (only if deterministic refund rule permits)
```

## Prohibited Transitions

- `COMPLETED → CREATED`
- `COMPLETED → REFUNDED`
- `REFUNDED → COMPLETED`
- `CANCELLED → COMPLETED`
- `EXPIRED → COMPLETED`
- Any state → arbitrary state by admin
- Any settlement action without state validation

## Settlement Rules

A completion operation must be idempotent and require:

1. Correct order state.
2. Correct seller/listing relationship.
3. Required inventory secured.
4. Required buyer payment secured/verified.
5. No active blocking dispute.
6. Correct recipient recorded in the order.
7. Correct fee and proceeds calculation.
8. No prior completion/refund/cancellation.

## Refund Rules

Refund must:

- Require an eligible state.
- Return payment only to the buyer recorded in the order.
- Mark the order terminal.
- Prevent later completion.
- Emit `OrderRefunded`.

## Dispute Rules

Opening a dispute must:

- Require an eligible state.
- Record the opener and reason.
- Prevent conflicting release/refund execution until resolution.
- Emit `DisputeOpened`.

Resolution must produce exactly one permitted outcome and emit `DisputeResolved`.

## Recipient Immutability

`order.recipient` is immutable after creation. A wallet change by the buyer affects only future orders.

## Idempotency / Replay Protection

Every operation that changes an order must verify the current state and use the order's unique ID. Repeating the same operation after a terminal transition must revert.

## Testing Requirements

The test suite must cover:

- Every allowed transition.
- Every prohibited transition.
- Double release.
- Double refund.
- Release after refund.
- Refund after completion.
- Dispute during each eligible state.
- Expiry boundaries.
- Recipient immutability.
- Fee/accounting correctness.
- Reentrancy attempts.
- Malicious/reverting ERC-20 behavior.
