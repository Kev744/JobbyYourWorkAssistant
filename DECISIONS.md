# DECISIONS

## 2026-05-05 - Milestone Workflow

Decision: Implement the project one milestone at a time and pause for user approval before starting the next milestone.

Reason: `AGENTS.md` and `SPEC.md` both require approval before moving between phases.

## 2026-05-05 - Implementation Spec

Decision: Create `CODEX_SPEC_CV.md` as the implementation spec reconciled from `SPEC.md`, `SPEC_CV.md`, and `deep-research-report.md`.

Reason: `AGENTS.md` requires this file before implementation work, but it was missing from the repository.

## 2026-05-05 - Dependency Scope For Milestone 0

Decision: Limit production dependencies to Next.js, React, and Supabase packages during setup.

Reason: The project instructions require confirmation before adding new production dependencies beyond the approved stack. Parsing/export libraries will be selected in later milestones after approval.

## 2026-05-05 - Supabase JS Version

Decision: Use `@supabase/supabase-js@^2.105.3` instead of the requested `2.95.6`.

Reason: `pnpm install` reported that `2.95.6` is not published on npm. The spec permits compatible version adjustments when package availability requires it.

## 2026-05-05 - Node Engine

Decision: Add `node >=20.9.0` to `package.json` and `.nvmrc`.

Reason: Next.js 16 refuses to build on the local Node `18.20.3`, and the project spec requires Node `20.9.0`.

## 2026-05-05 - Turbopack Root

Decision: Set `turbopack.root` to `process.cwd()` in `next.config.ts`.

Reason: Next.js detected a parent `C:\Users\kevin\package-lock.json` and selected the user directory as the workspace root, causing Turbopack to scan protected folders and fail with access denied.

## 2026-05-05 - Supabase Publishable Key Name

Decision: Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser and SSR auth clients.

