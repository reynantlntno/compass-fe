<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# COMPASS frontend rules

These rules apply to every new page, component, copy change, and API caller.

## Product quality and anti-AI-slop

- COMPASS must be specific, reviewed, humane product work—not generic UI that
  merely looks finished.
- Give every page a clear purpose, audience, next action, and factual outcome.
- Use friendly, direct, everyday language with short, scannable copy and active
  voice. Avoid robotic, corporate, buzzword-heavy, overly technical, or filler
  wording.
- Avoid vague hero headlines, interchangeable layouts, decorative card grids,
  gradient blobs, stock-feeling visuals, repeated patterns without a user
  purpose, invented claims, metrics, testimonials, or unsupported narratives.
- Review loading, empty, unavailable, error, permission, validation,
  responsive, keyboard, reduced-motion, forced-colors, and text-size states.
  Human judgment owns the facts, voice, product decisions, editing, and final
  acceptance.

## Orval and the thin BFF boundary

- The backend OpenAPI contract and Orval-generated client are the frontend API
  contract. After a backend contract change, export the snapshot and run
  `pnpm api:generate`.
- Browser requests use the same-origin `/api/v1` rewrite. Server-only requests
  use `COMPASS_API_BASE_URL` through the existing transport.
- Keep the Next.js BFF thin: forwarding/rewrite and genuinely server-only
  composition only. Do not add catch-all route handlers, duplicate DTOs,
  schemas, error envelopes, auth rules, cookie rotation, OTP, trusted-device,
  replay, abuse, or business logic.
- Never manually edit generated files. Do not import, copy, or depend on
  `legacy/`; it is reference-only.

## Idempotency-Key usage

- Use `Idempotency-Key` only for a mutation whose backend operation contract
  requires it. Never inject it globally, and never add it to GETs or exempt
  authentication operations.
- Use the shared helper in `src/lib/api/idempotency.ts` with the generated
  operation's request-options argument:

  ```ts
  const key = createIdempotencyKey();
  await generatedMutation(payload, withIdempotencyKey(key));
  ```

- Create one key when a logical mutation begins. Reuse it only for a retry of
  the unchanged payload and intent. Discard it after success or when the
  payload/intent changes, then create a new key.
- Preserve other request headers by using `withIdempotencyKey`; do not mutate
  shared options. Keep keys request-local: never log, display, persist, or put
  them in URLs.
- Contact intentionally has optional backend idempotency semantics, but its
  current form still uses the helper so unchanged challenge/retry submissions
  remain one logical intent.

## Conditional Turnstile usage

- Turnstile is endpoint-specific anti-abuse protection, not MFA and not a
  global page gate. Public browsing, status, privacy, Form Campaigns, and
  e-counseling join stay widget-free.
- Mount `TurnstileField` only after the backend returns a `429` with
  `challenge_required=true` and the expected `challenge_action` for the
  current operation. An unexpected action fails closed with safe copy.
- Read only `NEXT_PUBLIC_COMPASS_TURNSTILE_SITE_KEY` in the browser. The
  secret belongs exclusively to backend deployment secrets and must never be
  placed in frontend env files, generated code, logs, storage, or requests
  outside the generated endpoint payload.
- Keep provider tokens in memory only. Reset them on expiry, widget error,
  failed submission, and successful submission. Do not log or persist them.
- Preserve the unchanged Contact form data and idempotency key during its
  inline challenge retry. A changed payload gets a new key. The backend
  validates action, hostname, expiry, single use, and abuse policy.
- Do not add a global widget, frontend CAPTCHA decision logic, challenge route,
  or duplicated abuse/auth rules. Auth, activation, and recovery screens must
  follow the same conditional pattern when they are built.
