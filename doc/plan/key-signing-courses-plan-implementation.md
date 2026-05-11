# Implementation Plan: Participation Certificate Service

## Context

Extending the existing Bun/React print-tool into a full service with:
- PHP backend API (hosted on a WordPress/Apache server the institute does not own)
- Time-limited enrollment links, Ed25519-signed certificates with per-session derived keys
- Client-side PDF+QR generation (no server-side rendering)
- Tutor operations (session creation, revocation) run in the browser using WebCrypto / libsodium — K_master_private never leaves the tutor's machine
- Revocation registry is the only permanent server state

---

## Monorepo Structure

Bun workspaces with three separate SPAs and one shared crypto package. The existing `src/` is migrated into `apps/tutor/`.

```
/
├── apps/
│   ├── tutor/                      # SPA: tutor dashboard
│   │   ├── package.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx             # migrated + extended from root src/
│   │       ├── crypto/tutor.ts     # K_master ops: HKDF, sign, key import
│   │       └── pages/
│   │           ├── CourseList.tsx
│   │           ├── CreateSession.tsx
│   │           └── AuditList.tsx   # issued cert list + revoke button
│   ├── participant/                # SPA: enrollment + certificate display
│   │   ├── package.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       └── pages/
│   │           ├── EnrollForm.tsx  # name input, submits to API
│   │           ├── CertView.tsx    # display + QR + print + download JSON
│   │           └── Expired.tsx     # shown when token is gone/expired
│   └── verify/                    # SPA: third-party verification
│       ├── package.json
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           └── pages/
│               └── VerifyResult.tsx
├── packages/
│   └── crypto/                    # shared workspace: libsodium helpers
│       ├── package.json           # name: @ikwsd/crypto
│       └── src/index.ts           # sign, verify, hkdf, base64url utils
├── api/                           # PHP backend
│   ├── public/
│   │   ├── index.php
│   │   └── .htaccess
│   ├── src/
│   │   ├── Action/
│   │   ├── Domain/
│   │   ├── Crypto/
│   │   ├── Repository/
│   │   └── Mail/
│   ├── tests/
│   │   ├── Unit/
│   │   └── E2E/
│   ├── db/schema.sql
│   └── composer.json
├── cypress/                       # Cypress E2E (root-level, drives all apps)
│   ├── e2e/
│   │   ├── enrollment.cy.ts
│   │   └── verification.cy.ts
│   └── support/
├── docker/
│   ├── nginx.conf
│   └── php.ini
├── docker-compose.yml
├── cypress.config.ts
└── package.json                   # root workspace + Cypress dev dep
```

### Root `package.json` (workspaces)

```json
{
  "name": "ikwsd-certs",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev":   "bun run --filter '*' dev",
    "build": "bun run --filter '*' build",
    "test":  "bun run --filter '*' test && bun run cypress run"
  },
  "devDependencies": {
    "cypress": "14.5.4"
  }
}
```

### Shared package (`packages/crypto`)

```json
{
  "name": "@ikwsd/crypto",
  "module": "./src/index.ts",
  "dependencies": { "libsodium-wrappers": "*" }
}
```

Imported by `apps/tutor` (signs sessions, revocations) and `apps/participant` (verifies locally before displaying). `apps/verify` also imports it for the offline signature check UI.

### Dev Server & URL Routing

A single root-level `server.ts` runs in development and routes to the correct app HTML by path. In production the same mapping is expressed in the nginx config:

| Path prefix | Served app |
|---|---|
| `/tutor/*` | `apps/tutor` |
| `/enroll/:token` | `apps/participant` |
| `/verify/:certId` | `apps/verify` |
| `/api/*` | PHP-FPM |

Each SPA reads its relevant path segment from `window.location` on mount — no SPA router dependency needed for three simple, path-distinct apps.

