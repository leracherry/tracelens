# Security policy

## Supported versions

Security fixes target the latest published release (currently the 0.4.x line). Older release lines do not receive promised backports. Upgrade to the latest patch before checking whether an issue remains present.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/leracherry/tracelens/security/advisories/new). Do not open a public issue or pull request containing exploit details or sensitive telemetry. If that channel is unavailable, email the maintainer at valeriia.radchenko.dev@gmail.com with the subject “TraceLens security report”.

Include the affected package and version, impact, reproduction steps, and a minimal synthetic example. Do not send credentials, production traces, or private source maps. Coordinate disclosure with the maintainer before publishing details. This is a community-maintained project; no response-time or fix-time SLA is offered.

## Deployment boundaries

Studio is an unauthenticated local development collector, not a production ingestion service. Keep it bound to loopback and do not expose it to untrusted networks. Review telemetry names, metadata, and URL paths for sensitive content: default redaction does not guarantee anonymization. Treat source maps and exported traces as potentially sensitive. See the [privacy guide](docs/guides/privacy.md) and [publishing guide](docs/guides/publishing.md) for data handling and registry configuration.
