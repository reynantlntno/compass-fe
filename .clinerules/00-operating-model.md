# COMPASS Cline operating model

These are permanent working rules for Cline in the COMPASS frontend
repository. Read `AGENTS.md` before frontend implementation; it remains the
detailed frontend instruction source and is not replaced by this file.

Use this gate for every non-trivial task:

**Investigate first -> ask only necessary questions -> establish a resolved plan -> act.**

- Inspect affected files, dependencies, existing UI/API conventions, tests,
  and relevant Next.js guidance before proposing implementation.
- Separate facts, user decisions, assumptions, and unresolved questions.
- Plan Mode is investigation and planning only. Do not edit files from an
  unresolved plan.
- Ask targeted questions only when repository inspection cannot resolve a
  material scope, architecture, security, privacy, compatibility, data
  integrity, workflow, or UX decision.
- If code conflicts with an explicit specification, API contract, test,
  permanent instruction, or user decision, investigate the conflict rather
  than treating the current implementation as automatically authoritative.
- Keep changes scoped, preserve unrelated work, and report failures or
  incomplete verification honestly.

For a task with cross-repository implications, consult the canonical handoff
when it is accessible in the workspace:

`compass-be/docs/ai-handoff/current-codex-handoff.md`

The handoff is temporary context only. It never overrides repository source,
contracts, tests, specifications, or permanent instructions.
