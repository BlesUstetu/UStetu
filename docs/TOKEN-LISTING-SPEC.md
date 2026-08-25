# UStetu Token Registration & Listing Specification v1.0

## 1. Core Rule

A seller cannot create an active listing without registering the exact token contract address and network first.

Token identity is:

`tokenId = hash(chainId, tokenContractAddress)`

The token symbol or name is never used as the unique identity.

## 2. Seller Flow

```text
Connect Wallet
      ↓
Seller Registration
      ↓
Select Network
      ↓
Enter Token Contract Address
      ↓
Read On-chain Metadata
      ↓
Compatibility Check
      ↓
Verification Review
      ↓
Approved
      ↓
Create Listing
      ↓
Deposit Inventory
      ↓
Listing Active
```

## 3. Mandatory Fields

Seller must provide:

- Network / chain.
- Token contract address.
- Listing price.
- Payment token.
- Inventory amount.
- Minimum order amount.
- Maximum order amount where applicable.

The UI may display token name, symbol, decimals, logo, and other metadata automatically, but these are not substitutes for the contract address.

## 4. Contract Address Validation

Before registration, the system must verify:

1. Address is syntactically valid.
2. Address is not zero address.
3. Address contains deployed contract code.
4. Network matches the selected deployment.
5. Required ERC-20 read methods work according to policy.
6. `decimals()` is within supported bounds.
7. Token compatibility checks pass.
8. Token is not already registered under the same chain/address identity.

## 5. Token Metadata

The UI may read:

- `name()`
- `symbol()`
- `decimals()`
- `totalSupply()` where useful
- seller balance

Metadata should be treated as informational snapshots. The contract address remains authoritative.

## 6. Verification Status

Suggested states:

- `UNREGISTERED`
- `PENDING`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`
- `DELISTED`

Only `APPROVED` tokens can be used for active marketplace listings.

## 7. Compatibility Policy

The final v1 policy should initially favor standard, predictable ERC-20 behavior.

Potentially problematic token classes must be rejected or explicitly isolated:

- Fee-on-transfer.
- Rebasing.
- Tokens requiring special sender/recipient permissions.
- Tokens with transfer callbacks that create unsafe external-call behavior.
- Tokens with blacklist/freeze controls that can affect escrow.
- Tokens with upgradeable behavior that creates unacceptable counterparty risk.
- Tokens that do not reliably expose required ERC-20 behavior.

A token that can make escrow accounting unpredictable must not be listed merely because its contract address is valid.

## 8. Seller Deposit

For the reference v1 model, seller inventory is transferred into escrow before inventory becomes available for sale.

The protocol must verify the actual received amount according to the approved token policy.

For standard non-fee-on-transfer ERC-20 tokens:

`receivedAmount == requestedDepositAmount`

If this invariant cannot be guaranteed, the token should be rejected under the initial compatibility policy.

## 9. Listing Creation

A listing binds together:

- Seller.
- Token ID.
- Payment token.
- Unit price.
- Available inventory.
- Order limits.
- Listing status.

The seller can update future listing price subject to protocol rules.

## 10. Seller Price Editing

Seller may edit the listing price while the listing is active, provided the seller remains authorized and the new price meets protocol limits.

Important rule:

> **Changing a listing price never changes the price of an existing order.**

Example:

```text
Listing price
100 USDC
      ↓
Buyer creates Order #101
      ↓
Order #101 locks price = 100 USDC
      ↓
Seller changes listing price
120 USDC
      ↓
Order #101 remains 100 USDC
New orders use 120 USDC
```

## 11. Inventory Changes

Seller may add inventory through a new deposit.

Seller may withdraw only inventory that is not locked against active orders.

Locked inventory is not editable by the seller until the associated obligation reaches an eligible terminal state.

## 12. Listing Status

Recommended states:

- `DRAFT`
- `ACTIVE`
- `PAUSED`
- `LOW_STOCK`
- `SOLD_OUT`
- `CLOSED`
- `SUSPENDED`

`LOW_STOCK` may be a derived UI state rather than an on-chain enum.

## 13. Payment Token

Payment token must come from the explicit network-specific allowlist. The symbol `USDC` or `USDT` is insufficient by itself.

Identity:

`paymentTokenId = hash(chainId, paymentTokenContractAddress)`

## 14. Risk Disclosure

Before purchase, buyer should see:

- Token contract address.
- Network.
- Seller verification status.
- Token verification status.
- Price.
- Available inventory.
- Payment asset.
- Marketplace fee.
- Risk disclosure.

UStetu verification does not guarantee token value, liquidity, legitimacy, profitability, or future exchange listing.

## 15. Duplicate / Collision Protection

The system must prevent accidental duplicate token registration under the same network and contract address.

Different contracts with the same symbol are distinct assets.

The same contract address on different chains is treated as a different token identity unless the final cross-chain registry explicitly defines another model.

## 16. Delisting / Suspension

Suspending a token or listing must not silently erase existing obligations.

Existing orders must continue through the order state machine, or enter a defined protective path such as dispute/refund where the policy requires it.

Seller inventory remaining outside active orders must remain attributable to the seller.

## 17. Frontend Requirements

The registration UI should:

- Provide a network selector.
- Require contract address.
- Validate address format before submission.
- Display resolved token name/symbol/decimals.
- Display contract address in full or copyable form.
- Provide a verification state.
- Prevent active listing submission until verification passes.
- Warn when the wallet is on the wrong network.

## 18. Security Principle

The frontend may assist verification, but it is never the security boundary. The smart contract must enforce token identity, seller authorization, listing ownership, inventory accounting, payment-token allowlists, and order pricing.

## 19. Example

```text
Seller: 0xSELLER...
Network: Base
Token: DNA
Contract: 0xTOKEN...

Verification:
✓ Contract exists
✓ ERC-20 compatible
✓ Supported token behavior
✓ Token approved

Listing:
Price: 2.70 USDC
Inventory: 2,800 DNA
Min: 1 DNA
Max: 500 DNA

[ DEPOSIT & ACTIVATE ]
```

## 20. Implementation Gate

Before Solidity implementation, finalize:

- Exact supported token compatibility rules.
- Verification authority and process.
- Deposit accounting method.
- Suspension impact on active orders.
- Listing price bounds.
- Minimum/maximum order limits.
- Per-seller listing limits.
