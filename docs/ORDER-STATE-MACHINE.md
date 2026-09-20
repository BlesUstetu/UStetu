# UStetu V1 Order State Machine

V1 implements four states:

- `PAYMENT_PENDING`
- `PAID`
- `COMPLETED`
- `EXPIRED`

```text
PAYMENT_PENDING
      │
      ├── fundOrder() ───────> PAID
      │                           │
      │                           ├── completeOrder() ──> COMPLETED
      │                           └── autoReleaseOrder() -> COMPLETED
      │
      └── expireOrder() ──────> EXPIRED
```

## Rules

- Payment window: 15 minutes.
- Funding requires the exact immutable V1 payment token and amount.
- An unpaid order can be expired permissionlessly after its deadline.
- A paid order can be completed under the contract rules.
- Eligible paid orders can be auto-released permissionlessly after 24 hours.
- Completed and expired orders are terminal.
- Recipient and historical order pricing facts are immutable.
- There is no admin override.

V1 does not implement dispute, refund, cancellation, or governance-controlled state transitions.