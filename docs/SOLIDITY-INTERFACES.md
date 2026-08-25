# UStetu Solidity Interfaces & Contract Layout v1.0

## 1. Repository Layout

```text
contracts/
├── core/
│   ├── UStetuMarketplace.sol
│   ├── UStetuEscrow.sol
│   ├── UStetuRegistry.sol
│   └── UStetuTreasury.sol
├── interfaces/
│   ├── IUStetuMarketplace.sol
│   ├── IUStetuEscrow.sol
│   ├── IUStetuRegistry.sol
│   └── IUStetuTreasury.sol
├── libraries/
│   ├── UStetuTypes.sol
│   ├── UStetuErrors.sol
│   └── UStetuMath.sol
└── security/
    └── UStetuSecurity.sol

test/
├── unit/
├── integration/
├── fuzz/
└── invariant/
```

## 2. Solidity Version

Use Solidity 0.8.x with a pinned compiler version selected during implementation. Do not use floating compiler ranges for the production release.

## 3. External Dependencies

Preferred OpenZeppelin components, subject to final version pinning and audit review:

- SafeERC20
- ReentrancyGuard where appropriate
- AccessManager
- TimelockController or the final self-governed timelock design
- Pausable only where its semantics fit the granular pause model

Do not add a dependency merely for convenience. Every external dependency becomes part of the security review surface.

## 4. Shared Types

`UStetuTypes.sol` should define canonical enums and structs shared by interfaces.

Conceptual enums:

```solidity
enum ListingStatus { DRAFT, ACTIVE, PAUSED, CLOSED, SUSPENDED }
enum OrderState { CREATED, PAYMENT_PENDING, PAID, ESCROWED, RELEASABLE, COMPLETED, REFUNDED, CANCELLED, DISPUTED, EXPIRED }
enum VerificationStatus { UNREGISTERED, PENDING, APPROVED, REJECTED, SUSPENDED, DELISTED }
enum Resolution { RELEASE, REFUND }
```

Exact enum ordering must be frozen before deployment because numeric enum values can become persistent state.

## 5. IUStetuRegistry

Conceptual read API:

```solidity
function getToken(bytes32 tokenId) external view returns (Token memory);
function isApprovedToken(bytes32 tokenId) external view returns (bool);
function isSupportedPaymentToken(address token) external view returns (bool);
function getDeploymentChainId() external view returns (uint256);
```

Governed mutation functions are specified separately from public read interfaces.

## 6. IUStetuMarketplace

Conceptual public API:

```solidity
function registerSeller(address withdrawalWallet) external;
function requestWithdrawalWalletChange(address newWallet) external;
function finalizeWithdrawalWalletChange() external;

function registerToken(uint256 chainId, address token) external returns (bytes32 tokenId);

function createListing(
    bytes32 tokenId,
    address paymentToken,
    uint256 price,
    uint256 inventoryAmount,
    uint256 minOrderAmount,
    uint256 maxOrderAmount
) external returns (uint256 listingId);

function updateListingPrice(uint256 listingId, uint256 newPrice) external;
function updateListingLimits(uint256 listingId, uint256 minOrderAmount, uint256 maxOrderAmount) external;
function pauseListing(uint256 listingId) external;
function closeListing(uint256 listingId) external;
function withdrawListingInventory(uint256 listingId, uint256 amount) external;
```

## 7. IUStetuEscrow

Conceptual public API:

```solidity
function createOrder(uint256 listingId, uint256 tokenAmount) external returns (uint256 orderId);
function fundOrder(uint256 orderId) external;
function releaseOrder(uint256 orderId) external;
function cancelOrder(uint256 orderId) external;
function expireOrder(uint256 orderId) external;
function openDispute(uint256 orderId, uint8 reasonCode) external returns (uint256 disputeId);
function resolveDispute(uint256 disputeId, Resolution resolution) external;
function refundOrder(uint256 orderId) external;

function withdrawClaimable(address paymentToken, uint256 amount) external;
```

The final implementation may combine or split these responsibilities differently, but public behavior must remain consistent with the approved state machine.

## 8. View API

Required read-only information:

```solidity
function getSeller(address seller) external view returns (Seller memory);
function getListing(uint256 listingId) external view returns (Listing memory);
function getOrder(uint256 orderId) external view returns (Order memory);
function claimable(address paymentToken, address seller) external view returns (uint256);
function getDispute(uint256 disputeId) external view returns (Dispute memory);
```

Additional aggregate views may be added for frontend efficiency, but must not introduce a second source of financial truth.

## 9. Events

Events should be defined in interfaces or a dedicated event interface and emitted by the implementing contract.

Required categories:

- Seller lifecycle.
- Token verification.
- Listing lifecycle.
- Inventory movement.
- Order lifecycle.
- Payment.
- Settlement.
- Refund.
- Dispute.
- Withdrawal.
- Governance/security.

## 10. Custom Errors

Use custom errors in `UStetuErrors.sol` and keep them semantically precise.

Examples:

```solidity
error Unauthorized();
error InvalidAddress();
error UnsupportedToken();
error UnsupportedPaymentToken();
error InvalidListingState();
error InvalidOrderState();
error InsufficientInventory();
error InsufficientPayment();
error InsufficientClaimable();
error DisputeActive();
error NotExpired();
error WithdrawalLocked();
error AccountingInvariantViolation();
error Paused();
```

## 11. Library Responsibilities

### UStetuTypes

Canonical structs/enums.

### UStetuErrors

Shared custom errors.

### UStetuMath

Fee calculation, safe bounded arithmetic helpers, and deterministic rounding rules once finalized.

No library should contain hidden privileged behavior.

## 12. Contract Coupling

The preferred initial separation is:

`Marketplace → Escrow`

with Registry and Treasury referenced through explicit interfaces.

The contracts must avoid circular authority where one contract can silently bypass another's invariants.

## 13. External Call Rules

Every external token call must be reviewed for:

- Reentrancy.
- Return-value handling.
- State ordering.
- Malicious token behavior.
- Gas griefing where relevant.

## 14. No Production Deployment Yet

This document defines interfaces and layout. It does not authorize deployment.

Before implementation is considered production-ready:

1. Freeze types.
2. Freeze state machine.
3. Freeze accounting.
4. Implement.
5. Compile with pinned compiler.
6. Run unit tests.
7. Run fuzz tests.
8. Run invariant tests.
9. Run static/security analysis.
10. Test on testnet.
11. Perform independent audit.
12. Complete deployment checklist.
