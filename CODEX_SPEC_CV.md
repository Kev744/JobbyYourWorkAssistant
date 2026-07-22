# CODEX CV Implementation Spec

This file is the implementation contract for the CV tailoring application. It reconciles `SPEC.md`, `SPEC_CV.md`, and the PRCV-R v1 protocol in `deep-research-report.md`.

## Product Scope

Build a French-first SaaS application for the France and Monaco job markets. Users authenticate, upload one or more CV/career corpus files, review structured profile data, search France Travail and Adzuna offers, rank offers deterministically, generate tailored French CV drafts, and track applications.

## Non-Negotiable Rules

- UI copy is French.
- Code, identifiers, API field names, tests, and comments are English.
- All application APIs require authentication.
- Candidate facts must never be invented. Unsupported fields stay blank or are shown as warnings.
- Identity and contact data must not be used for ranking.
- Job search is restricted to France and Monaco.
- Server-side secrets must never be exposed to browser code.
- Supabase RLS must protect all user-owned rows and storage paths.
- PRCV-R v1 is deterministic: no generative ranking and no embeddings in v1.
- Ask the user before moving from one implementation milestone to the next.

## Stack

- Next.js 16 App Router
- React
- TypeScript
- Tailwind CSS 4
- Supabase JS and Supabase SSR helpers
- Jest
- ESLint and Prettier
- pnpm scripts for dev, lint, typecheck, test, and build

## Durable Project Files

Maintain these files during implementation:

- `PLAN.md`: milestones, acceptance criteria, validation commands, checkpoint.
- `IMPLEMENT.md`: execution runbook and implementation constraints.
- `STATUS.md`: completed work, validation results, MCP calls, current state.
- `DECISIONS.md`: architecture decisions, trade-offs, open questions.

## Milestones

0. Project setup: scaffold app, tooling, shared types, durable docs.
1. Auth: Supabase email/password and magic link, protected pages, authenticated API helper, profiles/RLS foundation.
2. CV upload: `/api/upload`, private `cv-originals`, PDF/DOCX validation, checksums, metadata.
3. CV corpus editor/export: preview, editable corpus, versions, PDF/DOCX exports in `cv-versions`.
4. Profile generation: `/api/profile/generate`, `/api/profile`, confirmed structured profile, ROME prediction.
5. Profile requirements: France/Monaco filters, local CSV dropdown data, provider compatibility notes.
6. France Travail offers: OAuth server-side, normalized offers, France/Monaco filtering.
7. Adzuna offers: server-side search, normalized private offers, France/Monaco filtering.
8. Offer cache/storage: 24-hour query cache and deduplicated canonical offers.
9. Deterministic ranking: `/api/match`, PRCV-R v1 scoring and explanations.
10. Tailored CV generation: `/api/generate`, factual French CV, evidence map, exports.
11. Applications: CRUD tracking, status history, generated file paths.
12. Statistics: accepted/refused skill summaries without causal claims.
13. Hardening: security, accessibility, provider resilience, final validation.

## API Routes

Implement these authenticated routes:

- `/api/upload`
- `/api/profile/generate`
- `/api/profile`
- `/api/rome/predict`
- `/api/offers/france-travail`
- `/api/offers/adzuna`
- `/api/offers/cache`
- `/api/match`
- `/api/generate`
- `/api/applications`
- `/api/applications/[id]`
- `/api/statistics/applications`

## Storage Buckets

- `cv-originals`
- `cv-versions`
- `generated-resumes`

All buckets are private. Signed URLs are generated only for the authenticated owner.

## Tables

- `profiles`
- `resume_files`
- `resume_versions`
- `candidate_profiles`
- `profile_requirements`
- `job_search_queries`
- `job_offer_sources`
- `job_offers`
- `job_offer_search_results`
- `scored_offers`
- `generated_resumes`
- `applications`
- `application_status_events`
- `taxonomy_versions`

## PRCV-R v1 Ranking Summary

Ranking uses a deterministic weighted score over 100:

- Skills: 35
- Title/ROME proximity: 15
- Experience: 15
- Education: 8
- Certifications: 5
- Languages: 6
- Keywords: 4
- Soft skills: 4
- Location: 3
- Salary: 3
- Remote: 2

Apply caps and blockers after raw scoring:

- 0 for missing legally mandatory authorization, permit, or regulatory certification.
- Cap 59 if must-have skill coverage is below 50%.
- Cap 69 if relevant experience is below 75% of the minimum for offers requiring at least 3 years.
- Cap 49 if a mandatory language is at least two CECRL levels below requirement.

Tie-breakers: must-have coverage, relevant experience, title/ROME similarity, location/remote compatibility, salary overlap, publication date.

## Validation Per Milestone

Run and report:

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build`

Also report files changed, migrations/buckets/policies changed, MCP calls used, known risks, and whether the next phase is ready for approval.
