# STATUS

## 2026-06-02 - Generation Runtime Fixes And User OpenAI Key Field

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Used the requested `js_error_resolver` agent to inspect CV and cover-letter runtime generation after the PDFKit migration.
- Added a session-only `Clé API OpenAI` password field to `src/components/offers-workspace.tsx`.
- Sent the entered key only with `Générer un CV` and `Générer une lettre de motivation` requests.
- Updated `/api/generate` to accept `openAiApiKey`, pass it to the correct generation handoff, and keep server `OPENAI_KEY` as fallback.
- Updated tailored CV and cover-letter OpenAI helpers to prefer the per-request key without persisting it.
- Fixed UTF-8 French error messages in `/api/generate`.
- Kept PDF integrity validation and integrated the JS resolver's DOCX integrity validation before generated files can be uploaded or returned.

### MCP And Agent Calls Used

- `js_error_resolver` sub-agent: investigated generation runtime risks and added DOCX structure validation.
- No MCP server calls were needed; implementation used local source and tests.

### Validation

- Focused Jest: `offers-workspace`, `generate-route`, `tailored-resume`, and `cover-letter` passed.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- Full Jest via `node .\node_modules\jest\bin\jest.js --runInBand`: passed, 34 suites and 142 tests.
- `pnpm run build`: passed.
- Build warning remains: Turbopack reports the existing file-tracing warning involving `next.config.ts` and `simple-documents.ts`; the production build completes successfully.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `src/components/offers-workspace.tsx`
- `src/app/api/generate/route.ts`
- `src/lib/generate/tailored-resume.ts`
- `src/lib/generate/cover-letter.ts`
- `src/lib/export/simple-documents.ts`
- `tests/offers-workspace.test.tsx`
- `tests/generate-route.test.ts`
- `tests/tailored-resume.test.ts`
- `tests/cover-letter.test.ts`
- `tests/simple-documents.test.ts`
- `DECISIONS.md`
- `STATUS.md`

### Risks And Open Questions

- The user OpenAI key is held in React component state and sent over the authenticated request; it is not persisted by the app.
- DOCX validation is structural, not a complete Office Open XML semantic validator.
- The dev server should be restarted if it was running before these server-route changes.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-05 - Milestone 0 Project Setup

Status: Milestone 0 complete. Waiting for user approval before Milestone 1.

### Work Completed

- Confirmed the repository was spec-only.
- Confirmed `CODEX_SPEC_CV.md` was missing.
- Read `AGENTS.md`, `SPEC_CV.md`, `deep-research-report.md`, and `SPEC.md`.
- Created `CODEX_SPEC_CV.md` as the reconciled implementation spec.
- Added durable project files: `PLAN.md`, `IMPLEMENT.md`, `STATUS.md`, and `DECISIONS.md`.
- Added a Next.js 16 App Router scaffold under `src/app`.
- Added TypeScript, Tailwind CSS 4, ESLint, Prettier, and Jest configuration.
- Added shared domain types for CVs, offers, scoring, and generated-resume evidence.
- Added a minimal French dashboard landing page.
- Added placeholder French pages for `Vue d’ensemble`, `Profil`, `Mes offres`, `Mes candidatures`, and `Connexion`.
- Added a Jest smoke test for the core domain types.
- Installed dependencies with `pnpm`.
- Pinned Turbopack root to this project to avoid scanning the parent user directory.

### MCP Calls Used

- Context7: resolved and queried Next.js documentation for App Router, TypeScript, ESLint, and Jest setup.
- Context7: resolved and queried Tailwind CSS documentation for v4 PostCSS setup.
- Context7: resolved and queried Supabase SSR documentation for Next.js server/browser auth client patterns.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed after adding `ignoreDeprecations` for TypeScript 6 `baseUrl`.
- `pnpm test`: passed, 1 test suite and 1 test.
- `pnpm run build`: passed with Node `v25.9.0`.
- Dev server: started at `http://127.0.0.1:3000`; `/sign-in` returned HTTP 200.

### Migrations, Buckets, Policies

- None yet.

### Risks And Open Questions

- Package installation may require network access.
- The spec requests exact future package versions in places; the scaffold uses current compatible package ranges where exact versions cannot be validated locally without installing.
- `@supabase/supabase-js@2.95.6` is unavailable on npm, so the scaffold uses `^2.105.3`.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 1 Auth is ready for user approval.

## 2026-05-05 - Milestone 1 Auth

Status: Milestone 1 complete. Waiting for user approval before Milestone 2.

### Work Completed

- Added Supabase browser and server client helpers using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Added authenticated user helpers with a French 401 response for protected API use.
- Added middleware that refreshes Supabase auth cookies and redirects unauthenticated users from protected pages to `/sign-in`.
- Added a protected dashboard layout for `Vue d’ensemble`, `Profil`, `Mes offres`, and `Mes candidatures`.
- Added sign-in UI with email/password login, account creation, and magic-link request.
- Added `/auth/callback` for magic-link/session exchange.
- Added `/auth/sign-out` for logout.
- Added server-side auth helper tests.

### MCP Calls Used

- Supabase MCP: inspected public tables and migrations before changes.
- Supabase MCP: applied `auth_profiles` migration.
- Supabase MCP: checked security advisors, found direct execution warnings for the security definer auth trigger function.
- Supabase MCP: applied `revoke_profile_trigger_function_execute` migration.
- Supabase MCP: rechecked security advisors and confirmed no remaining security lints.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 2 test suites and 3 tests.
- `pnpm run build`: passed with Node `v25.9.0`.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050001_auth_profiles.sql`.
- Added and applied `supabase/migrations/202605050002_revoke_profile_trigger_function_execute.sql`.
- Created `public.profiles` with RLS enabled.
- Added owner-only select, insert, and update policies for `profiles`.
- Added auth trigger `public.handle_new_user()` to create/update profile rows after user signup.
- Revoked direct `EXECUTE` on `public.handle_new_user()` from `public`, `anon`, and `authenticated`.
- No storage buckets changed.

### Risks And Open Questions

- The UI supports email/password and magic link. Username login is not implemented because Supabase Auth uses email as the primary built-in identifier; `username` is stored on `profiles` for later profile UI.
- The `.env` includes `NEXT_PUBLIC_SUPABASE_SECRET_KEY`; this was intentionally not used because `NEXT_PUBLIC` values are browser-exposed.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 2 CV upload is ready for user approval.

## 2026-05-05 - Milestone 2 CV Upload

Status: Milestone 2 complete. Waiting for user approval before Milestone 3.

### Work Completed

- Added `/api/upload` with authenticated `GET`, `POST`, `PUT`, and `DELETE`.
- Added PDF/DOCX MIME validation, 10 Mo size limit, empty-file rejection, and French error responses.
- Added SHA-256 checksum computation and duplicate detection per user.
- Added private Supabase Storage uploads under `cv-originals/{user_id}/{uuid}.{ext}`.
- Added metadata persistence in `resume_files`.
- Added replace and delete behavior for uploaded CV files.
- Added French `Vue d’ensemble` upload UI with success, error, replace, delete, duplicate, and confirmation states.
- Added unit tests for upload validation and checksum preparation.
- Smoke-tested unauthenticated `/api/upload`, which returned `401 {"error":"Authentification requise."}`.

### MCP Calls Used

- Supabase MCP: searched official Supabase storage docs for private bucket RLS and `storage.foldername()` policy patterns.
- Supabase MCP: applied `resume_files_upload` migration.
- Supabase MCP: verified `resume_files` table, `cv-originals` bucket settings, migration list, and security advisors.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 3 test suites and 6 tests.
- `pnpm run build`: passed with Node `v25.9.0`.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050003_resume_files_upload.sql`.
- Created `public.resume_files` with RLS enabled.
- Added owner-only select, insert, update, and delete policies for `resume_files`.
- Created private `cv-originals` bucket with a 10 MiB file size limit and PDF/DOCX MIME allow-list.
- Added owner-only select, insert, update, and delete storage policies for `cv-originals` objects scoped by the first path segment matching `auth.uid()`.

### Risks And Open Questions

- This phase stores and lists metadata only; PDF/DOCX preview and corpus extraction are intentionally deferred to Milestone 3.
- Replacing a CV deletes the previous storage object after the metadata update succeeds. The later `resume_versions` flow will handle preserved edited versions.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 3 CV editor/export is ready for user approval.

## 2026-05-05 - Milestone 3 CV Editor And Export

Status: Milestone 3 complete. Waiting for user approval before Milestone 4.

### Work Completed

- Added `resume_versions` persistence for edited CV corpus versions.
- Added private `cv-versions` Supabase Storage bucket.
- Added `/api/upload/[id]/preview` to create short-lived signed preview URLs for authenticated owners.
- Added `/api/resume-versions` with authenticated `GET` and `POST`.
- Added `/api/resume-versions/[id]/export` for authenticated PDF and DOCX export generation.
- Added dependency-free server-side PDF and DOCX generators.
- Added French `Vue d’ensemble` editor workspace with:
  - original CV preview area;
  - editable corpus textarea;
  - basic formatting controls;
  - version save;
  - PDF export;
  - DOCX export;
  - `Générer le profil` button placeholder for Milestone 4.
