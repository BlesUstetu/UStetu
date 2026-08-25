# UStetu Payment & Refund Specification v1.0

## 1. Scope

This specification defines the initial payment, fee, settlement, and refund model for USDC/USDT purchases.

## 2. Payment Token Allowlist

Each deployed network has an explicit allowlist of payment-token contract addresses.

The protocol never accepts a token solely because its symbol is `USDC` or `USDT`.

Identity:

`paymentTokenId = hash(chainId, paymentTokenContractAddress)`

## 3. Buyer Payment Flow

```text
Buyer selects listing
      ↓
Order created
      ↓
Price + quantity + fee shown
      ↓
Buyer approves payment token
      ↓
Buyer funds order
      ↓
Exact payment verified
      ↓
Order becomes PAID
      ↓
Escrow conditions satisfied
      ↓
Order becomes RELEASABLE
      ↓
Settlement
```

## 4. Exact Payment

The order stores the exact execution price and quantity at creation.

`grossPayment = tokenAmount × unitPrice`

The contract must calculate this using checked arithmetic and explicit denomination rules.

Buyer must fund the exact required amount.

Overpayment must not silently become seller proceeds. The v1 implementation should reject incorrect payment amounts unless a separately specified exact refund mechanism is implemented.

## 5. Payment Verification Principle

The blockchain state is the authority.

The preferred model is direct on-chain transfer into the escrow contract as part of the user's signed transaction. A backend/indexer may observe and report the event but must not be able to fabricate a payment.

If a separate verification hook is retained for operational reasons, it must prove or reference an on-chain fact and cannot mint an internal balance from an off-chain claim alone.

## 6. Fee

Default marketplace fee:

**1% of successful settlement gross payment.**

Basis points:

`FEE_BPS = 100`

Calculation:

`fee = grossPayment × FEE_BPS / 10_000`

`sellerProceeds = grossPayment - fee`

Integer rounding must be deterministic. The final implementation must document the rounding direction and ensure:

`fee + sellerProceeds == grossPayment`

## 7. Example

```text
Quantity:          100 DNA
Unit price:        2.70 USDC
Gross payment:     270.00 USDC
Marketplace fee:     2.70 USDC
Seller proceeds:   267.30 USDC
```

## 8. Seller Settlement

On successful completion:

1. Buyer payment is confirmed.
2. Seller token inventory is sufficient and locked.
3. Order has no blocking dispute.
4. Token is transferred to immutable buyer recipient.
5. Seller proceeds are credited to seller claimable balance.
6. Marketplace fee is credited to treasury accounting.
7. Order becomes `COMPLETED`.

The seller's proceeds are not sent to an arbitrary destination during settlement.

## 9. Buyer Refund Principle

If a refund condition is satisfied, the eligible payment returns to the buyer address recorded on the order.

Refund must not depend on the buyer typing a new destination address.

## 10. Refund Reasons

Final v1 implementation should support explicit reason codes, for example:

- `ORDER_EXPIRED`
- `SELLER_FAILURE`
- `ELIGIBILITY_FAILURE`
- `DISPUTE_RESOLUTION`
- `EMERGENCY_PROTECTIVE_REFUND`

Only approved reasons may trigger a refund.

## 11. Refund Fee Treatment

This remains a pre-implementation decision and must be explicitly specified before Solidity coding.

The safest accounting principle is that a refund must not create a hidden protocol liability. The final policy must state whether the marketplace fee is:

- never credited until completion, or
- reversed with the buyer refund, or
- retained only for a defined, disclosed refund reason.

No fee may be retained unexpectedly.

## 12. Refund Atomicity

Where possible, refund accounting should be updated before the external token transfer and protected against reentrancy.

Successful refund must:

- mark order terminal;
- prevent later completion;
- decrease the escrowed buyer obligation exactly once;
- transfer the defined refund amount to the recorded buyer;
- emit `OrderRefunded`.

## 13. Seller Failure

If the seller cannot satisfy a valid order after payment is secured, the protocol must have a deterministic path to protect the buyer, such as refund/dispute resolution, without requiring an administrator to manually transfer buyer funds.

## 14. Payment Failure

If the payment transaction reverts, the order must not be considered paid.

A failed wallet transaction must not create a claimable seller balance.

## 15. Duplicate Payment

The same order cannot accept payment twice.

After the order records sufficient payment, subsequent funding attempts must revert or be handled by a specifically defined excess-payment mechanism. No silent over-crediting is allowed.

## 16. Wrong Payment Token

A transfer in an unsupported payment token does not satisfy the order's payment obligation.

The UI must show the exact payment token contract and network before signing.

## 17. Wrong Network

Frontend must warn the user when the wallet network differs from the order's target network.

The smart contract itself must only accept transactions on its deployment network and supported payment-token addresses.

## 18. Seller Withdrawal

Seller claimable proceeds are withdrawn separately from order settlement.

Withdrawal destination:

`registeredWithdrawalWallet[seller]`

No arbitrary recipient field is allowed in the normal withdrawal function.

## 19. Treasury Separation

Marketplace fees become treasury-owned only after successful settlement accounting.

Treasury accounting must never be used to satisfy seller or buyer obligations.

## 20. User Transparency

Before confirmation, buyer should see:

- Token.
- Token contract.
- Network.
- Quantity.
- Unit price.
- Gross payment.
- Marketplace fee.
- Total payment.
- Receiving wallet.
- Seller verification.
- Risk disclosure.

After transaction, buyer should receive:

- Order ID.
- Transaction hash.
- Final status.
- Token received/refunded amount.
- Invoice download icon.

## 21. Security Requirements

- SafeERC20-compatible operations.
- Checks-effects-interactions.
- Reentrancy protection where appropriate.
- Exact state validation.
- Exact accounting.
- No arbitrary recipient.
- No off-chain-only payment confirmation.
- No admin override that bypasses settlement invariants.

## 22. Implementation Gate

Before Solidity implementation, finalize:

1. Fee rounding.
2. Refund fee treatment.
3. Exact payment overpayment policy.
4. Expiry and refund timing.
5. Seller-failure resolution.
6. Payment verification architecture.
7. Payment token addresses for each supported deployment.
8. Emergency refund scope.
