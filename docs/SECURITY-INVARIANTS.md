# UStetu V1 Security Invariants

## Order

1. An order completes at most once.
2. An expired order cannot complete.
3. An unpaid order cannot complete.
4. The recipient is immutable.
5. Recorded order pricing is immutable.

## Inventory

1. `inventoryLocked <= inventoryDeposited`.
2. Locked inventory cannot be withdrawn.
3. Completion decreases inventory by the exact delivered amount.
4. Expiry releases locked inventory.

## Payment and Settlement

1. Only Base native USDC can fund V1 orders.
2. Required payment must be received exactly.
3. `grossPayment = sellerProceeds + marketplaceFee`.
4. Claimable balances cannot become negative.
5. Token delivery is checked using the recipient balance delta.
6. Off-chain indexer state cannot authorize financial transfers.

## Withdrawals

1. Seller proceeds can only be withdrawn by the seller.
2. Proceeds go to the effective withdrawal wallet.
3. Withdrawal cannot exceed claimable balance.
4. Withdrawal-wallet changes have a 24-hour delay.

## Token Registration

1. Token identity is chain ID + contract address under the V1 domain separator.
2. Duplicate registration is rejected.
3. Registration is permissionless.
4. Registration is not verification or safety certification.

## Privilege Boundary

V1 has no admin/owner/governance authority capable of overriding these invariants.