- Added unit tests for PDF/DOCX export buffers and corpus normalization.
- Smoke-tested unauthenticated `/api/resume-versions`, which returned `401 {"error":"Authentification requise."}`.

### MCP Calls Used

- Supabase MCP: applied `resume_versions_exports` migration.
- Supabase MCP: verified `resume_versions` RLS, `cv-originals` and `cv-versions` private bucket settings, migration list, and security advisors.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 4 test suites and 9 tests.
- `pnpm run build`: passed with Node `v25.9.0`.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050004_resume_versions_exports.sql`.
- Created `public.resume_versions` with RLS enabled.
- Added owner-only select, insert, update, and delete policies for `resume_versions`.
- Created private `cv-versions` bucket with a 10 MiB file size limit and PDF/DOCX MIME allow-list.
- Added owner-only select, insert, update, and delete storage policies for `cv-versions` objects scoped by the first path segment matching `auth.uid()`.

### Risks And Open Questions

- No new production dependencies were added. The PDF/DOCX exporters are intentionally simple and text-based; richer typography/layout can be revisited in later export-quality hardening.
- Direct DOCX preview is not available in-browser without adding a document rendering dependency. The UI shows a French note and uses the editable corpus pane as the working preview for DOCX sources.
- The `Générer le profil` action is present but intentionally disabled functionally until Milestone 4 implements profile generation.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 4 Profile generation is ready for user approval.

## 2026-05-05 - Milestone 4 Profile Generation

Status: Milestone 4 complete. Waiting for user approval before Milestone 5.

### Work Completed

- Added `candidate_profiles` persistence for generated and confirmed profile data.
- Added `/api/profile/generate` to generate a structured profile from a saved `resume_versions` corpus.
- Added `/api/profile` with authenticated `GET` and `PUT`.
- Added `/api/rome/predict` with authenticated ROME prediction.
- Added a conservative local profile extractor that only maps explicit corpus sections and leaves unsupported fields blank.
- Added identity/contact extraction into `identity_contact`, separate from `scoring_payload`.
- Added ROMEo integration using France Travail client credentials, scope `api_romeov2`, and a safe `Inconnu` fallback when prediction is unavailable or below the `0.7` threshold.
- Wired `Générer le profil` from the CV editor to profile generation and navigation to `Profil`.
- Rebuilt the `Profil` page with editable French sections and confirmation save.
- Added extractor tests for explicit section mapping, ROME code propagation, blank unsupported fields, and warnings.
- Smoke-tested unauthenticated `/api/profile` and `/api/rome/predict`, both returning `401 {"error":"Authentification requise."}`.

### MCP Calls Used

- DuckDuckGo MCP: attempted to fetch France Travail ROMEo docs; the SPA content was not directly fetchable.
- Web search: checked indexed official/public documentation snippets for ROMEo scope/base URL/response shape because the official docs page is a JavaScript app.
- Supabase MCP: applied `candidate_profiles` migration.
- Supabase MCP: verified `candidate_profiles` RLS, migration list, and security advisors.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 5 test suites and 11 tests.
- `pnpm run build`: passed with Node `v25.9.0`.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050005_candidate_profiles.sql`.
- Created `public.candidate_profiles` with RLS enabled.
- Added owner-only select, insert, update, and delete policies for `candidate_profiles`.
- No storage buckets changed in this phase.

### Risks And Open Questions

- Profile generation is conservative and local; it does not call an LLM and does not disclose CV text to third-party AI providers.
- ROMEo docs are hosted behind a JavaScript documentation UI, so the implementation uses documented indexed OpenAPI snippets for scope `api_romeov2`, realm `/partenaire`, and `predictionMetiers`. If France Travail returns a different live operation shape, `/api/rome/predict` safely returns `Inconnu`.
- `Profil > Critères de recherche` remains a placeholder until Milestone 5.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 5 Profile requirements is ready for user approval.

## 2026-05-05 - Milestone 5 Profile Requirements

Status: Milestone 5 complete. Waiting for user approval before Milestone 6.

### Work Completed

- Added `profile_requirements` persistence for saved job-search filters.
- Extended `/api/profile` with `resource=requirements` for authenticated requirements `GET` and `PUT`.
- Added local CSV loaders for `communes-france-2025.csv` and `departements-france.csv`.
- Added city, department, and region options from local France data.
- Added French `Critères de recherche` form on `Profil`.
- Added fields for profession keywords, city, department, region, radius, experience, availability, contracts, handicap accepted, salary, remote preference, full-time/permanent, and company name.
- Added provider compatibility notes for unsupported or source-specific filters.
- Added `Rechercher des offres` button that saves requirements and navigates to `Mes offres`.
- Added tests for requirement normalization, radius bounds, booleans, salary normalization, and provider notes.
- Smoke-tested unauthenticated `/api/profile?resource=requirements`, which returned `401 {"error":"Authentification requise."}`.

### MCP Calls Used

- Web search: checked official France Travail/data.gouv and Adzuna documentation for provider filter compatibility.
- Supabase MCP: applied `profile_requirements` migration.
- Supabase MCP: verified `profile_requirements` RLS, migration list, and security advisors.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 6 test suites and 13 tests.
- `pnpm run build`: passed with Node `v25.9.0`.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050006_profile_requirements.sql`.
- Created `public.profile_requirements` with RLS enabled.
- Added owner-only select, insert, update, and delete policies for `profile_requirements`.
- No storage buckets changed in this phase.

### Risks And Open Questions

- The city datalist is capped in the client to keep the page payload reasonable; the server loader reads the local commune file and can be expanded into a searchable API later if needed.
- Provider-specific parameter names are not sent upstream yet; this phase stores normalized requirements for use by Milestones 6 and 7.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 6 France Travail integration is ready for user approval.

## 2026-05-05 - Milestone 6 France Travail Integration

Status: Milestone 6 complete. Waiting for user approval before Milestone 7.

### Work Completed

- Added an authenticated `/api/offers/france-travail` route.
- Added server-side France Travail OAuth client-credentials handling with in-memory token caching.
- Added France Travail search query construction from saved `profile_requirements` and the latest `candidate_profiles` ROME code.
- Mapped supported filters for ROME code, keywords, commune, department, region, contract type, experience, radius, and disability-accessible offers.
- Normalized France Travail results into the shared `JobOffer` shape.
- Excluded offers outside France and Monaco using postal code, INSEE code, and Monaco city detection.
- Added provider timeout handling, French warning/error responses, and safe normalization for partial upstream data.
- Added a French `Mes offres` public-offers tab that loads France Travail offers, displays warnings, empty states, skills, score placeholders, and source links.
- Kept `Offres privees` disabled until Adzuna is implemented in Milestone 7.
- Updated `pnpm run typecheck` to run `next typegen` before `tsc --noEmit`, matching Next.js 16 generated route type requirements.
- Added unit tests for France Travail query construction.
- Smoke-tested unauthenticated `/api/offers/france-travail`, which returned `401 {"error":"Authentification requise."}`.

### MCP Calls Used

- Context7: queried Next.js 16.2.2 documentation for generated route types and `next typegen`.
- Web search: checked the official/public France Travail API Offres d'emploi listing and indexed documentation metadata for provider capabilities.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed after adding `next typegen` before `tsc --noEmit`.
- `pnpm test`: passed, 7 test suites and 15 tests.
- `pnpm run build`: passed with Node `v25.9.0`.
- Smoke test: unauthenticated `/api/offers/france-travail` returned the expected French 401 response.

### Migrations, Buckets, Policies

- No database migrations changed in this phase.
- No storage buckets changed in this phase.
- No RLS policies changed in this phase.

### Risks And Open Questions

- Live France Travail calls require valid server-side `FRANCE_TRAVAIL_CLIENT_ID` and `FRANCE_TRAVAIL_CLIENT_SECRET` credentials with access to API Offres d'emploi.
- France Travail documentation is partly exposed through public catalogue pages and a JavaScript documentation UI; if an enabled tenant uses a different product scope or endpoint variant, the route will return a French provider error instead of leaking credentials or failing open.
- Offer cache, canonical storage, search history, and deduplication are intentionally deferred to Milestone 8.
- Adzuna/private offers are intentionally deferred to Milestone 7.
- `Generer un CV` remains a UI placeholder until Milestone 10.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 7 Adzuna integration is ready for user approval.

## 2026-05-05 - Milestone 7 Adzuna Integration

Status: Milestone 7 complete. Waiting for user approval before Milestone 8.

### Work Completed

- Added an authenticated `/api/offers/adzuna` route.
- Added server-side Adzuna credential handling using `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
- Added Adzuna search query construction from saved `profile_requirements` and the latest `candidate_profiles` profession.
- Mapped supported Adzuna filters for keywords, location, distance, salary minimum, full-time, permanent, and company name.
- Normalized Adzuna results into the shared `JobOffer` shape.
- Added server-side France/Monaco guard during Adzuna result normalization.
- Added provider timeout handling, French warning/error responses, and safe normalization for partial upstream data.
- Replaced the old public-only offers panel with a French tabbed offers workspace for `Offres publiques` and `Offres privees`.
- Added Adzuna query-construction tests.
- Smoke-tested unauthenticated `/api/offers/adzuna`, which returned `401 {"error":"Authentification requise."}`.