**Magic link mechanics**: the link the tutor drops in the chat is `https://service.example.com/enroll/<token>`. Nginx serves `apps/participant/index.html`. The participant SPA extracts the token from the URL and calls `POST /api/enroll/<token>`. If the API returns `410 Gone`, the SPA renders `<Expired />` instead of the form.

---

## PHP: Modern Patterns & Type Safety

Assume **PHP 8.2+**. Every file begins with:

```php
<?php
declare(strict_types=1);
```

### Patterns to use

**Constructor property promotion** (no boilerplate DTOs):
```php
final readonly class Certificate
{
    public function __construct(
        public string $certId,
        public string $courseId,
        public string $participantName,
        public ?string $participantEmail,
        public string $certPublicKeyB64,
        public string $keyEndorsementSigB64,
        public string $certificateSigB64,
        public \DateTimeImmutable $issuedAt,
    ) {}
}
```

**Enums** for constrained values:
```php
enum CertificateStatus: string
{
    case Valid   = 'valid';
    case Revoked = 'revoked';
}
```

**Match expressions** instead of switch:
```php
$response = match($status) {
    CertificateStatus::Valid   => new ValidResponse($cert),
    CertificateStatus::Revoked => new RevokedResponse($cert, $revocation),
};
```

**Nullsafe operator**: `$cert?->issuedAt->format('c')`

**Named arguments** for clarity at call sites:
```php
$signer->hkdfDerive(masterKey: $key, courseId: $id, validUntil: $ts);
```

**Return types everywhere** — including `never` for methods that always throw, `void` for side-effect-only methods.

**No magic**: no `__get`, no dynamic properties (forbidden in PHP 8.2 on non-stdClass by default). Everything explicit.

---

## Dependency Management: Composer

```bash
cd api && composer init
```

### `composer.json` (runtime dependencies)

```json
{
  "require": {
    "php": "^8.2",
    "slim/slim": "^4.14",
    "slim/psr7": "^1.7",
    "phpmailer/phpmailer": "^6.9"
  },
  "require-dev": {
    "pestphp/pest": "^3.0",
    "phpstan/phpstan": "^2.0"
  },
  "autoload": {
    "psr-4": { "App\\": "src/" }
  },
  "autoload-dev": {
    "psr-4": { "Tests\\": "tests/" }
  }
}
```

**No ORM** — raw PDO with typed repositories. No DI container — wire dependencies manually in `public/index.php` (the composition root).

**Rationale for each library:**
- **Slim 4**: PSR-7/PSR-15 compliant, no magic, ~5 classes you actually interact with. Teaches the middleware pipeline pattern cleanly.
- **slim/psr7**: Lightweight PSR-7 implementation (Nyholm would also work — both are fine).
- **PHPMailer**: Battle-tested, supports SMTP with TLS. WordPress servers always have SMTP available.
- **Pest**: Built on PHPUnit, but syntax is expressive and modern. Supports both unit and feature (E2E) tests. PHPStan covers static analysis in CI.

---

## API Implementation

### Entry Point (`api/public/index.php`)

```php
<?php
declare(strict_types=1);

use Slim\Factory\AppFactory;
use App\Crypto\Signer;
use App\Repository\{SessionRepository, RevocationRepository};
use App\Mail\CertificateMailer;
use App\Action\{CreateSessionAction, EnrollAction, VerifyAction, CreateRevocationAction};

require __DIR__ . '/../vendor/autoload.php';

// Composition root — wire dependencies here, nowhere else
$pdo       = new PDO('sqlite:' . __DIR__ . '/../db/certs.sqlite');
$signer    = new Signer();
$sessions  = new SessionRepository($pdo);
$revocations = new RevocationRepository($pdo);
$mailer    = new CertificateMailer(
    host: $_ENV['SMTP_HOST'],
    user: $_ENV['SMTP_USER'],
    pass: $_ENV['SMTP_PASS'],
    tutorEmail: $_ENV['TUTOR_EMAIL'],
);

$app = AppFactory::create();
$app->addRoutingMiddleware();
$app->addErrorMiddleware(displayErrorDetails: false, logErrors: true, logErrorDetails: true);

// All routes under /api — frontend apps are served by nginx, not PHP
$app->post('/api/sessions',          new CreateSessionAction($sessions, $signer));
$app->post('/api/enroll/{token}',    new EnrollAction($sessions, $signer, $mailer));
$app->get('/api/verify/{certId}',    new VerifyAction($revocations));
$app->post('/api/revocations',       new CreateRevocationAction($revocations, $signer));

$app->run();
```

