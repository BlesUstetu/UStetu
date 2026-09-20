# UStetu V1 Contract API Specification

**Current implementation:** `UStetuRegistry`, `UStetuSellerRegistry`, `UStetuEscrow`.

## UStetuRegistry

- `registerToken(uint256 chainId, address token)`
- `getToken(bytes32 tokenId)`
- `isRegisteredToken(bytes32 tokenId)`
- `getPaymentToken()`
- `getDeploymentChainId()`
- `getTokenId(uint256,address)`

Registration is permissionless and scoped to Base Mainnet (8453).

## UStetuSellerRegistry

- `registerSeller(address withdrawalWallet)`
- `requestWithdrawalWalletChange(address newWallet)`
- `activateWithdrawalWalletChange()`

Seller registration is permissionless and self-owned. Withdrawal-wallet changes use a 24-hour delay.

## UStetuEscrow

Listing/inventory functions include:

- `createListingAndDeposit`
- `depositInventory`
- `withdrawInventory`
- `updateListingPrice`
- `updateListingOrderLimits`
- `pauseListing`
- `resumeListing`
- `closeListing`

Order functions include:

- `createOrder`
- `fundOrder`
- `completeOrder`
- `autoReleaseOrder`
- `expireOrder`

Views include:

- `paymentToken()`
- `getListing(uint256)`
- `getOrder(uint256)`
- `claimable(address,address)`

## V1 Boundaries

There are no admin, owner, upgrade, dispute, token-verifier, fee-setter, payment-token-setter, or governance functions.

The Solidity source and compiled ABI are authoritative over this summary.