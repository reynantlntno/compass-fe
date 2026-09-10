# COMPASS Frontend

University of Camarines Norte (UCN) Guidance and Counseling Office.

This is the new Next.js frontend foundation. The `legacy/` directory is kept
as a read-only reference for existing page behavior, accessibility decisions,
and visual direction; the new application does not import from it.

## Development

```bash
pnpm install
pnpm dev
```

The application uses the Next.js App Router under `src/app` with TypeScript,
ESLint, Tailwind CSS, and the `@/*` import alias.

Copy `.env.example` to `.env.local` and set `COMPASS_API_BASE_URL` to the
backend origin used by the local stack. Local staging uses HTTPS for both the
backend (`https://localhost:8443`) and the frontend; do not change either one
to HTTP or disable TLS verification.

Set `COMPASS_CLIENT_BASE_URL` to the public browser origin so Open Graph and
Twitter preview image URLs resolve absolutely. `COMPASS_ENVIRONMENT=staging`
keeps the frontend non-indexable through metadata, `robots.txt`, and
`X-Robots-Tag`; only an explicit production environment is indexable.

When using the generated local Caddy certificates, set the CA, certificate, and
key paths before starting Next. The CA lets server-rendered requests trust the
backend; the certificate and key let the local HTTPS listener serve the
frontend. These paths are local-only and must not be committed:

```bash
export COMPASS_LOCAL_STAGING_CA_CERT=/path/to/compass-local-staging-caddy-root.crt
export COMPASS_LOCAL_STAGING_TLS_CERT=/path/to/localhost.crt
export COMPASS_LOCAL_STAGING_TLS_CHAIN=/path/to/local-caddy-intermediate.crt
export COMPASS_LOCAL_STAGING_TLS_KEY=/path/to/localhost.key
pnpm start:local -- -p 3100
```

For a hot-reloading HTTPS development server, use the same certificate-aware
wrapper with the local development script:

```bash
pnpm dev:local -- -p 3100
```

The browser still uses `https://localhost:3100`; the wrapper keeps the
development Next.js server on a separate loopback-only port.

PowerShell:

```powershell
$env:COMPASS_LOCAL_STAGING_CA_CERT = "C:\path\to\compass-local-staging-caddy-root.crt"
$env:COMPASS_LOCAL_STAGING_TLS_CERT = "C:\path\to\localhost.crt"
$env:COMPASS_LOCAL_STAGING_TLS_CHAIN = "C:\path\to\local-caddy-intermediate.crt"
$env:COMPASS_LOCAL_STAGING_TLS_KEY = "C:\path\to\localhost.key"
pnpm start:local -- -p 3100
```

`start:local` terminates HTTPS on the requested port and runs Next.js on a
loopback-only internal port. It also reads these four path settings from the
ignored `.env.local` when they are not exported in the shell. The frontend
keeps browser requests on the same-origin `/api/v1` path and forwards them
through the thin Next.js rewrite; the backend remains responsible for
authentication, cookies, and business rules.

`COMPASS_ENVIRONMENT=staging` plus
`COMPASS_COMPONENT_SHOWCASE_ENABLED=true` enables the internal showcase in a
staging build. Production builds keep the route disabled.

## API client

The checked-in `openapi/compass-api.json` file is generated from the backend
OpenAPI document. Orval generates the typed client and models under
`src/lib/api/generated`; do not edit generated files manually.

When the backend contract changes, refresh the snapshot from `compass-be`, then
regenerate the client:

```bash
python manage.py export_openapi \
  --output ../compass-fe/openapi/compass-api.json
pnpm api:generate
```

For a mutation that requires replay protection, create one request-local key
with `createIdempotencyKey()` and pass it through `withIdempotencyKey()`. Keep
that key only while retrying the same payload and intent; discard it after a
successful request or when the payload changes. The transport does not add
keys automatically, and the Contact form uses the same helper even though its
backend idempotency header remains optional.

The public shell loads institution, office, and approved branding data through
the generated client. If public configuration is unavailable, it uses the
centralized fallbacks documented in `.env.example`.

The optional public Turnstile site key is used only by endpoint-specific
challenge widgets when the backend asks for one. Challenge tokens stay in
memory and are validated by the backend; the Turnstile secret belongs only in
backend deployment secrets.

## Component showcase

The internal primitive inventory is available at `/showcase` for local
development. In staging, set `COMPASS_COMPONENT_SHOWCASE_ENABLED=true` before
starting the app. The route is not linked from public navigation and is
disabled by default in production; see `.env.example` for the flag.
