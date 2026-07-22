# PLAN

## Current Checkpoint

Milestone 13 is complete. All planned milestones from `SPEC.md` are implemented and validated.

## Milestones

| Milestone | Name | Deliverable | Status |
|---:|---|---|---|
| 0 | Project setup | Next.js app, tooling, shared types, durable memory files | Complete |
| 1 | Auth | Supabase Auth, protected pages/routes, RLS foundation | Complete |
| 2 | CV upload | `/api/upload`, private storage, upload UI | Complete |
| 3 | CV editor/export | Editable corpus, preview, PDF/DOCX export | Complete |
| 4 | Profile generation | Structured profile and ROME prediction | Complete |
| 5 | Profile requirements | Search filters and CSV location data | Complete |
| 6 | France Travail integration | Public offers route and normalization | Complete |
| 7 | Adzuna integration | Private offers route and normalization | Complete |
| 8 | Offer cache/storage | 24-hour cache and deduplication | Complete |
| 9 | Deterministic ranking | PRCV-R v1 `/api/match` and tests | Complete |
| 10 | Tailored CV generation | Factual French CV and evidence map | Complete |
| 11 | Applications tracking | CRUD, statuses, status history | Complete |
| 12 | Statistics | Accepted/refused skill summaries | Complete |
| 13 | Hardening | Security, accessibility, resilience, final validation | Complete |

## Milestone 0 Acceptance Criteria

- `CODEX_SPEC_CV.md` exists and reconciles the implementation constraints.
- Next.js 16 App Router project uses `src/app`.
- TypeScript, Tailwind CSS 4, ESLint, Prettier, and Jest are configured.
- pnpm scripts exist for dev, lint, typecheck, test, and build.
- Shared domain types exist for CV, offers, scores, and generated evidence.
- A minimal French UI shell renders.
- Jest has at least one passing test.
- Validation commands are run and recorded in `STATUS.md`.

## Validation Commands

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```