### MCP Calls Used

- Web search: checked official Adzuna developer documentation for jobs search endpoint, credentials, query parameters, and response fields.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 8 test suites and 17 tests.
- `pnpm run build`: passed with Node `v25.9.0`.
- Smoke test: unauthenticated `/api/offers/adzuna` returned the expected French 401 response.

### Migrations, Buckets, Policies

- No database migrations changed in this phase.
- No storage buckets changed in this phase.
- No RLS policies changed in this phase.

### Risks And Open Questions

- Live Adzuna calls require valid server-side `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` credentials.
- Adzuna does not expose the same filter model as France Travail; detailed contract types, handicap-accessible offers, ROME codes, and remote preference remain warnings or ranking inputs for later phases.
- The France market endpoint should restrict most results to France; Monaco support depends on provider availability and is still guarded by city detection.
- Offer cache, canonical storage, search history, and deduplication are intentionally deferred to Milestone 8.
- `Generer un CV` remains a UI placeholder until Milestone 10.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 8 Offer cache/storage is ready for user approval.

## 2026-05-05 - Milestone 8 Offer Cache And Storage

Status: Milestone 8 complete. Waiting for user approval before Milestone 9.

### Work Completed

- Added canonical offer storage for `job_offers`, deduplicated by `(source, source_offer_id)`.
- Added `job_offer_sources` lookup rows for France Travail and Adzuna.
- Added owner-scoped `job_search_queries` for provider query history.
- Added owner-scoped `job_offer_search_results` to preserve ranked provider result snapshots for each fresh search run.
- Added deterministic SHA-256 query hashing over stable JSON `{ source, query }`.
- Added 24-hour cache reuse before calling France Travail or Adzuna.
- Added manual refresh support with `?refresh=true`, which bypasses cache and creates a new search-run row.
- Added `/api/offers/cache` with authenticated `GET` for recent cache/search history and `POST` for source-specific cached search/refresh.
- Updated `/api/offers/france-travail` and `/api/offers/adzuna` to use the cache service.
- Updated `Mes offres` with French cache status text and an `Actualiser` action.
- Added cache helper tests for deterministic hashing, source isolation, stable nested JSON, and 24-hour expiration.
- Smoke-tested unauthenticated `/api/offers/cache`, `/api/offers/france-travail?refresh=true`, and `/api/offers/adzuna?refresh=true`; all returned `401 {"error":"Authentification requise."}`.

### MCP Calls Used

- Supabase MCP: inspected existing public tables before schema work.
- Supabase MCP: applied `offer_cache_storage`, `tighten_job_offer_writes`, `optimize_offer_cache_policies`, and `index_job_offer_creator` migrations.
- Supabase MCP: verified new tables and RLS status.
- Supabase MCP: checked security and performance advisors after schema changes.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 9 test suites and 21 tests.
- `pnpm run build`: passed with Node `v25.9.0`.
- Supabase security advisors: clean after tightening `job_offers` write policies.
- Supabase performance advisors: remaining items are older RLS initplan/FK index notes plus unused-index notes on newly created empty indexes.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050007_offer_cache_storage.sql`.
- Added and applied `supabase/migrations/202605050008_tighten_job_offer_writes.sql`.
- Added and applied `supabase/migrations/202605050009_optimize_offer_cache_policies.sql`.
- Added and applied `supabase/migrations/202605050010_index_job_offer_creator.sql`.
- Created `public.job_offer_sources` with RLS enabled and authenticated read access.
- Created `public.job_offers` with RLS enabled, authenticated read access, owner-attributed inserts, and no broad update policy.
- Created `public.job_search_queries` with owner-only select and insert policies.
- Created `public.job_offer_search_results` with owner-only select and insert policies.
- No storage buckets changed in this phase.

### Risks And Open Questions

- Cache persistence runs through the authenticated Supabase client. Canonical offer rows are public provider data; user search history remains owner-scoped.
- Existing provider credential requirements still apply for cache misses and manual refreshes.
- Manual refresh stores a new search-run row even when upstream results are the same.
- `last_seen_at` is set on first canonical insert only for duplicate offers because unrestricted canonical updates were intentionally removed to keep RLS tighter.
- Remaining Supabase performance advisor notes for earlier tables are deferred to the hardening milestone unless they block a later feature.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 9 Deterministic ranking is ready for user approval.

## 2026-05-05 - Milestone 9 Deterministic Ranking

Status: Milestone 9 complete. Waiting for user approval before Milestone 10.

### Work Completed

- Added PRCV-R v1 deterministic scoring in `src/lib/match/prcv-r.ts`.
- Implemented weighted scoring over skills, title/ROME, experience, education, certifications, languages, keywords, soft skills, location, salary, and remote compatibility.
- Added deterministic caps/blockers for missing legal requirements, low must-have skill coverage, insufficient required experience, and mandatory CECRL gaps.
- Added accent-insensitive matching while preserving technical tokens such as `C#`, `React.js`, `Node.js`, and `TypeScript`.
- Added CECRL ordering, RNCP level scoring, salary interval overlap, relevant experience date calculation, expired-certification handling, and stable tie-break sorting.
- Added authenticated `/api/match` with `GET` and `POST`.
- `/api/match` scores an explicit `queryId` or the latest cached user search for a provider source.
- Persisted scores in `scored_offers` with score breakdown, matched features, missing must-haves, French explanation, and final score.
- Updated `Mes offres` with a `Classer` action and score display for final score, matched skills, missing must-haves, blockers/caps, and explanation.
- Added PRCV-R tests for normalization, skill matching, caps/blockers, CECRL, RNCP, salary, experience, expired certifications, bounds, and stable sorting.
- Smoke-tested unauthenticated `/api/match`, which returned `401 {"error":"Authentification requise."}`.

### MCP Calls Used

- Supabase MCP: applied `scored_offers` and `index_scored_offer_source` migrations.
- Supabase MCP: verified table/RLS state.
- Supabase MCP: checked security and performance advisors after schema changes.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 10 test suites and 31 tests.
- `pnpm run build`: passed with Node `v25.9.0`.
- Supabase security advisors: clean.
- Supabase performance advisors: remaining items are older RLS initplan/FK index notes plus unused-index notes on new empty indexes.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050011_scored_offers.sql`.
- Added and applied `supabase/migrations/202605050012_index_scored_offer_source.sql`.
- Created `public.scored_offers` with RLS enabled.
- Added owner-only select, insert, and update policies for `scored_offers`.
- Added indexes for score listing and foreign keys.
- No storage buckets changed in this phase.

### Risks And Open Questions

- PRCV-R v1 uses deterministic exact/fuzzy lexical matching only; semantic taxonomy expansion remains an explicit future enhancement with weight `0` in v1.
- Scores depend on the quality and completeness of the structured CV/profile corpus and normalized provider offers.
- Provider offers with no structured skills receive a neutral skills score rather than zero to avoid over-penalizing sparse providers.
- `scored_offers` rows are overwritten for the same user/profile/offer tuple when the user reruns ranking.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 10 Tailored CV generation is ready for user approval.

## 2026-05-05 - Milestone 10 Tailored CV Generation

Status: Milestone 10 complete. Waiting for user approval before Milestone 11.

### Work Completed

- Added deterministic tailored CV generation in `src/lib/generate/tailored-resume.ts`.
- Added authenticated `/api/generate` with `GET` for recent generated CVs and `POST` for generation.
- `POST /api/generate` accepts `offerId`, `candidateProfileId`, `resumeVersionId`, and optional `userInstructions`.
- Generated CV content is composed only from confirmed candidate profile facts, the selected resume version, and source offer data.
- Added an evidence map entry for generated factual lines, with source type, field, source id, and confidence.
- User instructions are stored and can influence the request context, but unsupported new facts are not injected into generated content.
- Exported every generated CV as PDF and DOCX using the existing dependency-free document generator.
- Stored generated files in the private `generated-resumes` Supabase Storage bucket.
- Added signed PDF/DOCX URLs to the generation API response.
- Added `generated_resumes` persistence with owner-only RLS.
- Wired `Générer un CV` from scored offers in `Mes offres` to `/api/generate`.
- Added tests for compact French CV generation, evidence coverage, matched offer skills, one-page length, and unsupported instruction warnings.
- Smoke-tested unauthenticated `/api/generate`, which returned `401 {"error":"Authentification requise."}`.

### MCP Calls Used

- Supabase MCP: applied `generated_resumes` migration.
- Supabase MCP: verified `generated_resumes` table and RLS state.
- Supabase MCP: verified private `generated-resumes` bucket settings.
- Supabase MCP: checked security and performance advisors after schema/storage changes.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 11 test suites and 33 tests.
- `pnpm run build`: passed with Node `v25.9.0`.
- Supabase security advisors: clean.
- Supabase performance advisors: remaining items are older RLS initplan/FK index notes plus unused-index notes on new empty indexes.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050013_generated_resumes.sql`.
- Created `public.generated_resumes` with RLS enabled.
- Added owner-only select, insert, update, and delete policies for `generated_resumes`.
- Created private `generated-resumes` bucket with a 10 MiB limit and PDF/DOCX MIME allow-list.
- Added owner-only select, insert, update, and delete storage policies for `generated-resumes` objects scoped by the first path segment matching `auth.uid()`.

