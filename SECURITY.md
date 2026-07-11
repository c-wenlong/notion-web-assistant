# Security Policy

## Supported version

Security fixes are applied to the latest `main` branch during the beta period.

## Reporting a vulnerability

Please do not include credentials, integration secrets, API keys, database contents, or personal page text in a public issue.

For a suspected vulnerability, use GitHub's private security advisory flow for this repository when available. If that is not available, open a minimal public issue stating that you need a private reporting channel; do not include exploit details there.

## Handling credentials

Notion Web Clipper stores the Notion integration secret and AI keys in browser-local extension storage. Contributors must never log them, add them to fixtures, or commit them to the repository.
