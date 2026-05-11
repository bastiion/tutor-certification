# Concept: Participation Certificate Service (Teilnahmebescheinigung)

## Context

A minimal hosted service for digitally signed participation certificates for online courses. An instructor drops a single time-limited link in the course chat. Any participant can visit the link during the valid window and self-issue a certificate. After the course, the institute audits the issued certificates (compare count to video call headcount) and revokes individually if fraud is detected. Third parties can verify any certificate — offline via cryptographic signature, online via a revocation endpoint.

**Design goal**: server is as close to stateless as possible. The tutor uses a local client for all sensitive operations. The server stores only what cannot be avoided.

**Tech stack**: unspecified. The institute does not own the server. This document is opinionated about cryptographic algorithms and flows only.

---

## Architecture: Local Client + Minimal Server

The key insight is to move all private key material and sensitive operations off the server and onto the tutor's local machine. The server becomes a signing proxy (using a temporary derived key), an email forwarder, and a revocation registry.

```
┌─────────────────────────┐
│   Tutor's Local Client  │  holds K_master_private
│   (desktop/CLI app)     │  derives K_course keys
│                         │  signs revocations
└────────────┬────────────┘
             │ pushes session credential + derived key (once per session)
             │ pushes signed revocation documents
             ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│   Minimal Server        │  email → │   Tutor's Inbox         │
│                         │          │   (audit log)           │
│  State:                 │          └─────────────────────────┘
│  - session keys (temp)  │
│  - revocations (perm)   │◄── GET /verify  ── Third Party
└─────────────────────────┘
```

**Server state — the minimum unavoidable:**
1. **Session keys** — one record per active session, deleted after `valid_until`
2. **Revocations** — permanent, tiny (`cert_id → revocation_doc`)

Certificates themselves are **not stored on the server**. They are delivered directly to the participant and emailed to the tutor. The server is not a certificate registry.

---

## Cryptographic Design

### Key Hierarchy

```
K_master  (Ed25519, long-lived, lives only on tutor's local client)
    └── derives → K_course  (Ed25519, per session, temporary on server)
                      └── signs → certificate payload
```

### Key Derivation: HKDF

K_course is deterministically derived from K_master using HKDF-SHA256:

```
K_course_private = HKDF-SHA256(
    ikm  = K_master_private_bytes,
    salt = 0x00…,
    info = "cert-course-key" ∥ course_id ∥ valid_until_unix_u64_be,
    length = 32
)
K_course_public = Ed25519_public_from_private(K_course_private)
```

**Properties:**
- Deterministic: given K_master + course_id + valid_until, the tutor can always re-derive K_course without storing it
- One-way: the server holding K_course_private cannot reverse-derive K_master_private
- Isolated: compromising one K_course reveals nothing about other sessions or K_master
- The derived key bakes in `valid_until`, so different time windows produce different keys — a leaked session key cannot be reused for a future session

### Session Credential

The local client constructs a session credential and pushes it to the server:

```json
{
  "course_id": "<uuid>",
  "valid_until": "<unix timestamp>",
  "course_title": "...",
  "course_date": "YYYY-MM-DD",
  "institute_name": "...",
  "K_course_public": "<base64url>",
  "K_master_public_fingerprint": "<BLAKE2b-256 hex of K_master_public>",
  "session_sig": "<base64url: sign(K_master_private, course_id ∥ valid_until ∥ K_course_public)>",
  "K_course_private_enc": "<base64url: encrypt(K_course_private, server_public_key)>"
}
```

`K_course_private_enc` is encrypted with the server's public key (X25519 key agreement + AES-GCM, or NaCl box) so only the server can decrypt it. The server stores the encrypted form; decrypts only at sign time; never logs the plaintext.

### Certificate Payload (JSON)

```json
{
  "cert_id": "<uuid-v4>",
  "version": 1,
  "issued_at": "<ISO 8601>",
  "course": {
    "id": "<uuid>",
    "title": "...",
    "date": "YYYY-MM-DD"
  },
  "participant": {
    "name": "..."
  },
  "institute": {
    "name": "...",
    "key_fingerprint": "<BLAKE2b-256 hex of K_master_public>"
  },
  "K_course_public": "<base64url>",
  "session_sig": "<base64url: sign(K_master, course_id ∥ valid_until ∥ K_course_public)>",
  "certificate_sig": "<base64url: sign(K_course_private, payload_without_certificate_sig)>"
}
```

The certificate embeds the full chain of trust:
- `session_sig` proves K_course was authorized by K_master for this session
- `certificate_sig` proves this specific certificate was issued during that session

### Signing Algorithm: Ed25519 + HKDF-SHA256