### Risks And Open Questions

- The generated CV layout is compact and dependency-free; advanced design/layout quality remains a hardening/export-quality concern.
- The generator intentionally ignores unsupported factual claims in user instructions and returns a French warning instead.
- Evidence is attached to generated factual lines; section headings are structural and do not carry independent evidence.
- Generated signed URLs expire after 5 minutes and can be regenerated later from stored private paths in a future UI/API extension.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 11 Applications tracking is ready for user approval.

## 2026-05-05 - Milestone 11 Applications Tracking

Status: Milestone 11 complete. Waiting for user approval before Milestone 12.

### Work Completed

- Added `ApplicationStatus`, `ApplicationStatusEvent`, and `ApplicationRecord` domain types.
- Added authenticated `/api/applications` with `GET` and `POST`.
- Added authenticated `/api/applications/[id]` with `GET`, `PUT`, `PATCH`, and `DELETE`.
- Stored application records with generated CV file paths, canonical offer id, offer snapshot, application URL, current status, and timestamps.
- Stored status history in `application_status_events`; a new event is created only when status changes.
- Added duplicate handling for repeated application creation from the same generated CV.
- Wired `Mes offres` so a generated CV can be added to application tracking.
- Replaced the placeholder `Mes candidatures` page with a French tracking UI for counts, statuses, history, application URL, and delete confirmation.
- Added tests for application status validation, URL validation, row mapping, and unauthenticated API rejection.

### MCP Calls Used

- Supabase MCP: applied `applications_tracking` migration.
- Supabase MCP: verified `applications` and `application_status_events` tables with RLS enabled.
- Supabase MCP: checked security and performance advisors after schema changes.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 13 test suites and 39 tests.
- `pnpm run build`: passed with Node `v25.9.0`.
- Supabase security advisors: clean.
- Supabase performance advisors: existing backlog remains, plus unused-index notices for new empty application indexes. No new unindexed application foreign-key warning appeared.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050014_applications_tracking.sql`.
- Created `public.applications` with owner-only select, insert, update, and delete RLS policies.
- Created `public.application_status_events` with owner-only select and insert RLS policies.
- Added application indexes for user/status listing, generated resume lookup, job offer lookup, and status history listing.
- No storage buckets changed in this phase.

### Files Changed

- `src/types/domain.ts`
- `src/types/index.ts`
- `src/lib/applications/applications.ts`
- `src/app/api/applications/route.ts`
- `src/app/api/applications/[id]/route.ts`
- `src/components/applications-workspace.tsx`
- `src/components/offers-workspace.tsx`
- `src/app/(protected)/my-applications/page.tsx`
- `tests/applications.test.ts`
- `tests/applications-api-auth.test.ts`
- `supabase/migrations/202605050014_applications_tracking.sql`
- `PLAN.md`
- `DECISIONS.md`
- `STATUS.md`

### Risks And Open Questions

- Application file paths are stored and displayed as availability labels, but signed download URLs for tracked generated CVs are not exposed from the applications UI yet.
- The application record preserves an offer snapshot at creation time; later provider offer changes will not mutate existing tracked applications.
- Deleting an application removes only the tracking record and status events, not the generated resume files.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 12 Mini statistics is ready for user approval.

## 2026-05-05 - Milestone 12 Mini Statistics

Status: Milestone 12 complete. Waiting for user approval before Milestone 13.

### Work Completed

- Added application statistics domain types for skill counts and percentages.
- Added deterministic statistics calculation in `src/lib/statistics/applications.ts`.
- Implemented authenticated `/api/statistics/applications`.
- Statistics summarize the top 3 skills in accepted applications and the top 3 skills in refused applications.
- Counts are per application, so repeated provider skill labels in a single offer are deduplicated.
- Percentages represent the share of applications in that status containing the skill.
- Added French empty states for insufficient accepted/refused data.
- Added a statistics panel to `Mes candidatures` with recalculation after status changes, deletion, or manual refresh.
- Fixed French mojibake in the Milestone 11 applications UI files touched during this phase.
- Added tests for statistics ordering, deduplication, percentages, empty states, and unauthenticated API rejection.

### MCP Calls Used

- Supabase MCP: checked security advisors after API-only changes.
- Supabase MCP: checked performance advisors for current backlog awareness.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 14 test suites and 43 tests.
- `pnpm run build`: passed with Node `v25.9.0`.
- Supabase security advisors: clean.
- Supabase performance advisors: existing backlog remains; no migration or bucket change was made in this phase.

### Migrations, Buckets, Policies

- No migrations added.
- No storage buckets changed.
- `/api/statistics/applications` reads owner-scoped `applications` rows through the authenticated Supabase client and existing RLS.

### Files Changed

- `src/types/domain.ts`
- `src/types/index.ts`
- `src/lib/statistics/applications.ts`
- `src/app/api/statistics/applications/route.ts`
- `src/components/applications-workspace.tsx`
- `src/app/(protected)/my-applications/page.tsx`
- `tests/application-statistics.test.ts`
- `tests/applications-api-auth.test.ts`
- `PLAN.md`
- `DECISIONS.md`
- `STATUS.md`

### Risks And Open Questions

- Statistics are descriptive only and intentionally avoid causal wording.
- Skill quality depends on provider-normalized offer snapshots stored at application creation time.
- On-demand calculation is appropriate for current user-local data volume; larger datasets may later need materialized summaries or pagination.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

Milestone 13 Hardening is ready for user approval.

## 2026-05-05 - Milestone 13 Hardening

Status: Milestone 13 complete. All planned milestones are implemented and validated.

### Work Completed

- Added shared provider HTTP resilience in `src/lib/providers/http.ts`.
- Provider GET requests now use timeout handling, one safe retry for 429/5xx responses, and normalized French warnings.
- France Travail and Adzuna offer searches now use the shared provider HTTP helper.
- Added Adzuna environment fallback support for the existing local `ADZUNA_API_ID` / `ADZUNA_API_KEY` names while keeping `.env.example` on `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`.
- Added provider HTTP tests for safe retry behavior, unsafe POST non-retry behavior, and 429 warning normalization.
- Added `.env` and `.env.*` to `.gitignore`, with `.env.example` placeholders.
- Added a protected-layout skip link and stable content target for keyboard users.
- Fixed French text encoding in touched source files and metadata.
- Added and applied a Supabase hardening migration for advisor-reported RLS initplan and unindexed-FK issues.
- Re-ran Supabase advisors after migration.

### MCP Calls Used

- Supabase MCP: applied `hardening_performance` migration.
- Supabase MCP: checked security advisors after hardening.
- Supabase MCP: checked performance advisors after hardening.
- Supabase MCP: listed public tables to verify RLS remained enabled.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 15 test suites and 46 tests.
- `pnpm run build`: passed with Node `v25.9.0`.
- Supabase security advisors: clean.
- Supabase performance advisors: RLS initplan warnings and unindexed-FK warnings resolved. Remaining notices are `unused_index` INFO items on empty or newly created tables/indexes.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050015_hardening_performance.sql`.
- Added covering indexes:
  - `candidate_profiles_resume_version_id_idx`
  - `profile_requirements_candidate_profile_id_idx`
  - `resume_versions_user_id_idx`
- Recreated older owner policies on `profiles`, `resume_files`, `resume_versions`, `candidate_profiles`, and `profile_requirements` with `(select auth.uid())`.
- No storage buckets changed.

### Files Changed

- `.gitignore`
- `.env.example`
- `src/app/layout.tsx`
- `src/app/(protected)/layout.tsx`
- `src/app/api/offers/adzuna/route.ts`
- `src/app/api/offers/france-travail/route.ts`
- `src/lib/adzuna/offers.ts`
- `src/lib/france-travail/offres.ts`
- `src/lib/providers/http.ts`
- `tests/provider-http.test.ts`
- `supabase/migrations/202605050015_hardening_performance.sql`
- `PLAN.md`
- `DECISIONS.md`
- `STATUS.md`

### Risks And Open Questions

