# UStetu Escrow & Settlement Specification — V1

## 1. Scope

This specification describes the implemented V1 settlement model.

UStetu V1 is non-custodial and has no admin settlement override.

## 2. Listing Inventory

A seller creates a listing and deposits token inventory into `UStetuEscrow`.

The contract tracks:

- `inventoryDeposited`
- `inventoryLocked`

Available inventory is:

`inventoryDeposited - inventoryLocked`

Only unlocked inventory can be withdrawn.

## 3. Order Creation

An order records immutable execution facts including:

- listing ID
- buyer
- seller
- recipient
- token
- payment token
- token amount
- unit price
- gross payment
- marketplace fee
- seller proceeds
- timestamps
- state

The recipient is the buyer wallet at order creation and cannot be changed by later wallet changes.

## 4. Payment

V1 payment is the immutable Base native USDC asset.

`fundOrder()` verifies the exact payment amount received.

## 5. Completion

Completion requires a valid paid order.

The escrow transfers the exact token amount to the immutable recipient and checks the recipient's balance delta.

On success:

- locked inventory decreases
- deposited inventory decreases
- seller proceeds become claimable
- marketplace fee becomes claimable
- order becomes `COMPLETED`

## 6. Expiry

An unpaid order expires after 15 minutes.

Expiry is permissionless and releases its locked inventory.

## 7. Auto-Release

After the defined 24-hour release window, eligible paid orders may be auto-released permissionlessly according to the contract state machine.

## 8. Withdrawals

Seller proceeds are withdrawn from claimable balance to the effective withdrawal wallet.

The fee recipient can withdraw the marketplace fee claimable balance.

Withdrawal-wallet changes are protected by a 24-hour delay.

## 9. Accounting Invariants

For completed orders:

`grossPayment == sellerProceeds + marketplaceFee`

For inventory:

`inventoryLocked <= inventoryDeposited`

No off-chain balance can authorize a transfer.

## 10. No Dispute Layer

V1 does not implement dispute resolution or a general refund path.

Future dispute architecture is documented separately.
