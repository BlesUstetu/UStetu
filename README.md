# UStetu

## Own What's Next.

UStetu is a **non-custodial, permissionless Web3 P2P marketplace** for token listings and on-chain escrow settlement.

V1 is intentionally focused on **Base Mainnet** with a deterministic payment asset, immutable marketplace fee, seller-controlled listings, and no platform admin/owner authority.

> **V1 status: pre-mainnet. Contracts have not been deployed to Base Mainnet yet.**

## Security Audit Status

### Audit Conclusion

**USTETU V1 Core Protocol — PASS.**

The completed security review established the audited protocol baseline for the core marketplace contracts and critical transaction flows. This baseline is now **LOCKED** and is the source of truth for frontend development.

> **Audit is the source of truth. Frontend follows the contract.**

### Audited Components

| Component / Flow | Result |
|---|---|
| UStetuRegistry | PASS |
| UStetuSellerRegistry | PASS |
| UStetuEscrow | PASS |
| Token registration | PASS |
| Seller registration | PASS |
| Listing lifecycle | PASS |
| Inventory accounting | PASS |
| createOrder | PASS |
| fundOrder | PASS |
| completeOrder | PASS |
| Order expiry / recovery | PASS |
| Permissionless auto-release | PASS |
| Seller claimable balance | PASS |
| Seller withdrawal wallet mechanism | PASS |
| Marketplace fee accounting | PASS |
| Access-control / authority model | PASS |
| Contract ABI and transaction parameters | LOCKED |
| Escrow state machine | LOCKED |
| Frontend transaction alignment | PASS |

### Security Areas Reviewed

The review covered:

- state transitions and order lifecycle
- authorization and access-control boundaries
- permissionless token registration
- seller self-registration
- seller-controlled listings
- inventory deposit and locking
- exact payment accounting
- exact token-delivery accounting
- order expiry
- order recovery
- permissionless auto-release
- seller claimable proceeds
- withdrawal accounting
- withdrawal-wallet change protection
- reentrancy protection
- immutable protocol configuration
- fixed marketplace fee
- frontend-to-contract transaction alignment

### Core Security Properties

USTETU V1 intentionally has no:

- platform owner
- centralized admin authority
- token approval authority
- seller approval authority
- fee setter
- payment-token setter
- registry setter
- upgrade administrator
- proxy upgrade path
- privileged token seizure mechanism

The user's wallet is the authority for user-controlled actions.

### Escrow State Machine

The audited order lifecycle is:

PAYMENT_PENDING
  -> fundOrder() -> PAID
  -> completeOrder() -> COMPLETED
  -> permissionless auto-release -> COMPLETED
  -> expireOrder() -> EXPIRED

The frontend must follow these on-chain states and must not create a separate application-level state machine.

### Settlement Accounting

USTETU V1 uses:

- OpenZeppelin SafeERC20
- ReentrancyGuard
- exact payment-received checks
- exact token-delivery checks
- locked-inventory accounting
- explicit state transitions
- immutable 1% marketplace fee
- claimable seller proceeds

Available inventory is derived as:

inventoryDeposited - inventoryLocked

The indexer is discovery-only. On-chain Registry and Escrow state are authoritative.

### Token Trust Boundary

Token registration is permissionless.

**Registered does not mean verified, audited, endorsed, or safe.**

A registered ERC-20 can still contain transfer fees, rebasing, blacklist restrictions, upgradeable logic, or other custom behavior. USTETU protects its defined settlement invariants but does not certify arbitrary token contracts.

---

## Audit-Locked Items

The following protocol behavior is locked after the completed audit:

1. UStetuRegistry behavior
2. UStetuSellerRegistry behavior
3. UStetuEscrow behavior
4. createOrder
5. fundOrder
6. completeOrder
7. Escrow state machine
8. seller registration
9. listing lifecycle
10. inventory accounting
11. seller withdrawal-wallet mechanism
12. order recovery behavior
13. contract ABI and transaction parameters
14. authority and access-control model
15. permissionless token registration
16. wallet-based user authority
17. no public Admin UI

Any change to these items requires a new explicit protocol review and security review.

---

## USTETU Token Audit

The native USTETU token was reviewed separately from the locked marketplace protocol.

### Token Security Result

**USTETU Token — PASS**

Token properties:

