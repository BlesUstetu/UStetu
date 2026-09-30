# UST Base Mainnet — Wallet Asset Submission

## Token identity

- Name: USTETU
- Symbol: UST
- Network: Base Mainnet
- Chain ID: 8453
- Contract: `0xdF9Fa2E56c97C91090E1bAe422e830E19A94c557`
- Decimals: 18
- Explorer: https://basescan.org/token/0xdF9Fa2E56c97C91090E1bAe422e830E19A94c557

## Trust Wallet target

`blockchains/base/assets/0xdF9Fa2E56c97C91090E1bAe422e830E19A94c557/`

Required files:

- `logo.png`
- `info.json`

Trust Wallet's current requirements specify checksum-format EVM contract folders and PNG logos; the logo is recommended at 256×256, maximum 512×512, with a maximum file size of 100 kB.

The canonical USTETU logo source in this repository is:

`frontend/public/ustetu-logo.svg`

The Trust Wallet submission itself remains subject to Trust Wallet's review and listing requirements. This preparation does not guarantee approval or automatic display in every wallet.

## Wallet strategy

USTETU does not require users to manually import UST. Wallet-specific automatic discovery depends on each wallet's own token metadata/indexing system. The dApp therefore treats wallet asset registration as an ecosystem-distribution task rather than a mandatory user action.
