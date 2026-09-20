# UStetu Token Registration & Listing Specification — V1

## 1. Token Identity

A token is identified by:

`tokenId = keccak256(abi.encode("USTETU_TOKEN_V1", chainId, tokenContract))`

V1 is deployed only on Base Mainnet (chain ID 8453).

## 2. Permissionless Registration

Any caller may register a token contract for the deployment chain.

The registry requires:

- correct chain ID
- non-zero address
- deployed contract code
- readable ERC-20 `decimals()`
- decimals within the protocol bound
- no duplicate registration

The registry snapshots decimals at registration.

## 3. Registered Does Not Mean Verified

A registered token is **not**:

- verified
- audited
- endorsed by UStetu
- guaranteed safe
- guaranteed liquid
- guaranteed legitimate

The frontend must not display a verification badge or imply approval.

Users should independently review the token contract and its risks.

## 4. Listing Requirements

To create a listing, the seller must:

1. Be registered in UStetuSellerRegistry.
2. Use a registered token.
3. Supply a valid price and order limits.
4. Deposit the requested inventory into escrow.
5. Pass the escrow's exact received-inventory accounting check.

The payment asset is not seller-selectable. V1 uses the immutable Base native USDC configured by the registry.

## 5. Listing State

V1 on-chain listing states are:

- `ACTIVE`
- `PAUSED`
- `CLOSED`

Availability is derived from:

`inventoryDeposited - inventoryLocked`

## 6. Token Risk

Permissionless registration means arbitrary ERC-20 behavior remains a protocol risk. Examples include:

- fee-on-transfer behavior
- rebasing
- blacklist/freeze restrictions
- upgradeable token logic
- custom transfer restrictions
- unusual balance mechanics

Settlement checks reduce accounting risk but do not certify economic or operational safety.

## 7. UI Requirements

The UI should show:

- network
- token contract
- name/symbol when readable
- registered status
- price
- available inventory
- payment asset
- marketplace fee
- relevant token-risk disclosure

Do not use terms such as “Verified Token” for V1 registration.

## 8. Cross-Chain Boundary

V1 does not support cross-chain settlement. A token registered on Base is a Base-local marketplace asset.

Future multi-chain architecture is documented separately and is not part of V1.
