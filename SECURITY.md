# UStetu Security Policy

## Security Philosophy

UStetu V1 is designed around **non-custodial, permissionless smart-contract enforcement**.

The V1 protocol is intentionally deployed without a platform admin, owner, verifier, upgrade administrator, or centralized custody authority. Critical settlement rules are enforced by immutable/deterministic smart-contract logic.

Private keys, seed phrases, wallet recovery phrases, and production credentials must never be requested by the UStetu application.

## V1 Security Model

UStetu V1 currently targets **Base Mainnet (chain ID 8453)**.

The V1 security model includes:

- no `owner` authority
- no `AccessControl` administrator
- no seller approval authority
- no token verification authority
- no fee setter
- no payment-token setter
- no registry setter
- no proxy upgrade path
- no privileged token seizure mechanism
- permissionless seller registration
- permissionless token registration
- immutable payment asset selection
- immutable 1% marketplace fee
- explicit order state transitions
- permissionless order expiry and auto-release

This means there is deliberately no emergency administrator who can override the V1 settlement rules. Users and integrators should understand this trade-off before interacting with the protocol.

## Smart-Contract Security Controls

The Escrow implementation uses established OpenZeppelin components including:

- `SafeERC20` for ERC-20 operations
- `ReentrancyGuard` for reentrancy protection

It also enforces application-specific accounting and state invariants:

- exact payment-received checks
- exact token-delivery checks
- inventory locking
- inventory release on expiry
- claimable seller proceeds
- claimable marketplace fees
- explicit order-state validation
- seller withdrawal-wallet protection
- 24-hour withdrawal-wallet change delay
- immutable 1% fee calculation
- deterministic Base Mainnet payment-token configuration

OpenZeppelin documents `SafeERC20` as a wrapper for ERC-20 operations that handles tokens with and without boolean return values, and documents `ReentrancyGuard` as protection against nested reentrant calls. See the official OpenZeppelin Contracts documentation for implementation details.

## Token Trust Model

UStetu token registration is permissionless.

**Registration does not mean verification, audit, endorsement, or safety.**

A registered token can still contain arbitrary token-level behavior, including:

- transfer fees
- rebasing
- blacklist or transfer restrictions
- upgradeable token logic
- unusual balance mechanics
- other custom ERC-20 behavior

UStetu performs important settlement checks, but it cannot generally prove that an arbitrary ERC-20 token is economically or technically safe.

Users should independently review the token contract and understand its risks before trading.

## Payment Asset

V1 uses one deterministic payment asset:

```text
Network:      Base Mainnet
Chain ID:     8453
Asset:        Native USDC
Address:      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Decimals:     6
```

The payment asset is not selected by a platform administrator. The V1 Registry requires the Base Mainnet chain and canonical Base USDC configuration.

## Order Security

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

The protocol enforces:

- a 15-minute payment window
- no funding of an expired order
- no completion before payment
- no duplicate completion
- inventory locking while an order is pending/paid
- inventory release when an unpaid order expires
- claimable settlement accounting after completion

## Accounting Security

For a successful settlement:

```text
Gross payment
├── 99% → seller claimable balance
└──  1% → marketplace fee claimable balance
```

The protocol checks actual token balances around important transfers rather than assuming that a requested ERC-20 transfer amount was necessarily received.

This is particularly relevant for non-standard ERC-20 implementations such as fee-on-transfer tokens.

## Withdrawal Security

Seller proceeds are claimable rather than automatically forwarded during settlement.

The seller's withdrawal destination is controlled through the seller registry.

Changing the withdrawal wallet uses a **24-hour delay** before the new wallet becomes effective.

This is intended to reduce the impact of an accidental or compromised withdrawal-wallet change.

## No Centralized Recovery

Because V1 has no admin or upgrade authority:

- UStetu cannot arbitrarily pause the protocol.
- UStetu cannot replace the payment token after deployment.
- UStetu cannot upgrade the Escrow implementation.
- UStetu cannot seize user inventory through an admin function.
- UStetu cannot override an order state through an admin function.
- UStetu cannot approve or reject a token through a privileged registry role.

This is a deliberate trust-minimization property and also means users must understand that protocol-level recovery cannot be provided through a centralized administrator.

## Testing and Review

The repository includes automated testing for core V1 behavior, including:

- registry behavior
- seller registration
- listing and inventory accounting
- order state transitions
- exact payment accounting
- exact token delivery
- fee accounting
- claimable withdrawals
- withdrawal-wallet delay
- permissionless auto-release
- order expiry
- fee-on-transfer settlement regression cases

CI validates the Solidity, backend, and frontend projects.

The repository's internal pre-mainnet review is not a substitute for an independent security audit. Before public mainnet launch, an independent security review should be completed where practical.

## Responsible Disclosure

Do not publicly disclose an unpatched vulnerability.

A security report should include:

1. A clear description of the vulnerability.
2. The affected contract, component, or deployment.
3. Reproduction steps or a minimal proof of concept where safe.
4. The expected versus actual behavior.
5. Impact assessment.
6. Relevant transaction hashes, contract addresses, or logs when applicable.
7. Any suggested mitigation, if known.

Until a vulnerability is mitigated, avoid publishing exploit details that could put user funds at risk.

## Secrets and Credentials

Never commit:

- private keys
- seed phrases
- wallet recovery phrases
- API keys
- Supabase service-role keys
- RPC provider secrets
- deployment credentials
- production environment files containing secrets

Use environment variables or an appropriate secret-management system for deployment and backend credentials.

## Scope

This policy describes the current **UStetu V1** architecture.

It does not grant security guarantees for:

- third-party ERC-20 tokens
- wallets or browser extensions
- RPC providers
- Base network availability
- Supabase or other infrastructure
- frontend hosting providers
- third-party indexers
- external bridges
- future multi-chain deployments
- future protocol versions

Security properties of future versions must be reviewed against their actual deployed code and configuration.

---

**UStetu — Own What's Next.**