| Property | Result |
|---|---|
| Name | USTETU |
| Symbol | UST |
| Network | Base Mainnet |
| Decimals | 18 |
| Fixed supply | 88,000,000 UST |
| Public mint | None |
| Transfer tax | None |
| Blacklist | None |
| Pause | None |
| Upgradeability | None |
| Owner / Admin | None |
| Public burn function | None |

The dedicated token test suite passed **7/7 tests**, covering fixed supply, deployer allocation, metadata, transfer behavior, transferFrom behavior, allowance enforcement, balance protection, exact transfer amounts, and total-supply preservation.

### Deployed USTETU Token

Contract:

0xdF9Fa2E56c97C91090E1bAe422e830E19A94c557

Deployment transaction:

0x0ed9e8d688fa125cdffe7b49fc1b5dbfbe2e25aacae714793b42d380b68693bf

The token source was successfully verified with Solidity 0.8.30, optimization enabled, runs 200, MIT license, and no constructor arguments.

---

## BaseScan Verification Status

The USTETU token has completed:

- source-code verification
- creator/ownership verification
- Token Information submission

BaseScan review ticket:

**#851349**

Current stage:

**Submitted — awaiting BaseScan review.**

Token metadata submission is an off-chain explorer process and does not change the deployed token contract.

---

## Frontend Security Alignment

The active frontend is the Next.js application under frontend/.

The frontend follows the audited contract behavior.

The buyer flow is:

Create Order
→ USDC Approval
→ Fund Escrow
→ Complete Order

Transaction progress, recovery, and UI states are presentation/recovery layers around the on-chain state machine. They do not alter contract behavior.

The frontend validates indexer-discovered listings against Registry and Escrow state before presenting them as live marketplace listings.

---


## V1 at a Glance

| Item | UStetu V1 |
|---|---|
| Network | **Base Mainnet** |
| Chain ID | **8453** |
| Payment asset | **Native Circle USDC on Base** |
| Payment token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Marketplace fee | **1% (100 bps)** |
| Custody model | **Non-custodial** |
| Admin / Owner | **None** |
| Upgradeability | **None** |
| Seller registration | Permissionless, self-registration |
| Token registration | Permissionless |
| Token identity | `chainId + contractAddress` |
| Listing control | Seller-controlled |
| Payment window | **15 minutes** |
| Auto-release | **24 hours after payment** |
| Withdrawal wallet change | **24-hour delay** |
| Dispute system | **Not part of V1** |
| Cross-chain settlement | **Not part of V1** |

Native Base USDC is issued by Circle and uses the address shown above; UStetu V1 pins this payment asset in the Registry and Escrow deployment. See Circle's official Base USDC documentation for the distinction between native USDC and legacy bridged USDbC.

## Product Model

UStetu V1 separates **token registration**, **seller registration**, **listing**, and **escrow settlement**.

### 1. Token registration

Any user can register an ERC-20 token contract on Base Mainnet.

Registration records:

- Chain ID
- Token contract address
- Decimals snapshot
- Registering wallet
- Registration timestamp

**Registered does not mean verified, audited, endorsed, or safe.**

UStetu V1 deliberately does not introduce an admin approval or verification authority.

### 2. Seller registration

A seller registers their own wallet directly on-chain.

There is no:

- admin approval
- seller verification role
- reputation authority
- seller suspension authority

The seller controls their listings and withdrawal-wallet configuration.

### 3. Listing

A registered seller creates a listing by depositing the listed ERC-20 token into Escrow.

Each listing records:

- Token ID
- Seller
- Unit price in the immutable payment token
- Deposited inventory
- Locked inventory
- Minimum order
- Maximum order
- Listing status

Available inventory is derived from:

`inventoryDeposited - inventoryLocked`

### 4. Escrow order

The V1 order lifecycle is:

```text
PAYMENT_PENDING
       |
       +---- fundOrder() ----> PAID
       |                         |
       |                         +---- completeOrder() ----> COMPLETED
       |                         |
       |                         +---- autoReleaseOrder() -> COMPLETED
       |
       +---- expireOrder() ----> EXPIRED
```

- Orders have a **15-minute payment window**.
- Once paid, the buyer can complete the order.
- After **24 hours**, anyone can call the permissionless auto-release function.
- An expired unpaid order releases its locked inventory.
- Completed orders create claimable payment balances for the seller and marketplace fee recipient.

V1 does not implement a dispute or refund authority. The smart contract enforces the defined state machine rather than relying on a platform operator.

