# UStetu Multi-Chain Architecture — Future Design

> **Status: FUTURE DESIGN / NOT IMPLEMENTED IN V1**

UStetu V1 is Base Mainnet only (chain ID 8453) and does not perform cross-chain settlement.

## V1 Boundary

- Marketplace contracts run on Base Mainnet.
- Payment asset is Base native USDC.
- Token registration is scoped to the deployment chain.
- Orders settle entirely on Base.
- No bridge is a settlement authority.
- No cross-chain message is required for V1 completion.

## Future Architecture Topics

A future multi-chain release may require:

- separate contract deployments per EVM network
- chain-specific payment assets
- canonical token identity across deployments
- cross-chain discovery
- bridge/message trust assumptions
- replay protection
- finality differences
- chain halt/reorg handling
- migration and settlement reconciliation

Each future deployment must be reviewed against its actual contracts and chain configuration.

## Non-Goal

This document does not authorize adding multi-chain logic to V1 contracts.
