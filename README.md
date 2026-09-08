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

## Component showcase

The internal primitive inventory is available at `/showcase` for local
development. In staging, set `COMPASS_COMPONENT_SHOWCASE_ENABLED=true` before
starting the app. The route is not linked from public navigation and is
disabled by default in production; see `.env.example` for the flag.