- A local `.env` file existed with real credentials and a client-prefixed secret-style Supabase variable. `.gitignore` now prevents committing it, but those credentials should be rotated outside the repository.
- Remaining Supabase performance advisor notices are unused-index INFO items caused by an empty/new database; removing those indexes would weaken planned query paths and FK maintenance.
- Provider retries are intentionally limited to safe GET requests; token POSTs are not retried to avoid duplicating unsafe upstream operations.
- The sandbox PATH still resolves Node `18.20.3` by default, so validation was run by prepending `C:\Program Files\nodejs`, where Node `v25.9.0` is installed.

### Next Phase

All planned milestones are complete. Recommended next work is manual end-to-end testing with real Supabase Auth and provider credentials, then credential rotation for the local `.env` secrets noted above.

## 2026-05-05 - CV Section Extraction Enhancement

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Added authenticated `/api/profile/extract-sections` for OpenAI-backed CV section extraction.
- Added a server-side OpenAI Responses API helper using `OPENAI_KEY`, structured JSON output, `store: false`, and no new production dependency.
- Extracted sections are returned as Markdown with French headings: `Profil`, `Formation`, `Expériences professionnelles`, `Compétences`, `Certifications`, and `Centres d'intérêt`.
- Added `Extraire les sections` to `resume-editor-panel.tsx`; it fills the existing corpus textarea so the user can review, copy/paste, save, then generate the profile.
- Improved local profile parsing compatibility for English headings and straight/curly apostrophe hobby headings.
- Fixed line-item parsing so job titles and date ranges with hyphens are preserved.

### MCP Calls Used

- OpenAI docs skill was used with official OpenAI documentation fallback via web browsing because no OpenAI docs MCP tool was available in this session.
- Official OpenAI docs consulted for the Responses API, structured outputs, and current GPT-5.5 guidance.

### Validation

- `pnpm test`: passed, 16 test suites and 48 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- No database migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `src/app/api/profile/extract-sections/route.ts`
- `src/components/resume-editor-panel.tsx`
- `src/lib/profile/resume-section-extractor.ts`
- `src/lib/profile/profile-extractor.ts`
- `tests/resume-section-extractor.test.ts`
- `STATUS.md`

### Risks And Open Questions

- The feature extracts from the editable corpus text, not directly from PDF/DOCX binary content.
- Live extraction requires a valid server-side `OPENAI_KEY`; `OPENAI_MODEL` can override the default model if needed.
- CV text is sent to OpenAI for this action, so users should trigger it only when they intend to use the AI extraction workflow.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-30 - Cover Letter PDF/DOCX Indentation

### Completed

- Added renderer support for the alignment hints emitted by `buildCoverLetterContent()`.
- DOCX exports now map right-aligned cover-letter blocks to `w:jc="right"` and justified body blocks to `w:jc="both"`.
- PDF exports now position right-aligned cover-letter blocks near the right margin.
- Raw `<div align="...">` layout hints are stripped from generated document text.

### Files Changed

- `src/lib/export/simple-documents.ts`
- `src/lib/generate/cover-letter.ts`
- `tests/simple-documents.test.ts`
- `DECISIONS.md`
- `STATUS.md`

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### MCP Calls Used

- None. The change used existing local renderer code and tests.

### Validation

- `pnpm test -- simple-documents`: passed, 13 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 31 suites and 133 tests.
- `pnpm run build`: passed.

### Risks And Open Questions

- PDF justification remains left-flowed text; the requested indentation is applied to right-aligned blocks, while DOCX receives true justified paragraph metadata for body blocks.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-30 - Cover Letter Company Context Research

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Added optional company-context research for cover-letter generation.
- Uses OpenAI Responses API `web_search` only when `ENABLE_COVER_LETTER_COMPANY_RESEARCH=true`.
- Skips web search when the job offer already contains useful company context such as values, CSR/RSE, labels, mission, culture, engagement, collaboration, transparency, inclusion, ethics, environment, impact, or working style.
- Keeps company research as a separate step before cover-letter generation.
- Sends only company and offer-safe data to the research step; candidate profile and contact data are not sent to web search.
- Adds `companyResearch` to the cover-letter generation payload for the `Vous` paragraph.
- Updated the final cover-letter prompt file to explain how to use `companyResearch`.
- Added `OPENAI_COMPANY_RESEARCH_MODEL` and `ENABLE_COVER_LETTER_COMPANY_RESEARCH` to `.env.example`.
- Added tests for web-search usage and offer-context skip behavior.

### MCP Calls Used

- None. Official OpenAI web documentation was checked externally for the Responses API `web_search` tool behavior.

### Validation

- `pnpm test -- cover-letter`: passed, 1 suite and 4 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 31 test suites and 131 tests.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- None.

### Files Changed

- `.env.example`
- `cover_letter_instruction/cover_letter_prompt_instructions_project.md`
- `src/lib/generate/cover-letter.ts`
- `tests/cover-letter.test.ts`
- `STATUS.md`
- `DECISIONS.md`

### Risks And Open Questions

- Company research is disabled by default and must be enabled with `ENABLE_COVER_LETTER_COMPANY_RESEARCH=true`.
- Web research can fail or return weak context; the generator falls back to offer-only context in that case.
- The app does not use the local Codex DuckDuckGo MCP server at runtime; it uses OpenAI `web_search` inside the server-side OpenAI call.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-30 - Cover Letter Generation Handoff

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Added a `Générer une lettre de motivation` action to each scored offer in `src/components/offers-workspace.tsx`.
- Added an explicit generation handoff decision with two supported paths only:
  - `resume_generation`
  - `cover_letter_generation`
- Kept `generationType: auto` out of scope as requested.
- Extended `/api/generate` to accept `generationType: 'resume'` or `generationType: 'cover_letter'`.
- Added `src/lib/generate/cover-letter.ts` for OpenAI cover-letter generation, using confirmed profile facts, normalized offer data, matching context, and no confidential contact data in the OpenAI payload.
- Added the final project-specific cover-letter prompt file at `cover_letter_instruction/cover_letter_prompt_instructions_project.md`.
- Added `OPENAI_COVER_LETTER_MODEL` to `.env.example`.
- Added tests for the explicit handoff routing, cover-letter prompt payload, and offer card UI action.

### MCP Calls Used

- None. The change used local project code and local instruction files only.

### Validation

- `pnpm test -- cover-letter offers-workspace`: passed, 2 suites and 3 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 31 test suites and 129 tests.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- None.

### Files Changed

- `.env.example`
- `cover_letter_instruction/cover_letter_prompt_instructions_project.md`
- `src/app/api/generate/route.ts`
- `src/components/offers-workspace.tsx`
- `src/lib/generate/cover-letter.ts`
- `tests/cover-letter.test.ts`
- `tests/offers-workspace.test.tsx`
- `STATUS.md`
- `DECISIONS.md`

### Risks And Open Questions

- Cover letters are stored through the existing generated document table and bucket paths because there is no dedicated cover-letter storage schema yet.
- The OpenAI payload excludes confidential contact data; the server injects contact details into the final letter after generation.
- Company enrichment from live web research is not implemented; the generator uses normalized offer/company fields already present in the project.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-22 - PDF Resume Page Budget Fix

Status: Bug fix complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Investigated the generated PDF layout issue where lower sections could be missing while the page still had blank space.
- Identified the root cause in `src/lib/export/simple-documents.ts`: PDF export used `wrapLines(...).slice(0, 52)`, a fixed wrapped-line cutoff unrelated to the actual page height.
- Replaced the fixed PDF line cutoff with a bottom-margin-aware page budget.
- Stopped emitting empty PDF text drawing commands for blank lines.
- Kept `MAX_GENERATED_RESUME_LINES` unchanged.
- Added a regression test proving `Certifications`, `Publications et projets`, and `Associations et centres d'intérêt` can render before the PDF bottom margin is reached.

### MCP Calls Used

- None. The issue was local to document rendering code and tests.

### Validation

- `pnpm test -- simple-documents`: passed, 1 suite and 11 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 29 test suites and 126 tests.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- None.

### Files Changed

- `src/lib/export/simple-documents.ts`
- `tests/simple-documents.test.ts`
- `STATUS.md`
- `DECISIONS.md`

### Risks And Open Questions

- The PDF generator still produces a one-page document only; content that physically exceeds the page height is intentionally omitted after the bottom margin.
- This fix targets PDF rendering. DOCX still relies on Word layout behavior and existing compact section limits.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-22 - AI Professional Objective Preservation

Status: Bug fix complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Investigated `OPENAI_GENERATION_INSTRUCTIONS` and `AI_SECTION_INSTRUCTIONS` in `src/lib/generate/tailored-resume.ts`.
- Identified the root cause: `enforceResumeLayout()` always replaced the AI-written `Objectif professionnel` with the deterministic local `buildProfessionalObjectiveLines()` template.
- Changed layout enforcement so the AI-written professional objective is preserved when present; the local objective is now only a fallback.
- Reworked `AI_SECTION_INSTRUCTIONS` for `Objectif professionnel` to require a natural, offer-specific, factual objective built from `candidateProfile`, `jobOffer`, and `matchingContext`.
- Added a regression test proving the AI-written objective is not overwritten by the local template.
- Fixed `tsconfig.json` by setting `checkJs` to `false`; TypeScript rejects `checkJs: true` when `allowJs` is `false`.

