# UStetu Multi-Chain Architecture v1.0

## 1. Principle

UStetu is multi-chain at the application level, but each blockchain deployment is an independent settlement domain unless a future cross-chain protocol is explicitly introduced.

For v1, an order exists on exactly one chain.

## 2. Chain Identity

Every asset and payment is identified by:

`chainId + contractAddress`

Examples:

```text
Base + USDC contract
Ethereum + USDC contract
BNB Chain + USDT contract
```

The same symbol on two networks is not treated as the same on-chain asset.

## 3. Initial Deployment Strategy

Recommended staged rollout:

### Phase 1

- Base

### Phase 2

- Ethereum
- BNB Chain

### Phase 3

Additional EVM-compatible networks only after security and operational review.

The architecture remains generic so additional networks can be added without changing the conceptual order model.

## 4. Per-Chain Deployment

Each chain has its own deployed instances/configuration of:

- UStetuMarketplace
- UStetuEscrow
- UStetuRegistry
- UStetuTreasury
- Governance/security references as required

A deployment registry records the verified contract addresses for each supported chain.

## 5. Payment Token Registry

Each network maintains its own explicit payment-token allowlist.

Example concept:

```text
Base
 ├── USDC → verified contract
 └── USDT → verified contract if supported

Ethereum
 ├── USDC → verified contract
 └── USDT → verified contract

BNB Chain
 └── USDT → verified contract
```

The symbol alone is never sufficient.

## 6. Token Registry

A seller listing on Base cannot be purchased through an Ethereum settlement contract merely because the token has the same symbol/address representation.

Token identity always includes the chain.

## 7. Order Chain Lock

When an order is created, the following are chain-bound:

- Listing chain.
- Token contract.
- Payment token contract.
- Buyer wallet.
- Seller wallet.
- Recipient wallet.
- Execution price.
- Token amount.

An order cannot migrate between chains.

## 8. Cross-Chain UX

The frontend must clearly display:

- Network name.
- Network icon.
- Token contract.
- Payment token contract.
- Wallet network status.

If the connected wallet is on the wrong network:

```text
Wrong Network

This listing is on Base.
Your wallet is on Ethereum.

[ SWITCH TO BASE ]
```

The UI must not silently switch networks.

## 9. Cross-Chain Settlement

There is no cross-chain settlement in v1.

For example:

```text
Buyer on Base
Seller listing on Base
Payment on Base
Token delivery on Base
```

All settlement remains inside the same chain.

## 10. Future Cross-Chain Expansion

A future cross-chain feature may use a bridge, messaging layer, or cross-chain settlement protocol, but it must be designed as a separate security boundary.

It must not be added by simply allowing a contract to accept arbitrary chain identifiers from the frontend.

Future cross-chain architecture would require:

- Message authenticity.
- Replay protection.
- Nonce management.
- Finality assumptions.
- Bridge risk model.
- Chain reorganization handling.
- Failure recovery.
- Liquidity / inventory synchronization.

## 11. Deployment Registry

The application should maintain a versioned deployment registry containing:

- Chain ID.
- Network name.
- Marketplace address.
- Escrow address.
- Registry address.
- Treasury address.
- Governance references.
- Supported payment token addresses.
- Deployment version.
- Deployment block.
- Verification status.

The registry must be auditable and should not be silently changed by the frontend.

## 12. Contract Address Verification

Frontend configuration must be validated against a trusted deployment registry.

Users should be able to inspect:

- Contract address.
- Network.
- Contract version.
- Source verification status.

A frontend must not accept a contract address from an arbitrary remote response as trusted merely because it is syntactically valid.

## 13. Chain Finality

The indexer must account for chain-specific confirmation/finality behavior.

A transaction should not be presented as permanently finalized until the configured confirmation/finality policy is satisfied.

The backend must handle:

- Reorganizations.
- Duplicate event observations.
- Temporary RPC inconsistencies.
- Delayed indexing.

## 14. Chain-Specific Limits

Each deployment may define chain-specific:

- Gas policy.
- Order limits.
- Withdrawal limits.
- Token compatibility restrictions.
- Confirmation requirements.
- Emergency controls.

These differences must be explicit and versioned.

## 15. Multi-Chain Security Rules

1. Never identify a token by symbol alone.
2. Never identify payment assets by symbol alone.
3. Never execute an order on a chain different from its creation chain.
4. Never trust frontend network selection as a security boundary.
5. Never assume equal contract addresses represent equal assets across chains.
6. Never introduce cross-chain settlement without a separate threat model.
7. Never allow an off-chain database to reconcile cross-chain balances as if they were one balance without explicit accounting.

## 16. Multi-Chain Dashboard

The user dashboard may aggregate activity across networks, but each transaction card must show its network.

Example:

```text
ORDER #1024
DNA
Base
Completed

ORDER #1025
USDT
BNB Chain
Refunded
```

Aggregated totals must retain network-level accounting underneath.

## 17. Implementation Gate

Before deploying each new chain, finalize:

- Official token contract addresses.
- Deployment addresses.
- Governance/security configuration.
- Chain finality policy.
- RPC/indexing infrastructure.
- Token compatibility rules.
- Monitoring rules.
- Emergency response plan.
- Testnet validation.
- Independent review for material chain-specific differences.