### Crypto Layer (`api/src/Crypto/Signer.php`)

All crypto via PHP's built-in **libsodium** (`ext-sodium`, enabled by default since PHP 7.2):

```php
final class Signer
{
    /** Sign a message with an Ed25519 secret key. Returns raw 64-byte signature. */
    public function sign(string $message, string $secretKey): string
    {
        return sodium_crypto_sign_detached($message, $secretKey);
    }

    public function verify(string $message, string $signature, string $publicKey): bool
    {
        return sodium_crypto_sign_verify_detached($signature, $message, $publicKey);
    }

    /**
     * Derive a 32-byte Ed25519 seed for a session using HKDF-SHA256.
     * PHP built-in hash_hkdf() — no library needed.
     */
    public function deriveSessionSeed(string $masterSeed, string $courseId, int $validUntil): string
    {
        return hash_hkdf(
            algo:        'sha256',
            key:         $masterSeed,
            length:      32,
            info:        'cert-course-key' . $courseId . pack('J', $validUntil),
            salt:        '',
            binary:      true,  // return raw bytes
        );
    }

    /** Derive Ed25519 keypair from a 32-byte seed. */
    public function keypairFromSeed(string $seed): string  // returns 64-byte keypair
    {
        return sodium_crypto_sign_seed_keypair($seed);
    }

    public function publicKey(string $keypair): string
    {
        return sodium_crypto_sign_publickey($keypair);
    }

    public function secretKey(string $keypair): string
    {
        return sodium_crypto_sign_secretkey($keypair);
    }

    /** NaCl box: X25519 key agreement + XSalsa20-Poly1305 encryption. */
    public function boxSeal(string $message, string $recipientPublicKey): string
    {
        return sodium_crypto_box_seal($message, $recipientPublicKey);
    }

    public function boxSealOpen(string $ciphertext, string $keypair): string|false
    {
        return sodium_crypto_box_seal_open($ciphertext, $keypair);
    }
}
```

### Enrollment Action (core flow)

```php
final class EnrollAction
{
    public function __invoke(Request $request, Response $response, array $args): Response
    {
        // 1. Verify HMAC token + expiry (stateless)
        $session = $this->sessions->findByToken($args['token'])
            ?? throw new HttpNotFoundException($request);

        if ($session->isExpired()) {
            throw new HttpGoneException($request, 'Enrollment window closed');
        }

        // 2. Parse + validate participant input
        $body = (array) $request->getParsedBody();
        $name = trim($body['name'] ?? '');
        if ($name === '') throw new HttpBadRequestException($request, 'Name required');

        // 3. Decrypt K_course_private from stored session credential
        $kCoursePrivate = $this->signer->boxSealOpen(
            $session->kCoursePrivateEnc,
            $this->serverKeypair,
        );

        // 4. Build + sign certificate
        $cert = $this->buildCertificate($session, $name, $kCoursePrivate);

        // 5. Email tutor (fire and forget — don't fail the request if mail fails)
        try { $this->mailer->sendToTutor($cert, $session); } catch (\Throwable) {}

        // 6. Return certificate JSON (not stored)
        $response->getBody()->write(json_encode($cert, JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
```

### Auth: `.htaccess` (production, Apache)