- Ed25519: 32-byte keys, 64-byte signatures, deterministic, no nonce attacks, widely supported (OpenSSL, libsodium, WebCrypto, GPG Ed25519 subkeys)
- HKDF-SHA256: standard key derivation (RFC 5869), available everywhere
- X25519 + AES-256-GCM (or NaCl box): for the K_course_private_enc transport
- **BLAKE2b-256 (libsodium `crypto_generichash` default output size)**:
  used for `K_master_public_fingerprint` / `institute.key_fingerprint`
  hex. Exposed cross-language as `masterPublicFingerprintHex` in
  `@bastiion/crypto` and `App\Crypto\Signer::masterPublicFingerprintHex`
  in the PHP API. **Not** SHA-256 — earlier drafts of this document
  said SHA-256 for the fingerprint; the BLAKE2b-256 choice was adopted
  during Stage 2 implementation and formally aligned here.

### Revocation Document

```json
{
  "cert_id": "<uuid>",
  "revoked_at": "<ISO 8601>",
  "reason": "...",
  "signature": "<base64url: sign(K_master_private, cert_id ∥ revoked_at)>"
}
```

Signed by the local client with K_master_private. The server only stores and serves it — the server never signs revocations. Self-contained and verifiable offline.

---

## Flow

### 1. One-Time Setup (local client)

- Generate K_master Ed25519 key pair on the tutor's machine
- Generate a server X25519 key pair on the server; export the public key
- Configure the local client with the server's public key
- Publish K_master_public at a stable URL

### 2. Session Creation (local client → server)

1. Local client creates `course_id` + `valid_until`
2. Derives K_course via HKDF
3. Signs the session credential with K_master
4. Encrypts K_course_private with server's X25519 public key
5. Pushes the session credential to the server: `POST /sessions`
6. Server validates session_sig (using K_master_public from the credential)
7. Server stores the session record (tiny)
8. Local client receives back a short enrollment URL

The enrollment link token encodes: `course_id ∥ valid_until ∥ HMAC(server_secret, course_id ∥ valid_until)`. It is self-verifying — the server checks expiry and HMAC without a DB lookup.

### 3. Certificate Self-Issuance (participant, during valid window)

Participant visits the link, enters their name (email optional).

Server:
1. Verifies token HMAC and expiry — stateless check
2. Decrypts K_course_private from the session record
3. Generates `cert_id` (UUID), builds payload
4. Signs with K_course_private
5. Returns certificate JSON to participant (download)
6. Emails the tutor: participant name, timestamp, certificate JSON attachment, revocation instructions
7. **Does not store the certificate**

### 4. Post-Course Audit (tutor)

The tutor's inbox is the audit log. Each issuance produced one email. The tutor compares:
- Email count vs. video call headcount
- Names + timestamps for plausibility

For convenience, the local client can parse the certificate attachments from the inbox and display a summary list.

### 5. Revocation (local client → server)

1. Tutor opens the local client, loads the certificate JSON (from the email attachment)
2. Client signs a revocation document with K_master_private
3. Client pushes it to the server: `POST /revocations`
4. Server verifies the revocation_sig (using K_master_public) and stores the record
5. Server does not sign anything — it only validates and stores

### 6. Verification (third party)

**Online:** `GET /verify/<cert_id>` returns `{ valid: true }` or `{ valid: false, revocation_doc }`.

**Offline (fully self-contained):**
1. Obtain certificate JSON (from participant or directly)
2. Obtain K_master_public (institute website; matches `key_fingerprint` in cert)
3. Verify `session_sig`: `verify(K_master_public, course_id ∥ valid_until ∥ K_course_public, session_sig)`
4. Verify `certificate_sig`: `verify(K_course_public, payload_without_cert_sig, certificate_sig)`
5. If revocation doc present: `verify(K_master_public, cert_id ∥ revoked_at, revocation_sig)`

A small standalone verifier (a single script using libsodium or OpenSSL) should be published alongside the service.

---

## Server State Summary

| Data | Lifetime | Size |
|------|----------|------|
| Session records (K_course_private_enc + metadata) | Until `valid_until`, then deletable | One row per session |
| Revocation documents | Permanent | One row per revoked cert |

The server has **no certificate storage**. All certificate content lives with participants and in the tutor's inbox. The server is a signing proxy + revocation registry.

---

## Key Rotation

When K_master is rotated (e.g. annually or after a key compromise):

1. New K_master_new is generated on the local client
2. A key transition document is published: `{ K_master_new_public, valid_from, signature: sign(K_master_old_private, K_master_new_public ∥ valid_from) }`
3. Old certificates remain valid — they still chain to K_master_old_public, which is still published
4. New sessions use K_master_new

This is the same model used by PGP key transitions.

---

## Service API Surface

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/sessions` | Local client (bearer) | Push session credential + encrypted K_course |
| GET  | `/enroll/:token` | Public | Show self-issue form |
| POST | `/enroll/:token` | Public | Issue certificate + send email |
| GET  | `/verify/:cert_id` | Public | Check validity / return revocation doc |
| POST | `/revocations` | Local client (bearer) | Push signed revocation document |

Total: 5 routes. The server never holds K_master_private and never originates a revocation signature.

---

## Out of Scope (v1)

- Multiple tutors / multi-tenancy
- Certificate PDF rendering
- Automated fraud detection
- Local client UI (CLI is sufficient for v1)
