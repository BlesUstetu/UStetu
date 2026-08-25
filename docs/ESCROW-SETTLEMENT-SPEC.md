# UStetu Escrow & Settlement Specification v1.0

## 1. Objective

The escrow layer protects both sides of a transaction without requiring UStetu to become a general custodian. Assets are locked by protocol rules and released only when the order state machine permits the outcome.

## 2. Core Settlement Model

Normal purchase:

```text
SELLER
  │
  │ deposit token inventory
  ▼
USTETU ESCROW
  │
  │ buyer payment
  ▼
USTETU ESCROW
  │                 │
  │ token release   │ seller proceeds
  ▼                 ▼
BUYER             CLAIMABLE BALANCE
                      │
                      ▼
              REGISTERED SELLER WALLET
```

The exact payment direction and escrow mechanism must be implemented so that the protocol never temporarily assigns user funds to an arbitrary administrator.

## 3. Seller Inventory

Before a listing can sell inventory, the seller must deposit the token into the escrow-controlled contract or otherwise establish a contract-enforced inventory obligation.

For the safest v1 model, inventory is physically held by the escrow contract while listed/locked.

Conceptual accounting:

`availableInventory = depositedInventory - lockedInventory`

A seller cannot withdraw inventory that is locked against an active order.

## 4. Buyer Payment

Buyer pays the exact order amount in the specified supported payment token.

The contract must verify:

- Correct payment token.
- Correct order.
- Correct gross amount.
- Correct buyer.
- Correct recipient.
- Order is not terminal.
- Payment has not already been accepted.

For ERC-20 payments, SafeERC20-compatible operations must be used.

## 5. Exact Settlement Accounting

For a successful order:

`grossPayment = sellerProceeds + marketplaceFee`

With a 1% fee:

`marketplaceFee = grossPayment * 100 / 10_000`

`sellerProceeds = grossPayment - marketplaceFee`

The final implementation must define rounding behavior for integer token units and ensure that no amount is silently lost.

Example:

```text
Buyer pays:       270 USDC
Marketplace fee:  2.70 USDC
Seller proceeds: 267.30 USDC
```

The example assumes a payment token with sufficient decimals for the displayed precision.

## 6. Normal Completion

A normal completion requires all of the following:

1. Order is in a releasable state.
2. Seller inventory sufficient for the order is secured.
3. Buyer payment is secured/verified.
4. No blocking dispute exists.
5. Order has not already completed/refunded/cancelled.
6. Recipient is the immutable recipient recorded at order creation.
7. Fee and proceeds are calculated deterministically.

Settlement then performs one atomic state transition where practical:

- Reduce locked inventory.
- Transfer token to buyer recipient.
- Credit seller claimable proceeds.
- Credit marketplace fee to treasury accounting.
- Mark order completed.
- Emit completion event(s).

## 7. Seller Claimable Balance

Seller proceeds are not sent to an arbitrary address at settlement time.

They are credited to:

`claimable[paymentToken][seller]`

Seller can later withdraw an eligible amount to the registered withdrawal wallet.

This separates transaction settlement from withdrawal destination control.

## 8. Seller Withdrawal

Withdrawal must verify:

- Caller is the registered seller.
- Asset is supported.
- Claimable balance is sufficient.
- Amount is within applicable limits.
- Destination equals the registered withdrawal wallet.
- Security/timelock rules are satisfied if applicable.

The destination is not supplied as a free-form arbitrary address by the withdrawal UI.

## 9. Buyer Refund

Refund must return the eligible payment to the immutable buyer address recorded on the order.

A refund must:

- Validate the order state.
- Validate refundable amount.
- Prevent subsequent completion.
- Update accounting before external token transfer where required by checks-effects-interactions.
- Emit `OrderRefunded`.

The refund amount and treatment of marketplace fees must be explicitly defined per refund reason before implementation.

## 10. Dispute Lock

When an order becomes disputed, the protocol must block competing settlement actions until the dispute is resolved according to policy.

The dispute resolver should choose only from explicit outcomes:

- Release to buyer / seller proceeds.
- Refund buyer.
- Other narrowly defined deterministic outcome if required by final business rules.

There must be no generic arbitrary-transfer resolution function.

## 11. Cancellation

Cancellation is allowed only in states and circumstances defined by the order state machine.

If seller inventory has already been committed to an order, cancellation must correctly unlock or refund it according to the defined path.

## 12. Expiry

Orders may have an expiry timestamp.

At expiry, anyone may be able to trigger the deterministic expiry path if the final architecture allows permissionless settlement maintenance.

Expiry must not create an admin custody path.

## 13. Token Compatibility

Before accepting a token listing, UStetu must define whether the token is compatible with escrow.

At minimum, the system must decide how to handle:

- Fee-on-transfer tokens.
- Rebasing tokens.
- Tokens with transfer hooks.
- Blacklist controls.
- Pausable tokens.
- Upgradeable token implementations.
- Tokens with non-standard ERC-20 behavior.

Unsupported behavior should cause the token to be rejected rather than silently corrupt accounting.

## 14. Payment Token Policy

USDC and USDT are the initial intended payment assets. Each network deployment must maintain an explicit allowlist of payment-token contract addresses.

The symbol alone is never sufficient to identify a payment token.

Payment identity is:

`chainId + paymentTokenContractAddress`

## 15. Emergency Behavior

Emergency pause should prevent new risky actions according to the final pause matrix while preserving user claim/refund paths wherever safely possible.

The emergency mechanism must not become an unrestricted asset seizure mechanism.

## 16. Accounting Invariants

The formal invariant suite must establish at least:

1. No order can complete more than once.
2. No order can refund more than once.
3. A completed order cannot later be refunded in v1.
4. A refunded order cannot later complete.
5. Seller locked inventory cannot be withdrawn.
6. Seller claimable balance cannot become negative.
7. Treasury fee accounting cannot consume user proceeds.
8. User obligations are fully backed by escrow-controlled assets according to the defined accounting model.
9. Order recipient cannot change after creation.
10. Withdrawal cannot send seller proceeds to an unregistered destination.
11. Only supported payment tokens are accepted.
12. Only supported listing tokens are accepted.

## 17. Reentrancy / External Calls

All functions performing token transfers or external calls must be reviewed for reentrancy and state-ordering hazards. ReentrancyGuard may be used where appropriate, but the architecture must not rely on the modifier alone; accounting and state transitions must be correctly structured.

## 18. Events

Settlement-critical events include:

- `InventoryDeposited`
- `PaymentEscrowed`
- `PaymentVerified`
- `OrderReleased`
- `OrderCompleted`
- `OrderRefunded`
- `SellerWithdrawal`
- `DisputeOpened`
- `DisputeResolved`

Events should include enough indexed identifiers to support reliable off-chain indexing without exposing unnecessary sensitive information.

## 19. Implementation Gate

No Solidity implementation is considered final until:

- Fee rounding is specified.
- Refund fee treatment is specified.
- Expiry rules are specified.
- Token compatibility policy is specified.
- Payment-token allowlists are specified per network.
- Full invariant set is written.
- Threat model is complete.