Reason: The local `.env` provides this current Supabase key name, and it avoids relying on the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` name.

## 2026-05-05 - Username Login

Decision: Implement email/password, sign-up, and magic-link flows now; store `username` on `profiles` but do not implement username-based login in Milestone 1.

Reason: Supabase Auth natively authenticates with email/password and OTP links. Username login would require a custom lookup flow and additional security review.

## 2026-05-05 - Jest Environment

Decision: Use Jest's `node` test environment by default.

Reason: The current tests are server/domain tests and need the Fetch `Response` global. UI tests can opt into jsdom when they are added.

## 2026-05-05 - CV Upload Scope

Decision: Implement Milestone 2 without adding parsing or export dependencies.

Reason: Upload only needs validation, checksum, Supabase Storage, and metadata persistence. PDF/DOCX parsing, preview, and export belong to Milestone 3 and will require separate dependency approval.

## 2026-05-05 - CV Originals Storage Paths

Decision: Store original CV files under `cv-originals/{user_id}/{uuid}.{ext}` and enforce storage RLS with `storage.foldername(name)[1] = auth.uid()::text`.

Reason: This keeps private CV files user-scoped and matches Supabase Storage RLS guidance for per-user folders.

## 2026-05-05 - CV Editor Export Dependencies

Decision: Do not add PDF/DOCX production dependencies in Milestone 3.

Reason: The project requires confirmation before adding production dependencies. A simple server-side text PDF generator and minimal DOCX package writer are sufficient for this milestone's save/export workflow.

## 2026-05-05 - DOCX Preview

Decision: Provide signed access and corpus editing for DOCX sources, but do not attempt direct in-browser DOCX rendering in Milestone 3.

Reason: Browser DOCX rendering would require an additional production dependency or external viewer. The product needs sensitive CV data to remain private, so avoiding external viewers is preferable.

## 2026-05-05 - Profile Generation Without LLM

Decision: Use a conservative local extractor for Milestone 4 instead of sending CV corpus text to an LLM.

Reason: The project forbids inventing facts and treats CV data as sensitive personal data. A local extractor preserves privacy and leaves unsupported fields blank with warnings.

## 2026-05-05 - ROME Prediction Fallback

Decision: Return `Inconnu` when France Travail ROMEo prediction is unavailable or below `scorePrediction < 0.7`.

Reason: This matches the product threshold and avoids fabricating a ROME code when the upstream service cannot be called or confidence is insufficient.

## 2026-05-05 - Requirements API Surface

Decision: Store and update profile requirements through `/api/profile` using `resource=requirements`.

Reason: The project specification lists `/api/profile` as the profile route and does not list a separate `/api/profile/requirements` endpoint.

## 2026-05-05 - City Option Payload

Decision: Load location data from the local CSV files server-side and cap the initial city datalist sent to the browser.

Reason: The commune CSV is large. This keeps the first UI usable while preserving a server-side source of truth for all commune data.

## 2026-05-05 - France Travail Offer Persistence

Decision: Keep Milestone 6 as a live authenticated provider search without database persistence or 24-hour caching.

Reason: The project plan assigns canonical offer storage, query history, deduplication, and cache invalidation to Milestone 8. This keeps the provider integration focused and avoids premature schema coupling.

## 2026-05-05 - France Travail Search Parameters

Decision: Map supported saved requirements to France Travail search parameters and omit unsupported filters from upstream calls.

Reason: Provider compatibility notes already tell users when criteria are source-specific or approximate. Sending only supported parameters avoids false precision and provider errors.

## 2026-05-05 - Standalone Typecheck

Decision: Run `next typegen` before `tsc --noEmit` in the `typecheck` script.

Reason: Next.js 16 generates route types under `.next/types`, and standalone TypeScript validation can fail against stale generated files unless route type generation runs first.

## 2026-05-05 - Adzuna France Market

Decision: Use the Adzuna France jobs endpoint, `/v1/api/jobs/fr/search/1`, for Milestone 7.

Reason: The product restricts job search to France and Monaco. The France market endpoint is the closest official Adzuna search surface for this phase, with an additional server-side France/Monaco normalization guard.

## 2026-05-05 - Adzuna Offer Persistence

Decision: Keep Adzuna as a live authenticated provider search without database persistence or cache writes in Milestone 7.

Reason: Query history, canonical offer storage, deduplication, and 24-hour provider caching are assigned to Milestone 8.

## 2026-05-05 - Offer Cache Ownership

Decision: Store provider offers canonically by `(source, source_offer_id)` while keeping search queries and search result rows owner-scoped by `user_id`.

Reason: Provider offers are public job data and can be deduplicated across searches, but search history and selected criteria are user-specific and must remain private.

## 2026-05-05 - Canonical Offer Writes

Decision: Allow authenticated users to create canonical `job_offers` rows they fetched, but do not allow unrestricted updates; duplicate offers are inserted with `ignoreDuplicates` and then selected.

Reason: This keeps the canonical `(source, source_offer_id)` deduplication behavior without an overly permissive RLS update policy.

## 2026-05-05 - Cache Freshness

Decision: Use a deterministic SHA-256 hash of `{ source, query }` and a 24-hour `expires_at` window for provider cache hits.

Reason: This makes cache lookup stable, provider-specific, and independent of object key order while matching the milestone's 24-hour cache requirement.

## 2026-05-05 - PRCV-R v1 Implementation

Decision: Implement PRCV-R v1 as deterministic local TypeScript scoring with no embeddings and no generative ranking.

Reason: The research protocol requires a single auditable weighted formula, deterministic caps/blockers, and no network or LLM ranking path in v1.

## 2026-05-05 - Match API Scope

Decision: `/api/match` scores offers from a cached search run, using either an explicit `queryId` or the latest user-owned cached search for the selected source.

Reason: Ranking should explain offers the user actually searched and should preserve stable search-run history rather than scoring unrelated global provider rows.

## 2026-05-05 - Ranking Persistence

Decision: Persist one `scored_offers` row per `(user_id, candidate_profile_id, job_offer_id)`.

Reason: Scores are specific to the user's confirmed profile and a canonical offer. Upserting by this tuple keeps repeated ranking idempotent while preserving owner-only access.

## 2026-05-05 - Tailored CV Generation

Decision: Generate tailored CVs with deterministic local composition from confirmed profile fields, the selected resume version, and source offer data.

Reason: The product forbids invented CV facts. A local deterministic generator with evidence entries keeps the result auditable and avoids exposing sensitive CV data to external generation services.

## 2026-05-05 - Generated Resume Exports

Decision: Export every generated CV as both PDF and DOCX into the private `generated-resumes` bucket.

Reason: The milestone requires PDF/DOCX output. Reusing the existing dependency-free document generator avoids adding production dependencies while preserving private signed-download access.

## 2026-05-05 - Application Status Model

Decision: Store application statuses as the stable internal enum values `pending`, `accepted`, and `refused`, and translate them to `En attente`, `Acceptée`, and `Refusée` at the UI boundary.

Reason: The database and API need stable English identifiers for tests and integration code, while the product UI must remain French-first.

## 2026-05-05 - Application Status History

Decision: Store status changes in `application_status_events` with owner-scoped RLS and insert a new event only when the current status changes.

Reason: This preserves an auditable timeline without generating noisy duplicate events for URL-only edits or idempotent saves.

## 2026-05-05 - Application Deletion

Decision: Deleting an application cascades to its status history but does not delete the generated resume or canonical job offer.

Reason: Applications are a tracking layer over generated CVs and public offer snapshots. Removing tracking history should not destroy generated artifacts the user may still need.

## 2026-05-05 - Application Skill Statistics

Decision: Compute application statistics from user-owned application offer snapshots by counting each skill at most once per application.

Reason: Percentages should mean the share of applications in a status that mention a skill. This avoids overweighting duplicated provider tags and keeps the UI descriptive rather than causal.

## 2026-05-05 - Statistics Storage

Decision: Do not add a statistics table in Milestone 12; calculate mini statistics on demand through `/api/statistics/applications`.

Reason: The requested output is small and derived from owner-scoped application rows. On-demand calculation avoids cache invalidation complexity while the dataset is still user-local.

## 2026-05-05 - Provider HTTP Resilience

Decision: Use a shared provider HTTP helper for timeouts, safe GET retries, 429 detection, and normalized French warnings.

Reason: France Travail and Adzuna should fail consistently without leaking credentials or raw upstream details, while safe GET retries reduce transient provider failures.

## 2026-05-05 - Local Environment Files

Decision: Ignore `.env` and `.env.*`, keep `.env.example` with placeholder names only, and avoid any client-prefixed secret variable names.

Reason: Local environment files may contain provider and Supabase credentials. They must not be committed, and server-side secrets must not be exposed through `NEXT_PUBLIC_*` names.

## 2026-05-05 - RLS Performance Hardening

Decision: Rewrite older owner RLS policies from `auth.uid()` to `(select auth.uid())` and add covering indexes for advisor-reported foreign keys.

Reason: Supabase advisors flagged per-row auth function evaluation and unindexed foreign keys. The rewrite preserves owner-only behavior while reducing avoidable query overhead.

## 2026-05-21 - Markdown And Text Corpus Imports

Decision: Treat Markdown and plain text files as editable corpus source files, canonicalizing `.md` and `.markdown` uploads to `text/markdown`.

Reason: These files already contain user-authored corpus text, so direct UTF-8 extraction is more reliable and cheaper than OCR or LLM parsing while preserving user formatting cues for later rich-text editing.

## 2026-05-22 - Preserve AI-Written Professional Objective

Decision: Preserve the AI-generated `Objectif professionnel` during final resume layout enforcement and use the deterministic local objective only when the AI section is empty.

Reason: The local layout step must remove unsafe or unsupported sections, but replacing a valid AI-written objective with a fixed template defeats the objective-specific prompt and makes generated resumes repetitive.

## 2026-05-22 - PDF Resume Page Budget

Decision: Fit generated PDF resume lines by actual page height instead of a fixed wrapped-line count.

Reason: A fixed line cap can remove lower resume sections while leaving visible blank space at the bottom of the PDF. A bottom-margin-aware budget preserves one-page output while using the available page area more accurately.

## 2026-05-30 - Explicit Generation Handoffs

Decision: Route `/api/generate` through explicit generation handoffs: `resume_generation` for targeted CVs and `cover_letter_generation` for motivation letters. Do not add automatic request classification yet.

Reason: The UI already knows which artifact the user requested through distinct buttons. Explicit routing avoids ambiguous generation behavior while still creating a global generation agent boundary that can grow later.

## 2026-05-30 - Cover Letter Contact Handling

Decision: Exclude confidential contact fields from the OpenAI cover-letter payload and inject them server-side into the final letter layout.

Reason: The model needs professional evidence and offer context to write the letter body, but it does not need email or phone data. Server-side composition preserves factual contact details while reducing unnecessary exposure.

## 2026-05-30 - Conditional Company Research For Cover Letters

Decision: Use OpenAI `web_search` for cover-letter company context only when enabled and when the job offer does not already contain useful company values, CSR/RSE, labels, mission, culture, or working-style information.

Reason: The offer itself is the strongest source when it already contains company positioning. Conditional research avoids unnecessary web calls, reduces cost and latency, and prevents external context from diluting explicit offer wording.

## 2026-05-30 - Cover Letter Export Alignment

Decision: Treat the alignment hints emitted by `buildCoverLetterContent()` as internal export layout instructions and render them in PDF/DOCX instead of printing them as text.

Reason: The cover-letter generator owns the document structure, while the shared exporter owns file-specific layout. Supporting `<div align="right">` and `<div align="justify">` in the exporter preserves the intended address/date/signature indentation for both formats without exposing raw markup to the final document.

## 2026-05-31 - Cover Letter Recipient Address

Decision: Resolve a company postal address before composing cover-letter recipient lines. Prefer an address already present in the offer content or structured company fields; otherwise, when company research is enabled, ask OpenAI `web_search` for a reliable current address and render it as address line then postal code plus city.

Reason: The final letter needs a professional recipient block, but company addresses must not be invented. Reusing the existing company-research handoff keeps the search server-side and only inserts address lines when a complete address is available.

## 2026-06-01 - PDFKit Document Export And Editing

Decision: Generate native PDF exports with PDFKit and let users edit the generated source text before downloading a regenerated PDF or DOCX.

Reason: PDFKit gives the project a maintained PDF rendering layer with embedded fonts and structured drawing instead of hand-built PDF syntax. Editing the source text before export is a safer user workflow than attempting binary in-place PDF edits, and it keeps the existing one-page CV and aligned cover-letter layout rules centralized in the shared exporter.

## 2026-06-02 - Session-Only OpenAI Key Override

Decision: Let users enter an OpenAI API key in the offers workspace and send it only with the current CV or cover-letter generation request.

Reason: This allows generation without requiring a server-side `OPENAI_KEY`, while avoiding persistence of user secrets in Supabase or exposure of server environment secrets to the browser. The server still falls back to `OPENAI_KEY` when the field is blank.

## 2026-06-02 - Generated Document Integrity Guards

Decision: Validate generated PDF and DOCX bytes before returning or uploading them.

Reason: CV and cover-letter downloads should fail early with a clear server error if rendering produces malformed binary output. PDF validation checks the core xref/trailer structure, and DOCX validation checks the ZIP container and required Word document entries.

## 2026-06-02 - PDFKit Registered Fonts Only

Decision: Construct PDFKit documents with default font loading disabled and render generated PDFs only with fonts explicitly registered by the application.

Reason: In the Next.js runtime, PDFKit can resolve its built-in Helvetica metrics through an invalid `C:\ROOT\node_modules\...` path before application font registration runs. Disabling default font initialization prevents the ENOENT runtime failure and keeps CV/cover-letter rendering aligned with the required Arial/Cambria layout.

## 2026-06-02 - Export Title As Metadata Only

Decision: Treat the generated document `title` argument as export metadata for filenames/API routing, not as visible PDF or DOCX body content.

Reason: The tailored CV and cover-letter body already contains the user-facing title and sections. Prepending the export title caused filenames such as `CV cible` to appear in the final document and made the generated file less professional.

## 2026-06-02 - PDFKit Top-Down Coordinates

Decision: Render PDFKit document lines from the top margin downward using increasing y-coordinates.

Reason: PDFKit uses a top-left coordinate system. The previous bottom-left coordinate flow from the hand-built PDF renderer made generated PDFs appear visually reversed from bottom to top.

## 2026-06-18 - Supervised Auto-Apply Boundary

Decision: Implement auto-apply as a supervised Playwright workflow with `review-before-submit` as the only enabled mode in the first implementation slice.

Reason: External job websites can contain CAPTCHA, bot challenges, login walls, policy warnings, and sensitive questions. The application must not bypass those controls or submit unclear answers. A supervised workflow lets the product prepare and fill only confirmed data while stopping for manual review, manual challenge solving, and unsupported forms.

## 2026-06-18 - Auto-Apply Persistence Deferred

Decision: Add the automation module architecture and UI preparation flow before adding auto-apply persistence, credential vault storage, or site-specific submission strategies.

Reason: Persisting traces, credentials, and detailed automation results requires an approved schema, encryption model, retention policy, and RLS review. The first slice creates a testable, compliant foundation without storing secrets or attempting unreviewed submissions.

## 2026-06-18 - Localhost Playwright Helper

Decision: Run V2 auto-apply through a local Node/Playwright helper on `127.0.0.1:43789` instead of launching Playwright inside the Next.js browser client.

Reason: Browser client code cannot launch Playwright. A local helper opens headed Chromium on the user's machine, keeps the user in control, and avoids server-side browsers that the user cannot see. The web app sends only a minimized run payload to localhost and the helper stops before final submission.