```apache
# api/public/.htaccess
AuthType Basic
AuthName "Tutor"
AuthUserFile /var/www/html/.htpasswd

# Protect instructor routes; allow public routes through unauthenticated
<If "%{REQUEST_URI} =~ m#^/(sessions|revocations)#">
    Require valid-user
</If>

# Front-controller rewrite
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.php [QSA,L]
```

---

## Frontend Additions (Bun/React)

### New dependencies

```bash
bun add libsodium-wrappers qrcode
bun add -d @types/libsodium-wrappers @types/qrcode cypress@14.5.4
```

- **libsodium-wrappers**: Ed25519 + HKDF in the browser, same primitives as PHP's libsodium → byte-for-byte compatible
- **qrcode**: renders certificate JSON as a QR code (for print/PDF)
- **cypress@14.5.4**: pinned to the exact version provided by nixpkgs (`pkgs.cypress`). The Nix shell sets `CYPRESS_RUN_BINARY` to the nixpkgs binary so no separate download happens. **Always keep this version in sync** — check with `nix eval nixpkgs#cypress.version` if updating the flake.

### Routing

Add simple hash-based routing (no React Router dependency — just a `switch` on `window.location.hash` or a tiny custom hook) since the server serves `index.html` on all routes.

### Tutor client (`src/crypto/tutor.ts`)

Runs entirely in the browser. K_master_private is loaded from a local file, used in memory, never stored.

```ts
import sodium from 'libsodium-wrappers';

export async function deriveSessionKeypair(
  masterSeed: Uint8Array,
  courseId: string,
  validUntil: number,
): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array }> {
  await sodium.ready;
  const info = new TextEncoder().encode('cert-course-key' + courseId)
    + new BigUint64Array([BigInt(validUntil)]);
  // HKDF via WebCrypto (matches PHP hash_hkdf)
  const ikm = await crypto.subtle.importKey('raw', masterSeed, 'HKDF', false, ['deriveBits']);
  const seed = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info },
    ikm, 256,
  );
  const kp = sodium.crypto_sign_seed_keypair(new Uint8Array(seed));
  return { publicKey: kp.publicKey, secretKey: kp.privateKey };
}

export async function signRevocation(
  masterSecretKey: Uint8Array,
  certId: string,
  revokedAt: string,
): Promise<string> {
  await sodium.ready;
  const msg = new TextEncoder().encode(certId + revokedAt);
  const sig = sodium.crypto_sign_detached(msg, masterSecretKey);
  return sodium.to_base64(sig, sodium.base64_variants.URLSAFE_NO_PADDING);
}
```

### Certificate Page (QR + print)

The certificate JSON is embedded in a QR code rendered by the `qrcode` library. The existing print CSS pattern is extended: the QR renders on the printed page; the download button writes a `Blob` and triggers `<a download>`. No server roundtrip for any of this.

---

## Database (`api/db/schema.sql`)

```sql
CREATE TABLE sessions (
    id             TEXT PRIMARY KEY,  -- course_id (UUID)
    course_title   TEXT NOT NULL,
    course_date    TEXT NOT NULL,
    institute_name TEXT NOT NULL,
    k_master_pub   TEXT NOT NULL,     -- base64url
    k_course_pub   TEXT NOT NULL,     -- base64url
    session_sig    TEXT NOT NULL,     -- base64url
    k_course_priv_enc TEXT NOT NULL,  -- base64url NaCl sealed box
    valid_until    INTEGER NOT NULL,  -- unix timestamp
    tutor_email    TEXT NOT NULL
);

CREATE TABLE revocations (
    cert_id     TEXT PRIMARY KEY,
    revoked_at  TEXT NOT NULL,
    reason      TEXT NOT NULL,
    signature   TEXT NOT NULL   -- base64url, signed by K_master
);
```

No certificates table — certificates are not stored on the server.

---

## Testing

### Unit tests (Pest)

Test crypto operations, domain logic, and repositories (against an in-memory `:memory:` SQLite):

