# UStetu Solidity Contract API Specification v1.0

## Status

Design specification only. Function signatures are subject to compiler/interface review before implementation.

## 1. UStetuMarketplace

### Seller

`registerSeller(address withdrawalWallet)`

Registers a seller and initial registered withdrawal wallet.

Reverts if:
- caller is already registered;
- withdrawal wallet is zero;
- protocol is paused for registration.

`requestWithdrawalWalletChange(address newWallet)`

Starts the protected wallet-change process.

`finalizeWithdrawalWalletChange()`

Activates a wallet change after all security delay requirements are satisfied.

### Token Registration

`registerToken(uint256 chainId, address token)`

Registers a token candidate. The deployment's actual chain ID must match the configured network identity.

Reverts if:
- token is zero address;
- token is not a contract;
- token fails compatibility policy;
- token is already registered;
- protocol is paused for token registration.

`setTokenVerification(bytes32 tokenId, VerificationStatus status)`

Governed verifier operation. Must not transfer assets.

### Listings

`createListing(bytes32 tokenId, address paymentToken, uint256 price, uint256 inventoryAmount, uint256 minOrderAmount, uint256 maxOrderAmount)`

Creates a listing and coordinates inventory deposit into escrow.

Reverts if:
- seller is not registered;
- token is not approved;
- payment token is unsupported;
- price is zero;
- inventory is zero;
- min/max rules are invalid;
- seller lacks required token balance/allowance;
- listing creation is paused.

`updateListingPrice(uint256 listingId, uint256 newPrice)`

Updates future-order pricing only. Existing orders retain their original execution price.

`updateListingLimits(uint256 listingId, uint256 minOrderAmount, uint256 maxOrderAmount)`

Updates future order constraints without modifying existing orders.

`pauseListing(uint256 listingId)`

Pauses new purchases against a listing. Existing obligations remain governed by their order state.

`closeListing(uint256 listingId)`

Closes a listing and permits eligible unlocked inventory withdrawal.

`withdrawListingInventory(uint256 listingId, uint256 amount)`

Withdraws only seller-owned inventory that is not locked against active orders.

## 2. UStetuEscrow

### Order Creation

`createOrder(uint256 listingId, uint256 tokenAmount)`

Creates an order using the current listing price and the caller as buyer. The recipient is set to the caller's wallet at creation.

Reverts if:
- listing inactive;
- token amount outside listing limits;
- insufficient available inventory;
- buyer or seller is blocked;
- payment token unsupported;
- order creation paused.

### Payment

`fundOrder(uint256 orderId)`

Secures the exact payment required by the order.

Reverts if:
- caller is not the recorded buyer;
- order is not payment-pending;
- payment already secured;
- payment amount is incorrect;
- payment token unsupported.

### Settlement

`markPaymentVerified(uint256 orderId)`

Permissioned/indexer-assisted verification hook only if the final architecture requires one. It must never allow a privileged actor to fabricate funds. Prefer direct on-chain payment state when practical.

`releaseOrder(uint256 orderId)`

Completes an eligible order atomically where practical:
- release token to immutable recipient;
- credit seller proceeds;
- credit marketplace fee;
- update inventory/accounting;
- mark order completed.

Reverts if:
- order not releasable;
- dispute active;
- insufficient secured assets;
- already terminal;
- accounting check fails.

### Refund / Dispute

`cancelOrder(uint256 orderId)`

Cancels only an eligible order according to the state machine.

`expireOrder(uint256 orderId)`

Triggers deterministic expiry after the configured deadline.

`openDispute(uint256 orderId, uint8 reasonCode)`

Opens a dispute for an eligible order and blocks conflicting settlement.

`resolveDispute(uint256 disputeId, Resolution resolution)`

Executes only a predefined resolution outcome under the dispute resolver's authorization.

`refundOrder(uint256 orderId)`

Returns the eligible payment to the immutable buyer address and marks the order refunded.

## 3. Seller Withdrawals

`withdrawClaimable(address paymentToken, uint256 amount)`

Withdraws seller's claimable proceeds to the registered withdrawal wallet.

Reverts if:
- caller is not registered seller;
- payment token unsupported;
- amount exceeds claimable balance;
- registered wallet is zero;
- withdrawal protection is active;
- protocol pause blocks withdrawal under the emergency matrix.

No arbitrary destination parameter is permitted in v1.

## 4. Treasury

`withdrawFees(address paymentToken, uint256 amount, address destination)`

Governance-controlled treasury operation only after fees are separated from user obligations. Exact destination policy must be finalized with governance design.

The function must not be callable by an operational seller/operator role.

## 5. Security / Governance

`pause(bytes32 scope)`

Narrowly scoped emergency pause. Scope must map to predefined operations.

`unpause(bytes32 scope)`

Authorized security/governance operation according to final emergency policy.

Critical configuration functions, such as fee bounds, payment-token allowlists, and contract references, should be controlled through AccessManager + Timelock according to the role matrix.

## 6. View Functions

The protocol should expose read-only functions for:

- seller information;
- registered withdrawal wallet;
- token registration and verification;
- listing information;
- available / locked inventory;
- order information;
- claimable seller balances;
- supported payment tokens;
- fee configuration;
- pause state;
- contract version.

Views must be sufficient for an independent frontend/indexer to reconstruct user-visible financial state without trusting a private database balance.

## 7. Events

Every state-changing financial operation must emit a corresponding event. Event identifiers should include order/listing/seller/token IDs as indexed fields where appropriate.

## 8. Revert Design

Use custom errors rather than long revert strings where practical. Errors should distinguish authorization, state, accounting, asset compatibility, limits, and governance failures.

Examples:

- `NotRegisteredSeller()`
- `Unauthorized()`
- `InvalidAddress()`
- `UnsupportedToken()`
- `UnsupportedPaymentToken()`
- `ListingNotActive()`
- `InvalidListingState()`
- `InvalidOrderState()`
- `InsufficientInventory()`
- `InsufficientPayment()`
- `InsufficientClaimable()`
- `RecipientImmutable()`
- `DisputeActive()`
- `NotExpired()`
- `WithdrawalLocked()`
- `AccountingInvariantViolation()`
- `Paused()`

## 9. Security Rules for API Design

1. No generic `transferUserAsset()` function.
2. No arbitrary buyer recipient parameter during normal settlement.
3. No arbitrary seller withdrawal destination.
4. No admin function that edits historical order price/recipient/state.
5. No database-only authorization.
6. No settlement function that can be called twice successfully.
7. No refund function that can be called twice successfully.
8. No privileged function that bypasses accounting invariants.

## 10. Implementation Gate

Before coding:

- Resolve whether Marketplace and Escrow are separate deployed contracts or a tightly coupled implementation.
- Resolve exact enum values.
- Resolve exact struct packing.
- Resolve refund fee treatment.
- Resolve expiry duration and permissionless maintenance.
- Resolve token compatibility policy.
- Resolve upgradeability choice.
- Resolve governance delays and emergency scopes.
- Resolve payment verification model.
