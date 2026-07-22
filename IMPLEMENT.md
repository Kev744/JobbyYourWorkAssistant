# IMPLEMENT

## Runbook

1. Work one milestone at a time.
2. Read `CODEX_SPEC_CV.md`, `SPEC_CV.md`, and `deep-research-report.md` before implementation work.
3. Keep UI text in French and code identifiers in English.
4. Prefer TypeScript for new files.
5. Use Supabase only from server-safe helpers unless browser auth explicitly requires a public anon key.
6. Keep route handlers thin; put business logic in services or shared modules.
7. Validate inputs at API boundaries.
8. Require authentication for every application API.
9. Update `STATUS.md` and `DECISIONS.md` at each milestone.
10. Ask the user before moving to the next milestone.

## Commands

```bash
pnpm install
pnpm run dev
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

## Source Layout

- `src/app`: App Router pages, layouts, route handlers.
- `src/components`: reusable UI components.
- `src/lib`: shared utilities and server/client helpers.
- `src/types`: shared domain types.
- `tests`: Jest tests.
- `supabase/migrations`: database migrations when Supabase schema work begins.

## Implementation Constraints

- Do not invent CV facts.
- Keep identity/contact data separate from scoring payloads.
- Do not expose provider or service-role secrets to the browser.
- Do not add production dependencies beyond approved stack items without user confirmation.
- Use deterministic PRCV-R v1 for ranking.