### MCP Calls Used

- None. The issue was local to prompt/layout code and tests.

### Validation

- `pnpm test -- tailored-resume`: passed, 1 suite and 8 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 29 test suites and 125 tests.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- None.

### Files Changed

- `src/lib/generate/tailored-resume.ts`
- `tests/tailored-resume.test.ts`
- `tsconfig.json`
- `STATUS.md`
- `DECISIONS.md`

### Risks And Open Questions

- The objective still depends on OpenAI following the stricter instruction, but the app no longer overwrites a good AI response with the local template.
- If OpenAI returns no objective, the deterministic local fallback remains in place to avoid an empty section.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-21 - Markdown And Text Corpus Imports

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Added Markdown and native text file support to authenticated CV source uploads.
- Canonicalized `.md` and `.markdown` uploads to `text/markdown`, including browsers that send Markdown as `text/plain`.
- Added direct UTF-8 text extraction for `text/plain`, `text/markdown`, `text/x-markdown`, and `application/markdown` without OCR.
- Updated overview upload/editor UI copy and file picker accept list to include Markdown and TXT.
- Added tests for upload validation, corpus extraction, and editor UI visibility.

### MCP Calls Used

- None. The change used local project code and tests only.

### Validation

- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 29 test suites and 124 tests.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- Added `supabase/migrations/202605210002_cv_originals_text_mime_types.sql`.
- Updates `cv-originals` allowed MIME types to include `text/plain`, `text/markdown`, `text/x-markdown`, and `application/markdown`.
- No RLS policy changes.

### Files Changed

- `src/app/api/upload/route.ts`
- `src/components/resume-editor-panel.tsx`
- `src/components/resume-upload-panel.tsx`
- `src/lib/upload/resume-files.ts`
- `src/lib/upload/resume-text-extractor.ts`
- `tests/resume-editor-panel.test.tsx`
- `tests/resume-files.test.ts`
- `tests/simple-documents.test.ts`
- `supabase/migrations/202605210002_cv_originals_text_mime_types.sql`
- `STATUS.md`
- `DECISIONS.md`

### Risks And Open Questions

- The storage migration still needs to be applied to the active Supabase project before deployed uploads accept the new MIME types.
- Text decoding assumes UTF-8, which matches the project requirement and common Markdown/TXT exports.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-07 - Word-Like One-Page Resume Export Styling

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Refactored `resume_template_instructions.md` so the final generated CV must use only level-3 section titles (`###`).
- Removed level-1 and level-2 final-layout headings from the template instructions.
- Updated OpenAI generation instructions to require a concise, one-page, ordered CV with these sections:
  - `Informations personnelles`
  - `Poste`
  - `Objectif professionnel`
  - `Compétences clés`
  - `Expérience professionnelle`
  - `Formation`
  - `Langues`
  - `Certifications`
  - `Publications et projets`
  - `Associations et centres d'intérêt`
- Added post-generation layout normalization to enforce:
  - all required sections are present;
  - only `###` section headings remain;
  - the exact job offer title stays centered;
  - per-section line caps keep the final resume concise.
- Updated `/api/generate` export calls so the exported PDF/DOCX starts from the final CV layout content, not an extra technical title line.
- Improved the dependency-free DOCX exporter:
  - renders headings instead of printing `###`;
  - uses Aptos font metadata;
  - sets different font sizes for body, headings, and centered job title;
  - centers the job title paragraph.
- Improved the dependency-free PDF exporter:
  - renders headings without `###`;
  - uses different font sizes for body, headings, and centered job title;
  - approximates centered placement for the job title;
  - avoids printing raw markdown/HTML markers.

### MCP Calls Used

- None. No dependency, schema, storage, or external API documentation change was needed.

### Validation

- Focused tests: `pnpm exec jest tests/tailored-resume.test.ts tests/simple-documents.test.ts --runInBand`: passed, 10 tests.
- `pnpm test`: passed, 17 test suites and 59 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `resume_template_instructions.md`
- `src/app/api/generate/route.ts`
- `src/lib/generate/tailored-resume.ts`
- `src/lib/export/simple-documents.ts`
- `tests/tailored-resume.test.ts`
- `tests/simple-documents.test.ts`
- `STATUS.md`

### Risks And Open Questions

- No new dependency was added. The exporter remains intentionally dependency-free.
- PDF centering and font sizing are approximate because the simple PDF writer does not have full font metrics.
- DOCX contains explicit font and size metadata and should look closer to a Word document than the PDF.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-07 - Resume Template Layout And UTF-8 Output

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Rewrote `resume_template_instructions.md` as valid UTF-8 with correct French accents and apostrophes.
- Refined the template instructions so generation first compares the candidate profile against the job offer, then applies the resume layout.
- Added explicit anti-hallucination rules to exclude unsupported facts and non-helpful template placeholders.
- Updated OpenAI generation instructions to require the exact template section order.
- Enforced the job title line as `<p align="center">**[exact offer title]**</p>` after generation, so the offer title remains strictly identical to the job offer.
- Added PDF/DOCX export support for centered title markup:
  - DOCX writes centered paragraph alignment.
  - PDF approximates centered placement.
  - Raw `<p align="center">` and `**` markup are stripped from exported document text.
- Updated PDF escaping so French accents are preserved instead of being decomposed and stripped.

### MCP Calls Used

- OpenAI docs skill was loaded because this modifies the OpenAI generation contract.
- No external MCP calls were required; no schema, storage, or provider API behavior changed.

### Validation

- Focused tests: `pnpm exec jest tests/tailored-resume.test.ts tests/simple-documents.test.ts --runInBand`: passed, 9 tests.
- `pnpm test`: passed, 17 test suites and 58 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `resume_template_instructions.md`
- `src/lib/generate/tailored-resume.ts`
- `src/lib/export/simple-documents.ts`
- `tests/tailored-resume.test.ts`
- `tests/simple-documents.test.ts`
- `STATUS.md`

### Risks And Open Questions

- PDF centering uses approximate text width because the dependency-free PDF exporter does not have font metrics.
- UTF-8 is preserved in stored content and DOCX. The simple PDF exporter supports common French Latin characters; unsupported symbols are still stripped for PDF safety.
- The OpenAI generator is instructed to maximize fit using profile-offer comparison, but generated CVs still require user review before sending.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-06 - OpenAI Tailored Resume Generation

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Refactored `/api/generate` to generate the tailored CV content with OpenAI using server-side `OPENAI_KEY`.
- Added `generateTailoredResumeDraftWithOpenAI()` beside the deterministic generator.
- The OpenAI generator uses:
  - `resume_template_instructions.md`;
  - extracted candidate profile sections;
  - the selected resume version corpus;
  - the normalized job offer;
  - a matching context built from matched skills, missing offer skills, relevant experiences, and ROME/title proximity.
- Added structured JSON output for `title`, `content`, `evidenceMap`, and `warnings`.
- Filtered OpenAI evidence snippets so only exact substrings present in the generated CV are stored.
- Kept the existing PDF/DOCX export and `generated_resumes` persistence flow.
- Added `OPENAI_GENERATE_MODEL` to `.env.example`, with fallback to `OPENAI_MODEL` and then `gpt-5.4`.
- Kept the deterministic generator for fallback evidence and focused unit coverage.

### MCP Calls Used

- OpenAI docs skill was used; no OpenAI docs MCP tool was available, so official OpenAI documentation was checked via web fallback for Responses API structured outputs and GPT-5.4 support.
- No Supabase MCP calls were needed because no schema, bucket, or RLS changes were made.

### Validation

- Focused test: `pnpm exec jest tests/tailored-resume.test.ts --runInBand`: passed, 3 tests.
- `pnpm test`: passed, 17 test suites and 57 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `.env.example`
- `src/app/api/generate/route.ts`
- `src/lib/generate/tailored-resume.ts`
- `tests/tailored-resume.test.ts`
- `STATUS.md`

### Risks And Open Questions

- `/api/generate` now requires a valid server-side `OPENAI_KEY`; if missing, it returns a French server error.
- OpenAI output is constrained by structured JSON and evidence filtering, but generated prose must still be reviewed before applying.
- The evidence map stores supported snippets, not a full sentence-level proof graph for every generated line.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-05 - PDF Text Extraction Quality Fix

Status: Fix complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Identified why some PDF corpus extraction produced unreadable or missing characters: the local parser does not decode embedded font glyph mappings or `ToUnicode` CMaps.
- Changed `/api/upload/[id]/extract-text` so PDF files use OpenAI PDF analysis first.
- Kept local PDF extraction as fallback only when OpenAI analysis is unavailable.
- Kept DOCX on local extraction because standard DOCX XML text is reliable.
- Kept image files on OpenAI OCR because local image text extraction is not possible.

