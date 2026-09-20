# UStetu V1 Solidity Interfaces & Contract Layout

## Repository Contract Set

```text
contracts/
├── core/
│   ├── UStetuEscrow.sol
│   ├── UStetuRegistry.sol
│   └── UStetuSellerRegistry.sol
├── interfaces/
│   ├── IUStetuEscrow.sol
│   ├── IUStetuRegistry.sol
│   └── ...
└── libraries/
    ├── UStetuTypes.sol
    ├── UStetuErrors.sol
    └── UStetuMath.sol
```

## V1 Design

- Solidity compiler is pinned to 0.8.30.
- No upgradeable proxy.
- No AccessManager or Timelock.
- No governance/security role contract.
- OpenZeppelin `SafeERC20` and `ReentrancyGuard` are used where required.
- Base Mainnet chain ID is 8453.
- Payment token is immutable canonical Base USDC.

## Registry API

`registerToken(chainId, token)` is permissionless and stores a decimals snapshot.

## Seller Registry API

Seller registration and withdrawal-wallet change are self-service. The wallet-change activation is delayed by 24 hours.

## Escrow API

The escrow exposes listing, inventory, order, settlement, expiry, auto-release, and claimable-withdrawal operations.

## V1 State Enums

```solidity
enum ListingStatus { ACTIVE, PAUSED, CLOSED }
enum OrderState { PAYMENT_PENDING, PAID, COMPLETED, EXPIRED }
```

## Security Boundary

There is no privileged function that can:

- seize user assets
- change fees
- change payment token
- approve/reject tokens
- rewrite order state
- upgrade implementation
- resolve disputes

The actual Solidity source and generated ABI are authoritative.