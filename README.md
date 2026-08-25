# UStetu

## Own What's Next.

UStetu is a non-custodial, multi-seller, multi-token, multi-chain Web3 marketplace for emerging and pre-listing digital assets.

### Core Model

- Multi-seller marketplace
- Multi-token and multi-chain architecture
- USDC / USDT payment rails
- Non-custodial smart-contract escrow
- Automatic payment verification and settlement
- Seller claimable balances
- Buyer refund and dispute protection
- Marketplace fee: 1% of successful settlements
- Seller verification and trust badges
- Registered-wallet withdrawal protection
- Token contract address is mandatory for every listing
- Buyer and seller transaction dashboards
- Public security center
- Dark / light mode with a single theme toggle
- Smooth UStetu Fluid Motion UI
- Animated premium Web3 background

### Security Baseline

- No single-admin custody
- Multisig governance
- OpenZeppelin AccessManager
- Self-governed Timelock
- Security Council
- Granular emergency pause / circuit breaker
- SafeERC20 and ReentrancyGuard
- Strict order state machine
- Anti-double-release and replay protection
- Order and seller limits
- Exact settlement accounting
- Restricted emergency recovery
- Contract versioning and migration safety
- No hidden backdoors
- Formal threat model
- Unit, integration, fuzz, and invariant testing
- External security audit before mainnet

### v1 Scope

AI is intentionally excluded from v1. AI may be considered later as a separate risk-analysis layer without becoming the authority for asset transfers.

### Initial Example

The first reference listing is DNA on Base. The marketplace architecture remains generic and is not limited to DNA.

### Repository Structure

```text
ustetu/
├── README.md
├── SECURITY.md
├── docs/
│   ├── BLUEPRINT.md
│   ├── ARCHITECTURE.md
│   ├── SECURITY-ARCHITECTURE.md
│   ├── USER-FLOW.md
│   ├── TOKEN-LISTING.md
│   ├── ESCROW-FLOW.md
│   └── ROADMAP.md
├── contracts/
├── frontend/
├── backend/
└── tests/
```