### MCP Calls Used

- None. This was an implementation fix based on existing code behavior.

### Validation

- Focused tests: `pnpm exec jest tests/resume-ocr.test.ts tests/simple-documents.test.ts --runInBand`: passed, 8 tests.
- `pnpm test`: passed, 17 test suites and 56 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `src/app/api/upload/[id]/extract-text/route.ts`
- `STATUS.md`

### Risks And Open Questions

- PDF extraction now sends PDF bytes to OpenAI by default for better readability.
- If OpenAI is unavailable or `OPENAI_KEY` is missing, the endpoint falls back to the local parser for PDFs, which may still be imperfect on encoded-font PDFs.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-05 - Live GPT-5.4 CV Extraction Check

Status: Live validation complete. No additional refactor needed.

### Work Completed

- Ran a live OpenAI Responses API call with `gpt-5.4` against `Kévin  ESTEVES_cv_web1.pdf`.
- Sent the PDF as base64 `input_file` with structured JSON output.
- Verified the generated analysis Markdown contains:
  - `## Professional Experiences`
  - `## Skills`
- Verified both sections were non-empty in the live response.

### MCP Calls Used

- None. This was a direct live OpenAI API validation using the existing local `OPENAI_KEY`.

### Validation

- Live OpenAI response model: `gpt-5.4-2026-03-05`.
- `Professional Experiences` heading present: yes.
- `Skills` heading present: yes.
- `professionalExperiences` content length: 1207 characters.
- `skills` content length: 439 characters.
- Extraction warnings: 0.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `STATUS.md`

### Risks And Open Questions

- The CV content was sent to OpenAI for this authorized live validation.
- The validation report intentionally records only structural metadata, not CV content.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-05 - GPT-5.4 Section Heading Verification

Status: Refactor and validation complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Refactored resume section Markdown headings to match the requested copy/paste labels:
  - `Profile`
  - `Education`
  - `Professional Experiences`
  - `Skills`
  - `Certifications`
  - `Hobbies`
- Changed the default resume section extraction model to `gpt-5.4`.
- Reused the same default model constant in the API persistence layer so stored extraction rows record the same model when no override is set.
- Added tests that confirm the analysis Markdown contains `Professional Experiences` and `Skills`.
- Added a mocked OpenAI request test confirming `OPENAI_MODEL=gpt-5.4` is sent in the Responses API payload.
- Confirmed the profile draft parser still reads the English headings and maps them into profile fields.

### MCP Calls Used

- None in this pass. No schema, storage, or external documentation lookup was needed.

### Validation

- Focused test: `pnpm exec jest tests/resume-section-extractor.test.ts --runInBand`: passed, 4 tests.
- `pnpm test`: passed, 17 test suites and 56 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `src/app/api/profile/extract-sections/route.ts`
- `src/lib/profile/resume-section-extractor.ts`
- `tests/resume-section-extractor.test.ts`
- `STATUS.md`

### Risks And Open Questions

- The `gpt-5.4` verification is a deterministic mocked request test; it does not make a live OpenAI call.
- UI controls remain French, while the generated analysis Markdown now uses English section headings as requested.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-05 - OCR For Image And Image-Based PDF Sources

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Added PNG, JPG/JPEG, and WEBP support for uploaded CV sources.
- Updated the private `cv-originals` bucket allowed MIME types for image CV sources.
- Added OpenAI OCR fallback for image sources and PDFs that local text extraction cannot read.
- Image sources are sent to OpenAI as base64 `input_image`; PDFs are sent as base64 `input_file`.
- The OCR prompt returns only visible CV text, with no summaries, layout descriptions, inferred facts, or invented content.
- Added image preview support in the editor using Next Image with short-lived signed URLs.
- Added `OPENAI_OCR_MODEL` and `OPENAI_MODEL` placeholders to `.env.example`.
- Added tests for image upload validation and OpenAI OCR request payloads.

### MCP Calls Used

- OpenAI docs skill with official OpenAI documentation fallback via web browsing for Responses API image/file inputs.
- Supabase MCP: applied `cv_originals_image_ocr_mime_types` migration.
- Supabase MCP: checked security and performance advisors after storage configuration changes.

### Validation

- `pnpm test`: passed, 17 test suites and 54 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- Supabase security advisors: one existing Auth warning remains for leaked password protection disabled.
- Supabase performance advisors: only unused-index INFO items on empty/new tables.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050017_cv_originals_image_ocr_mime_types.sql`.
- Updated `cv-originals` allowed MIME types to include:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- No RLS policy changes.

### Files Changed

- `.env.example`
- `src/app/api/upload/[id]/extract-text/route.ts`
- `src/app/api/upload/route.ts`
- `src/components/resume-editor-panel.tsx`
- `src/components/resume-upload-panel.tsx`
- `src/lib/upload/resume-files.ts`
- `src/lib/upload/resume-ocr.ts`
- `src/lib/upload/resume-text-extractor.ts`
- `tests/resume-files.test.ts`
- `tests/resume-ocr.test.ts`
- `supabase/migrations/202605050017_cv_originals_image_ocr_mime_types.sql`
- `STATUS.md`

### Risks And Open Questions

- OCR sends image/PDF bytes to OpenAI when local extraction cannot read the file.
- OCR quality depends on scan quality, orientation, and handwriting/low-resolution artifacts.
- PDF OCR can increase token usage because OpenAI PDF parsing may include page images and extracted text in context.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-31 - Cover Letter Recipient Address

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Added company address resolution for cover-letter recipient lines.
- The generator now prefers a complete address found in the offer content or structured company fields.
- When the offer lacks a complete address and company research is enabled, the existing OpenAI `web_search` company research asks for `addressLine`, `postalCode`, and `city`.
- `recipientLines` now render the company, address line, then `code postal + ville` before the date block.
- Added Jest coverage for offer-extracted addresses, web-search addresses, and avoiding web search when the offer already has company context plus address.

### MCP Calls Used

- None. No external documentation, Supabase schema inspection, or provider documentation lookup was needed.

### Validation

- `pnpm test -- cover-letter`: passed, 1 suite and 5 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 31 suites and 134 tests.
- `pnpm run build`: passed.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `src/lib/generate/cover-letter.ts`
- `src/types/domain.ts`
- `tests/cover-letter.test.ts`
- `DECISIONS.md`
- `STATUS.md`

### Risks And Open Questions

- Address extraction from offer text is conservative and only accepts a complete French-style postal address.
- Web-search address lookup depends on `ENABLE_COVER_LETTER_COMPANY_RESEARCH=true`; when disabled and no address is present in the offer, no address is invented.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-06-01 - PDFKit Export Migration And Editable Generated Documents

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Migrated shared PDF generation to `pdfkit` while preserving the existing PDF/DOCX layout pipeline.
- Registered Arial body fonts and Cambria bold title fonts for generated PDFs, with built-in PDF fallbacks.
- Added authenticated `/api/generate/export` so edited generated content can be exported as PDF or DOCX.
- Added an inline generated-document editor in the offers workspace after CV or cover-letter generation.
- Added the requested confirmation popup before opening the editor for a generated CV or cover letter.
- Updated PDF text extraction to decode PDFKit embedded-font text with font-specific ToUnicode maps.
- Fixed cover-letter company research gating so only `ENABLE_COVER_LETTER_COMPANY_RESEARCH=true` enables web research; the deferred `web_search` tool payload remains explicit.

### MCP Calls Used

- None. The work used local source inspection and local Jest/build validation only.

### Validation

- `pnpm test -- simple-documents generated-document-export-route offers-workspace`: passed, 3 test suites and 16 tests.
- `pnpm test -- cover-letter`: passed, 1 test suite and 5 tests.
- Full Jest via `node .\node_modules\jest\bin\jest.js --runInBand`: passed, 32 test suites and 136 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- Build warning remains: Turbopack reports an existing file-tracing warning involving `next.config.ts` and `simple-documents.ts`; the production build still completes successfully.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `package.json`
- `pnpm-lock.yaml`
- `src/app/api/generate/export/route.ts`
- `src/components/offers-workspace.tsx`
- `src/lib/export/simple-documents.ts`
- `src/lib/generate/cover-letter.ts`
- `src/lib/upload/resume-text-extractor.ts`
- `tests/cover-letter.test.ts`
- `tests/generated-document-export-route.test.ts`
- `tests/offers-workspace.test.tsx`
- `tests/simple-documents.test.ts`
- `DECISIONS.md`
- `STATUS.md`

### Risks And Open Questions

- The editor regenerates a PDF/DOCX from editable source text; it is not a binary PDF editor for arbitrary existing PDFs.
- PDF font registration uses Windows font paths with built-in PDF fallback fonts when local fonts are unavailable.
- Several Node processes were already running in the environment; none were killed.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-06-18 - Local Playwright Auto-Apply Helper V2

Status: Phase complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Added a local helper script launched with `pnpm automation:helper`.
- The helper listens on `http://127.0.0.1:43789`, exposes `/health` and `/runs`, and opens headed Chromium on the user's machine.
- `/my-offers` now sends a minimized auto-apply payload to the local helper when the user clicks `Préparer la session`.
- The helper opens eligible application URLs, fills safe known fields such as email when detectable, stops before final submission, and returns manual-action results.
- Added a shared local-helper client contract that strips raw offer/resume content before sending data to localhost.
- Added unit coverage for the minimized helper payload.

