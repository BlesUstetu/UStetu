# UStetu Security Policy

## Security Philosophy

UStetu is designed around non-custodial smart-contract enforcement. Private keys and seed phrases must never be requested by the application.

## Reporting Vulnerabilities

Do not publicly disclose an unpatched vulnerability. Security reports should include a clear description, affected component, reproduction steps, impact assessment, and any relevant transaction or contract references.

## Security Requirements

- Never commit private keys, seed phrases, API secrets, or production credentials.
- Never treat frontend validation as a security boundary.
- Validate critical state transitions in smart contracts.
- Use SafeERC20 for ERC-20 transfers.
- Protect against reentrancy and double settlement.
- Enforce explicit order state transitions.
- Protect privileged actions with appropriate governance controls.
- Use multisig and timelock controls for critical administration.
- Test with unit, integration, fuzz, and invariant suites.
- Complete external security review before mainnet deployment.

## Disclosure Principle

Public documentation explains the security architecture and user protections. Sensitive implementation details that could materially increase exploitability are not published before appropriate mitigation.
