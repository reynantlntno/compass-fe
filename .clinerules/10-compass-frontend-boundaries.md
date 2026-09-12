# COMPASS frontend boundaries

- Follow `AGENTS.md` and the relevant Next.js guide under
  `node_modules/next/dist/docs/` before writing code.
- Backend OpenAPI plus the Orval-generated client is the API contract. Export
  the snapshot and run `pnpm api:generate` after an approved backend contract
  change. Never edit generated files manually.
- Browser requests use the same-origin `/api/v1` boundary. Keep the Next.js
  BFF thin: forwarding and genuinely server-only composition only. Do not
  duplicate DTOs, schemas, auth rules, cookie rotation, OTP, trusted-device,
  replay, abuse, or business logic in the frontend.
- Never import, copy, or depend on `legacy/`; it is reference-only.
- Use backend capability snapshots and safe projections. Do not infer roles,
  row scope, sensitive access, or lifecycle eligibility in the UI.
- Use request-local idempotency keys only for generated mutations whose
  backend contract requires them, through the shared helper in
  `src/lib/api/idempotency.ts`. Never log, persist, display, or put keys in
  URLs.
- Preserve COMPASS visual language and review loading, empty, unavailable,
  forbidden, error, validation, responsive, keyboard, reduced-motion,
  forced-colors, and text-size states.