### MCP Calls Used

- None. Local project files and the provided specification were sufficient for this phase.

### Validation

- `pnpm test -- auto-apply`: failed first on missing local-helper module, as expected for TDD.
- `pnpm test -- auto-apply offers-workspace`: passed, 2 test suites.
- Local helper `/health` smoke test: passed.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 37 test suites and 157 tests.
- `pnpm automation:test`: passed, 1 Playwright test.
- `pnpm run build`: passed.
- Build warning remains: existing Turbopack NFT tracing warning through `next.config.ts` and profile location extraction, unrelated to this phase.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `package.json`
- `scripts/auto-apply-helper.mjs`
- `src/automation/local-helper/client.ts`
- `src/components/offers-workspace.tsx`
- `tests/auto-apply.test.ts`
- `STATUS.md`
- `DECISIONS.md`

### Risks And Open Questions

- The helper intentionally does not click final submit.
- The helper currently fills only safe generic fields, starting with email; site-specific field mapping still requires tested strategies.
- Browser windows remain open for user review. The helper closes them when the helper process is stopped.
- Results are not persisted yet beyond the immediate UI message.

### Next Phase

Ready for user approval before implementing persisted auto-apply run results and site-specific field mapping.

## 2026-06-18 - Supervised Auto-Apply Foundation

Status: Phase complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Installed Playwright and Chromium for compliant browser automation.
- Added automation scripts for Playwright tests, headed runs, reports, and browser installation.
- Added `src/automation` foundation modules for run planning, eligible-offer collection, daily limit checks, logging redaction, manual handoff, CAPTCHA handoff, credential service placeholders, browser session creation, and ATS strategy selection.
- Added supervised strategy scaffolding for Generic, Greenhouse, Lever, Workday, and SmartRecruiters domains.
- Added `/my-offers` auto-apply start modal with daily limit, email, cover-letter mode, and explicit site-rule consent.
- Kept final submission in `review-before-submit` mode only; auto-submit without review is intentionally rejected for this version.
- Added `/my-applications` sections for auto-apply results and manual follow-up items using the current applications data model.
- Added Jest coverage for auto-apply planning, redaction, strategy selection, daily-limit behavior, offers UI, and applications UI.
- Added Playwright smoke coverage with a local fixture that fills fields and stops before final submit.

### MCP Calls Used

- None. Local project files and the provided specification were sufficient for this phase.

### Validation

- `pnpm automation:install-browsers`: passed, Chromium installed.
- `pnpm test -- auto-apply offers-workspace applications-workspace`: passed, 3 test suites and 14 tests.
- `pnpm automation:test`: passed, 1 Playwright test.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 37 test suites and 156 tests.
- `pnpm run build`: passed.
- Build warning remains: existing Turbopack NFT tracing warning through `next.config.ts` and profile location extraction, unrelated to this phase.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `package.json`
- `pnpm-lock.yaml`
- `playwright.config.ts`
- `automation-tests/auto-apply-smoke.spec.ts`
- `src/automation/**`
- `src/components/offers-workspace.tsx`
- `src/components/applications-workspace.tsx`
- `tests/auto-apply.test.ts`
- `tests/offers-workspace.test.tsx`
- `tests/applications-workspace.test.tsx`
- `STATUS.md`
- `DECISIONS.md`

### Risks And Open Questions

- This phase prepares supervised auto-apply runs but does not submit applications on external websites.
- Credential storage is intentionally a placeholder until the encrypted vault design and database schema are approved.
- Auto-apply result persistence needs a later migration to store strategy, reason, last step, trace metadata, and manual handoff details.
- Site-specific ATS strategies identify domains but hand off safely until each workflow has fixture tests and site-policy review.

### Next Phase

Ready for user approval before implementing persisted auto-apply runs, encrypted credential storage, and tested site-specific form filling.

## 2026-06-02 - Generated Document Render Order And Title Omission

Status: Bugfix complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Fixed PDFKit rendering order so generated PDF text starts near the top margin and flows downward.
- Stopped rendering the export title/filename argument inside generated PDF and DOCX content.
- Added regression coverage for PDF top-to-bottom drawing and title omission in generated documents.

### MCP Calls Used

- None. The issue was isolated in local document export code and verified with local tests.

### Validation

- `pnpm test -- pdfkit-runtime simple-documents`: passed, 2 test suites and 16 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 35 test suites and 145 tests.
- `pnpm run build`: passed.
- Build warning remains: existing Turbopack NFT tracing warning through `next.config.ts` and profile location extraction, unrelated to this fix.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `src/lib/export/simple-documents.ts`
- `tests/pdfkit-runtime.test.ts`
- `tests/simple-documents.test.ts`
- `STATUS.md`
- `DECISIONS.md`

### Risks And Open Questions

- The `title` argument is now filename/API metadata only for generated PDF/DOCX export. Visible titles must come from the content body itself.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-06-02 - PDFKit Font Initialization Fix

Status: Bugfix complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Fixed generated PDF rendering for CVs and cover letters by disabling PDFKit's default Helvetica initialization.
- Removed PDF standard-font fallbacks from the shared exporter so runtime rendering only uses registered application fonts.
- Added a regression test that fails if PDFKit is constructed before default font loading is disabled.

### MCP Calls Used

- None. The issue was isolated in local PDF export code and validated with local tests.

### Validation

- `pnpm test -- pdfkit-runtime simple-documents`: passed, 2 test suites and 14 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 35 test suites and 143 tests.
- `pnpm run build`: passed.
- Build warning remains: existing Turbopack NFT tracing warning through `next.config.ts` and profile location extraction, unrelated to this fix.

### Migrations, Buckets, Policies

- No migrations changed.
- No storage buckets changed.
- No RLS policies changed.

### Files Changed

- `src/lib/export/simple-documents.ts`
- `tests/pdfkit-runtime.test.ts`
- `STATUS.md`
- `DECISIONS.md`

### Risks And Open Questions

- PDF generation now requires the configured local font files to be available; on this Windows environment it uses Arial and Cambria paths.
- If the app is deployed to a non-Windows host later, bundled or configured font files should be added before deployment.

### Next Phase

Ready for user approval before any further implementation phase.

## 2026-05-05 - Resume Text Extraction And Section Persistence

Status: Enhancement complete. Waiting for user approval before any next implementation phase.

### Work Completed

- Added authenticated `/api/upload/[id]/extract-text` to extract editable corpus text directly from stored PDF/DOCX resume files.
- Wired `resume-editor-panel.tsx` so loading a CV with no saved version attempts to prefill the corpus textarea from the uploaded source file.
- Added dependency-free DOCX text extraction using ZIP/XML parsing.
- Added dependency-free basic PDF text extraction from text streams.
- Persisted OpenAI section extraction snapshots in a new owner-scoped `resume_section_extractions` table.
- `/api/profile/extract-sections` now stores extracted sections, Markdown content, warnings, model, source hash, and resume file/version references.
- Added extraction tests for generated PDF and DOCX buffers.

### MCP Calls Used

- Supabase MCP: inspected public tables before schema work.
- Supabase MCP: applied `resume_section_extractions` migration.
- Supabase MCP: verified the new table has RLS enabled.
- Supabase MCP: checked security and performance advisors after schema changes.

### Validation

- `pnpm test`: passed, 16 test suites and 50 tests.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- Supabase security advisors: one existing Auth warning remains for leaked password protection disabled.
- Supabase performance advisors: only unused-index INFO items on empty/new tables, including the new extraction indexes.

### Migrations, Buckets, Policies

- Added and applied `supabase/migrations/202605050016_resume_section_extractions.sql`.
- Created `public.resume_section_extractions` with RLS enabled.
- Added owner-only select, insert, update, and delete policies.
- Added indexes for user listing, resume file lookup, and resume version lookup.
- No storage buckets changed.

### Files Changed

- `src/app/api/profile/extract-sections/route.ts`
- `src/app/api/upload/[id]/extract-text/route.ts`
- `src/components/resume-editor-panel.tsx`
- `src/lib/upload/resume-text-extractor.ts`
- `tests/simple-documents.test.ts`
- `supabase/migrations/202605050016_resume_section_extractions.sql`
- `STATUS.md`

### Risks And Open Questions

- PDF extraction is text-stream based and will not extract scanned/image-only PDFs.
- DOCX extraction reads `word/document.xml`; unusual DOCX structures may need richer parsing later.
- Extracted section snapshots are persisted, but there is no separate UI history view yet.

### Next Phase

Ready for user approval before any further implementation phase.
