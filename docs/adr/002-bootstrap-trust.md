# ADR 002: bootstrap-trust

Status: accepted for local beta; integration claims require evidence.

Accept a local ZIP plus an independently obtained SHA-256; optionally verify an external Ed25519 manifest. Pin vendor URLs/hashes, use user-local dependencies and separate Oracle/elevation consent. Never silently use the author workspace or download during MCP startup. Remote unattended channels remain disabled until trusted publisher keys exist.
