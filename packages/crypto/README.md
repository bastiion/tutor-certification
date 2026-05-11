# `@ikwsd/crypto`

Shared cryptography for the tutor, participant, and verify SPAs (Ed25519 + HKDF‑SHA256 session seeds, NaCl sealed boxes, URL‑safe Base64 without padding).

## Install (workspace)

Declared as a workspace dependency:

```json
{ "dependencies": { "@ikwsd/crypto": "workspace:*" } }
```

From the repo root: `nix develop -c bun install`.

API details are documented with TSDoc on each export in `src/` (optional HTML: `bun run docs:crypto` from the repo root).