## Security Architecture

UStetu V1 is intentionally built without centralized control.

### No platform admin

There is no:

- `owner`
- `AccessControl`
- `onlyOwner`
- verifier role
- token approval authority
- seller approval authority
- fee setter
- payment-token setter
- registry setter
- upgrade administrator
- proxy upgrade path
- privileged token seizure mechanism

The core contracts use immutable/deterministic configuration where protocol configuration is required.

### Accounting protections

The Escrow implementation includes:

- OpenZeppelin `SafeERC20`
- `ReentrancyGuard`
- exact payment-received checks
- exact token-delivery checks
- explicit order state transitions
- locked-inventory accounting
- immutable 1% fee
- claimable withdrawal accounting
- seller withdrawal-wallet protection
- 24-hour withdrawal-wallet change delay

The test suite also covers fee-on-transfer behavior to ensure settlement does not silently complete when the recipient receives less than the ordered token amount.

### Important token-trust limitation

Because token registration is permissionless, registration is **not a security audit of the token**.

ERC-20 contracts may have custom behavior such as:

- transfer fees
- rebasing
- blacklist or transfer restrictions
- upgradeable token logic
- unusual balance mechanics

UStetu's exact transfer checks protect important settlement invariants, but they cannot prove that an arbitrary ERC-20 is economically or technically safe.

Users should independently evaluate the token contract before trading.

## Payment Asset

V1 uses one deterministic payment asset:

```text
Network:      Base Mainnet
Chain ID:     8453
Asset:        Native USDC
Address:      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Decimals:     6
```

The payment asset cannot be changed through a platform admin function.

This is intentional: V1 does not maintain an administrator-controlled payment-token whitelist.

## Fee Model

UStetu V1 uses a fixed marketplace fee:

```text
FEE_BPS = 100
BPS_DENOMINATOR = 10,000
Effective fee = 1%
```

For a successful settlement:

```text
Gross payment
├── 99% → seller claimable balance
└──  1% → marketplace fee claimable balance
```

The fee is calculated on-chain and cannot be changed after deployment.

## Repository Structure

```text
UStetu/
├── README.md
├── SECURITY.md
├── docs/
│   ├── BLUEPRINT.md
│   ├── CONTRACT-API-SPEC.md
│   ├── CONTRACT-ARCHITECTURE.md
│   ├── DATA-STRUCTURES.md
│   ├── ESCROW-SETTLEMENT-SPEC.md
│   ├── LISTING-INDEXER.md
│   ├── MULTI-CHAIN-ARCHITECTURE.md
│   ├── ORDER-STATE-MACHINE.md
│   ├── PAYMENT-REFUND-SPEC.md
│   ├── SECURITY-INVARIANTS.md
│   ├── SOLIDITY-INTERFACES.md
│   ├── STORAGE-LAYOUT-AND-FEE-MATH.md
│   ├── THREAT-MODEL.md
│   └── TOKEN-LISTING-SPEC.md
├── contracts/
│   ├── core/
│   ├── deploy/
│   ├── interfaces/
│   └── libraries/
├── script/
├── test/
├── backend/
└── frontend/
```

The documentation under `docs/` contains design/specification material; the Solidity contracts and tests are the source of truth for deployed protocol behavior.

## Smart Contracts

The V1 core consists of:

### `UStetuRegistry`

Responsible for:

- Base Mainnet chain enforcement
- immutable payment-token selection
- permissionless token registration
- token identity generation
- decimals snapshot

### `UStetuSellerRegistry`

Responsible for:

- seller self-registration
- withdrawal-wallet configuration
- 24-hour withdrawal-wallet change delay

### `UStetuEscrow`

Responsible for:

- listing creation and inventory deposits
- inventory management
- order creation
- payment escrow
- settlement
- auto-release
- order expiry
- claimable seller proceeds
- marketplace fee accounting
- withdrawals

## Frontend

The active frontend is the Next.js application under `frontend/`.

The marketplace reads live listing data from the indexer API and enriches it from the on-chain Registry and Escrow contracts.

The seller dashboard supports:

- seller registration
- token registration validation
- listing creation
- inventory deposit
- inventory withdrawal
- price updates
- order-limit updates
- listing pause/resume/close
- claimable proceeds withdrawal
- withdrawal-wallet changes

The buyer flow supports:

- Base Mainnet network enforcement
- order creation
- USDC approval
- escrow funding
- order completion
- on-chain order recovery
- transaction links to BaseScan

## Backend / Indexer

The backend indexes confirmed UStetu Escrow events and exposes marketplace listing data for the frontend.

Production configuration includes:

```env
RPC_URL=https://mainnet.base.org
CHAIN_ID=8453
REGISTRY_ADDRESS=<deployed-registry-address>
ESCROW_ADDRESS=<deployed-escrow-address>
CONFIRMATIONS=12
START_BLOCK=<deployment-block>
SUPABASE_URL=<production-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<production-secret>
CORS_ORIGIN=<production-frontend-origin>
```

Do not commit production credentials or private keys.

## Local Development

### Solidity

The contracts use Foundry with Solidity `0.8.30`.

Typical commands:

```bash
forge build
forge test
forge fmt --check
```

The Foundry configuration targets Base Mainnet for the V1 deployment profile.

### Backend

```bash
cd backend
npm install
npm run typecheck
npm run build
```

### Frontend

```bash
cd frontend
npm install
npm run typecheck
npm run build
```

See the corresponding `.env.example` files for environment configuration.

## Mainnet Deployment Status

**Core USTETU V1 marketplace contracts: audited and deployment-controlled.**

The core marketplace audit is complete and locked. The deployed USTETU token is separate from the marketplace core and is already deployed on Base Mainnet.

Before deployment:

1. Complete the final source and test review.
2. Complete an independent security review where available.
3. Prepare the production deployer wallet and gas.
4. Set the immutable `USTETU_FEE_RECIPIENT`.
5. Deploy:
   - `UStetuRegistry`
   - `UStetuSellerRegistry`
   - `UStetuEscrow`
6. Record the deployment transaction hashes and deployment block.
7. Verify the contracts on BaseScan.
8. Configure backend and frontend with the real contract addresses.
9. Start the indexer from the deployment block with the required confirmation depth.
10. Run a controlled Base Mainnet smoke test before opening the marketplace publicly.

**No production contract addresses should be invented or copied into the repository before the actual deployment.**

## Testing Status

The V1 repository includes unit and integration-style Foundry tests for:

- Registry behavior
- Seller registration
- Listing and inventory accounting
- Order state transitions
- Exact payment accounting
- Exact token delivery
- Fee accounting
- Claimable withdrawals
- Withdrawal-wallet delay
- Permissionless auto-release
- Order expiry
- Fee-on-transfer settlement regression cases

Frontend and backend CI also validate type checking and production builds.

## V1 Design Boundaries

The following are intentionally outside V1:

- Multi-chain deployment
- Cross-chain settlement
- Non-EVM settlement
- Admin governance
- Upgradeability
- Platform-controlled token verification
- Seller reputation as a settlement authority
- Dispute arbitration
- AI-controlled trade execution

The multi-chain architecture may be developed later as separate deployments and/or protocol layers. V1 is deliberately constrained to Base Mainnet so the core settlement model can be hardened before expansion.

## Roadmap

### Phase 1 — V1 Hardening

- [x] Permissionless core architecture
- [x] Base Mainnet chain pin
- [x] Native Base USDC payment asset
- [x] Immutable 1% fee
- [x] Seller registry simplification
- [x] Exact settlement accounting
- [x] Inventory-locking model
- [x] Frontend/backend V1 alignment
- [x] CI validation
- [x] Protocol security audit completed
- [x] Audit baseline locked
- [x] USTETU token security review
- [x] USTETU token Base Mainnet deployment
- [x] USTETU token source verification
- [x] USTETU token ownership verification
- [ ] Core marketplace Base Mainnet deployment
- [ ] Core marketplace contract verification
- [ ] Mainnet smoke test
- [ ] Public production launch

### Phase 2 — Future Expansion

Potential future work may include:

- additional EVM network deployments
- cross-chain architecture
- additional settlement assets
- advanced market discovery
- analytics and risk tooling

Future features must not introduce centralized custody or undermine the V1 settlement invariants without an explicit protocol redesign.

## Security Reporting

Please review [SECURITY.md](SECURITY.md) before reporting a vulnerability.

Never publish private keys, seed phrases, API secrets, or production credentials in issues, pull requests, logs, or documentation.

## License

See the repository's license file when present.

---

**UStetu — Own What's Next.**
