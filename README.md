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
backend origin used by the local stack. Local staging remains HTTPS at
`https://localhost:8443`; do not change it to HTTP or disable TLS verification.

When using the generated local Caddy certificate, set its path before starting
Next so Node trusts it before the process boots:

```bash
export COMPASS_LOCAL_STAGING_CA_CERT=/path/to/compass-local-staging-caddy-root.crt
pnpm start:local -- -p 3100
```

PowerShell:

```powershell
$env:COMPASS_LOCAL_STAGING_CA_CERT = "C:\path\to\compass-local-staging-caddy-root.crt"
pnpm start:local -- -p 3100
```

The frontend keeps browser requests on the same-origin `/api/v1` path and
forwards them through the thin Next.js rewrite; the backend remains
responsible for authentication, cookies, and business rules.

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

The public shell loads institution, office, and approved branding data through
the generated client. If public configuration is unavailable, it uses the
centralized fallbacks documented in `.env.example`.

## Component showcase

The internal primitive inventory is available at `/showcase` for local
development. In staging, set `COMPASS_COMPONENT_SHOWCASE_ENABLED=true` before
starting the app. The route is not linked from public navigation and is
disabled by default in production; see `.env.example` for the flag.