```php
// tests/Unit/SignerTest.php
test('HKDF derive is deterministic', function () {
    $signer = new Signer();
    $seed = random_bytes(32);
    $a = $signer->deriveSessionSeed($seed, 'course-1', 1700000000);
    $b = $signer->deriveSessionSeed($seed, 'course-1', 1700000000);
    expect($a)->toBe($b);
});

test('different course_id produces different key', function () {
    $signer = new Signer();
    $seed = random_bytes(32);
    $a = $signer->deriveSessionSeed($seed, 'course-1', 1700000000);
    $b = $signer->deriveSessionSeed($seed, 'course-2', 1700000000);
    expect($a)->not->toBe($b);
});

test('certificate signature round-trips', function () {
    $signer  = new Signer();
    $kp      = sodium_crypto_sign_keypair();
    $secret  = $signer->secretKey($kp);
    $public  = $signer->publicKey($kp);
    $payload = 'test payload';
    $sig     = $signer->sign($payload, $secret);
    expect($signer->verify($payload, $sig, $public))->toBeTrue();
});
```

### E2E tests (Pest + curl / Guzzle against Docker)

```php
// tests/E2E/EnrollTest.php
test('participant can enroll during valid window', function () {
    $token = createTestSession(validMinutes: 120);
    $response = post("/enroll/{$token}", ['name' => 'Alice Müller']);
    expect($response->status())->toBe(200);
    $cert = $response->json();
    expect($cert)->toHaveKeys(['cert_id', 'signatures']);
});

test('enrollment rejected after window closes', function () {
    $token = createTestSession(validMinutes: -1); // already expired
    $response = post("/enroll/{$token}", ['name' => 'Bob']);
    expect($response->status())->toBe(410);
});
```

Run with: `cd api && ./vendor/bin/pest`

### Cypress E2E tests (frontend flows)

Cypress tests drive the full user journey through the browser — enrollment, certificate display, QR presence, and verification — against the running Docker stack. Placed in `cypress/e2e/`.

```ts
// cypress/e2e/enrollment.cy.ts
describe('Participant enrollment', () => {
  it('shows the enrollment form for a valid token', () => {
    cy.visit(`/enroll/${Cypress.env('TEST_TOKEN')}`);
    cy.get('[data-cy=name-input]').should('be.visible');
  });

  it('issues a certificate and shows QR code', () => {
    cy.visit(`/enroll/${Cypress.env('TEST_TOKEN')}`);
    cy.get('[data-cy=name-input]').type('Alice Müller');
    cy.get('[data-cy=submit]').click();
    cy.get('[data-cy=certificate-qr]').should('be.visible');
    cy.get('[data-cy=download-json]').should('exist');
  });

  it('shows an error for an expired token', () => {
    cy.visit(`/enroll/${Cypress.env('EXPIRED_TOKEN')}`);
    cy.get('[data-cy=error-message]').should('contain', 'geschlossen'); // German UX copy
  });
});

// cypress/e2e/verification.cy.ts
describe('Third-party verification', () => {
  it('shows valid status for an unrevoked certificate', () => {
    cy.visit(`/verify/${Cypress.env('VALID_CERT_ID')}`);
    cy.get('[data-cy=status-valid]').should('be.visible');
  });

  it('shows revoked status with revocation doc', () => {
    cy.visit(`/verify/${Cypress.env('REVOKED_CERT_ID')}`);
    cy.get('[data-cy=status-revoked]').should('be.visible');
    cy.get('[data-cy=revocation-reason]').should('exist');
  });
});
```

```ts
// cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8080',  // nginx Docker container (serves all three SPAs + API)
    env: {
      API_URL: 'http://localhost:8080/api',
    },
  },
});
```

The `TEST_TOKEN`, `EXPIRED_TOKEN`, `VALID_CERT_ID`, `REVOKED_CERT_ID` environment variables are populated by a Cypress setup task that calls the PHP API (with the tutor bearer token) to create fixtures before the suite runs.

