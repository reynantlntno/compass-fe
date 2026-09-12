# Validation and Git safety

- Inspect `git status` before editing and preserve unrelated user changes.
- Prefer targeted TypeScript, lint, build, API-generation, and focused manual
  checks for the changed area. Do not run every test or check by default.
- After API regeneration, review the generated diff for contract drift and
  keep generated changes limited to the approved OpenAPI update.
- Finish with `git diff --check`, a status review, and an honest list of
  checks that were or were not run.
- Do not commit, push, deploy, reset, clean, or discard changes without direct
  user authorization.