Run with: `bun run cypress run` (or `cypress open` for interactive mode in the Nix shell).

---

## Docker Compose (local dev + testing)

```yaml
# docker-compose.yml
services:
  php:
    image: php:8.2-fpm-alpine
    volumes:
      - ./api:/var/www/html
    environment:
      - SMTP_HOST=mailpit
      - SMTP_USER=test
      - SMTP_PASS=test
      - TUTOR_EMAIL=tutor@example.com

  nginx:
    image: nginx:alpine
    ports: ["8080:80"]
    volumes:
      - ./api/public:/var/www/html/public
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on: [php]

  mailpit:             # catches outgoing email in dev — no real SMTP needed
    image: axllent/mailpit
    ports: ["8025:8025"]  # web UI to inspect sent emails
```

```nginx
# docker/nginx.conf
server {
    listen 80;

    # PHP API — protected instructor endpoints
    location ~ ^/api/(sessions|revocations) {
        auth_basic "Tutor";
        auth_basic_user_file /etc/nginx/.htpasswd;
        fastcgi_pass php:9000;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/html/api/public/index.php;
    }

    # PHP API — public endpoints
    location /api/ {
        fastcgi_pass php:9000;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/html/api/public/index.php;
    }

    # Frontend SPAs — each has its own dist folder
    location /tutor/ {
        root /var/www/html/apps/tutor/dist;
        try_files $uri /tutor/index.html;
    }

    location /enroll/ {
        root /var/www/html/apps/participant/dist;
        try_files $uri /participant/index.html;
    }

    location /verify/ {
        root /var/www/html/apps/verify/dist;
        try_files $uri /verify/index.html;
    }
}
```

**Mailpit** is key for local development: it catches all outgoing emails (the tutor audit trail) and shows them in a web UI at `localhost:8025`. No real SMTP credentials needed.

---

## Verification (end-to-end test procedure)

1. `docker compose up`
2. Open Bun frontend (`bun dev`), navigate to Tutor Dashboard
3. Import a generated K_master key file, create a test course → copy enrollment URL
4. Open enrollment URL in a second browser tab, enter a participant name
5. Check `localhost:8025` (Mailpit) — confirm tutor email arrived with certificate JSON attachment
6. Open certificate JSON in the Certificate page — QR renders correctly
7. Print / Save as PDF — QR is visible on the printed page
8. Navigate to Verify page with `cert_id` — server returns `{ valid: true }`
9. In Tutor Dashboard, revoke the certificate
10. Re-verify — server returns `{ valid: false, revocation_doc: { ... } }`
11. Verify revocation signature offline using OpenSSL:
    ```bash
    openssl pkeyutl -verify -pubin -inkey k_master_public.pem \
      -sigfile revocation.sig -in revocation_payload.bin
    ```
12. Run `cd api && ./vendor/bin/pest` — all tests pass

---

## PHPStan (static analysis)

Add to CI / pre-commit:
```bash
cd api && ./vendor/bin/phpstan analyse src --level=9
```

Level 9 is maximum strictness — catches null dereferences, wrong types, missing returns. Treat it like a compiler. This is the closest PHP gets to Rust's type system enforcement.

---

## Nix Dev Shell

The Cypress binary comes from nixpkgs to avoid Electron download issues in restricted environments. The npm package is pinned to the same version (`14.5.4`):

```nix
devShells.default = pkgs.mkShell {
  buildInputs = buildInputs ++ [ pkgs.cypress ];
  shellHook = ''
    export CXXFLAGS="--std=c++17"
  '';
  CYPRESS_RUN_BINARY = "${pkgs.cypress}/bin/Cypress";
};
```

When updating nixpkgs, run `nix eval nixpkgs#cypress.version` first and update the `cypress` pin in `package.json` to match before committing.
