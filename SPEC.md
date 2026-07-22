# SPEC.md — Long-Horizon Codex Specification

## Project

Build a French-first web application that helps a user upload a CV, transform it into a structured professional profile, search job offers from France Travail and Adzuna, rank offers against the CV with an explainable deterministic protocol, generate a tailored CV for a selected offer, and track applications over time.

This file is the **source of truth** for Codex. Treat it as the stable project memory for a long-running implementation. Before coding, create and maintain the following durable project-memory files:

- `PLAN.md` — milestone plan, acceptance criteria, validation commands, and current checkpoint.
- `IMPLEMENT.md` — execution runbook, implementation order, commands to run, and constraints.
- `STATUS.md` — live status log, completed work, decisions, failures, fixes, and next step.
- `DECISIONS.md` — architecture decisions, trade-offs, and unresolved questions.

Do not rely on one large prompt. Work milestone by milestone: plan, implement, validate, repair, document, then ask the user before continuing to the next milestone.

---

## Product objective

Create an AI-assisted job-application dashboard for the **French and Monaco job markets only**. The product must:

1. Authenticate users.
2. Let users upload, edit, export, and version their CV.
3. Extract a structured professional profile from the CV.
4. Let users define job-search requirements.
5. Search public offers from France Travail.
6. Search private offers from Adzuna.
7. Store and cache job offers in Supabase.
8. Rank offers against the CV with a deterministic, explainable protocol.
9. Generate a tailored French CV for a selected offer without inventing facts.
10. Track applications, generated CVs, offer content, offer URLs, and status.
11. Show simple application statistics.

The user interface must be in **French**. Code, identifiers, API route names, and comments may be in English, following TypeScript/JavaScript conventions.

---

## Tech stack

Use the stack specified by the user unless current official documentation or package availability requires a compatible patch version:

- Next.js 16
- React with App Router / Route Handlers
- Tailwind CSS 4.2
- Supabase 2.95.6
- Node.js 20.9.0
- TypeScript 6.0.3
- Jest for tests
- ESLint and Prettier

Before implementing unfamiliar or version-sensitive APIs, consult the appropriate MCP server and record the documentation source in `STATUS.md`.

---

## MCP usage policy

Use MCP servers when the implementation depends on current documentation, schema inspection, or third-party integration details.

| MCP server | Use when |
|---|---|
| `Context7` | Next.js 16, App Router, Route Handlers, Server Actions, Tailwind 4.2, TypeScript, Jest, PDF/DOCX libraries, editor libraries, or any library API uncertainty. |
| `Supabase` | Auth setup, storage buckets, database schema, Row Level Security policies, migrations, inspecting project state, or validating Supabase-specific queries. |
| `DuckDuckGo` | France Travail, ROMEo, Adzuna, INSEE/COG, ESCO, RNCP, CECRL, official API docs, and any external documentation not available through Context7. |

Rules:

- Never paste raw secrets into Context7 or DuckDuckGo queries.
- Keep all non-public environment variables server-side only.
- If official API docs contradict this spec, follow official docs and log the change in `DECISIONS.md` before implementation.
- If a requested field is unsupported by an upstream API, use it only for the API that supports it, then omit it or post-filter results for the other source.

---

## Environment variables

The original spec listed these environment variables:

```env
FRANCE_TRAVAIL_CLIENT_ID=
FRANCE_TRAVAIL_CLIENT_KEY=
ADZUNA_API_ID=
ADZUNA_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
```

Security requirements:

- `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_KEY`, `ADZUNA_API_ID`, and `ADZUNA_API_KEY` are server-only.
- Never expose provider keys in client bundles, logs, browser-visible errors, screenshots, telemetry, or generated files.
- `NEXT_PUBLIC_SUPABASE_URL` may be public by design, but all database writes must still be protected by Supabase Auth and RLS.
- Do not hard-code secrets in source files.

Recommended additions to confirm with the user before implementation:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Notes:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is normally needed for browser-side Supabase Auth flows.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and should be used sparingly, never in client code.
- `OPENAI_API_KEY` is only needed if the app itself calls an LLM for profile extraction or tailored CV generation. Codex being used to build the app does not automatically give the running app an AI provider.

---

## Naming conventions

- Functions and variables: `camelCase` — `getUserProfile`, `generateTailoredResume`.
- Classes and React components: `PascalCase` — `ResumeParser`, `GenerationService`, `ProfileDetailsForm`.
- Constants: `UPPER_SNAKE_CASE` — `MAX_FILE_SIZE`, `SUPPORTED_FORMATS`.
- API route folders: lowercase kebab-case where useful — `/api/offers/france-travail`.
- Database tables: snake_case — `job_offers`, `generated_resumes`.
- TypeScript interfaces/types: `PascalCase` — `CandidateResume`, `JobOffer`, `ScoreBreakdown`.

---

## Non-negotiable product constraints

1. **French UI only**: labels, messages, buttons, validation errors, empty states, and generated CV content must be in French.
2. **France and Monaco only**: no job offers outside France or Monaco; no foreign-market recommendations.
3. **Factual accuracy**: never invent experience, employers, dates, diplomas, certifications, skills, languages, or contact details.
4. **Human control**: AI outputs are drafts until the user confirms them.
5. **Authenticated APIs**: every application API route must require an authenticated user unless explicitly public by design.
6. **User isolation**: every stored CV, profile, generated CV, application, and cached search must be tied to a user ID and protected by RLS.
7. **Explainable ranking**: job-offer ranking must use the deterministic protocol in `deep-research-report.md`, not a generative LLM score.
8. **No hidden discrimination**: identity data such as name, age, family situation, photo, nationality, birth date, or exact address must not be used for ranking.
9. **Validation before progress**: run lint, typecheck, tests, and relevant build checks after each milestone.
10. **Pause between milestones**: after each milestone, update `STATUS.md` and ask the user before continuing.

---

## Privacy and safety requirements

- Store only data necessary for CV tailoring, offer matching, application tracking, and user-requested exports.
- Keep identity/contact details separate from the ranking payload.
- Do not include personal contact details in scoring features.
- Do not send full raw CV text to any third-party service unless the user has accepted that provider and the provider is required for extraction/generation.
- Store AI extraction/generation outputs with provenance:
  - source CV version ID,
  - source offer ID,
  - generation timestamp,
  - model/provider if applicable,
  - user confirmation status.
- For any destructive action, show a French confirmation dialog.
- Generated CVs must include only user-confirmed or source-supported facts.

---

## Application pages and navigation

Use French page names in the UI. Suggested route names can stay English.

| UI page | Suggested route | Purpose |
|---|---|---|
| `Vue d’ensemble` | `/overview` | Upload CV, edit corpus, generate profile. |
| `Profil` | `/profile` | Profile details and profile requirements. |
| `Mes offres` | `/my-offers` | Tabs for France Travail and Adzuna offers, ranked and filterable. |
| `Mes candidatures` | `/my-applications` | Generated CVs, offer content, URLs, statuses, delete flow. |
| `Statistiques` | section on `/my-applications` | Skill summaries based on accepted/refused application statuses. |

Layout requirements:

- Responsive dashboard layout.
- Clear sidebar or top navigation.
- French empty states.
- Loading states for upload, extraction, offer search, scoring, generation, and exports.
- Accessibility basics: semantic headings, keyboard-friendly controls, visible focus states, aria labels where needed.

---

## Core user flow

1. User signs in.
2. User uploads a CV PDF/DOCX or provides a career corpus.
3. User edits extracted CV/corpus content.
4. User exports a revised PDF/DOCX if desired.
5. User clicks `Générer le profil`.
6. App extracts structured profile details and search requirements.
7. User reviews and edits the profile.
8. User clicks `Rechercher des offres`.
9. App fetches offers from France Travail and Adzuna using compatible filters.
10. App stores offers and search runs in Supabase.
11. App ranks offers deterministically against the structured CV/profile.
12. User selects an offer and clicks `Générer un CV`.
13. App generates a tailored one-page French CV using only factual CV/profile data and offer requirements.
14. User reviews, exports, and optionally stores the generated CV as an application.
15. User tracks each application as `Acceptée`, `En attente`, or `Refusée`.
16. User views top skill summaries from accepted and refused applications.

---

## Database and storage model

Use Supabase Postgres plus Supabase Storage.

### Storage buckets

| Bucket | Purpose |
|---|---|
| `cv-originals` | Original uploaded CV files. |
| `cv-versions` | Edited CV/corpus exports. |
| `generated-resumes` | Generated tailored CV exports, PDF and DOCX. |

Bucket rules:

- Files are scoped by user ID path prefix, for example `user_id/resume_id/file.pdf`.
- Buckets are private by default.
- Generate signed URLs only for the authenticated owner.

### Tables

Suggested tables:

```text
profiles
resume_files
resume_versions
candidate_profiles
profile_requirements
job_search_queries
job_offer_sources
job_offers
job_offer_search_results
scored_offers
generated_resumes
applications
application_status_events
taxonomy_versions
```

### Table responsibilities

| Table | Purpose |
|---|---|
| `profiles` | One row per authenticated user; app metadata only. |
| `resume_files` | Original uploaded files, storage path, MIME type, size, checksum. |
| `resume_versions` | Edited corpus versions and generated export paths. |
| `candidate_profiles` | Structured profile details extracted from CV and edited by user. |
| `profile_requirements` | User search filters and preferences. |
| `job_search_queries` | Query parameter hash, source, user ID, run timestamp, cache expiry. |
| `job_offer_sources` | Provider metadata: France Travail, Adzuna. |
| `job_offers` | Canonical job offer entity, deduplicated by source + source offer ID. |
| `job_offer_search_results` | Join table preserving each search run and ordering. |
| `scored_offers` | Score breakdown and matched/missing features for a user/profile/search run. |
| `generated_resumes` | Tailored CV content, export paths, source offer, source CV/profile version. |
| `applications` | Offer + generated CV + user application status. |
| `application_status_events` | Status history for auditability. |
| `taxonomy_versions` | ROME/ESCO/RNCP/COG/local dictionary versions used by scoring. |

RLS requirements:

- Users can only read/write their own rows.
- Service-role operations must validate the authenticated user server-side before writing.
- No public access to CVs, generated resumes, or offer scoring tied to a user.

---

## API routes

All routes require authentication unless noted otherwise.

| Route | Methods | Purpose |
|---|---:|---|
| `/api/upload` | `POST`, `GET`, `PUT`, `DELETE` | Upload, retrieve metadata, update, or delete CV files/versions. |
| `/api/profile/generate` | `POST` | Generate structured profile from selected CV/corpus version. |
| `/api/profile` | `GET`, `PUT` | Read/update profile details and profile requirements. |
| `/api/rome/predict` | `POST` | Predict `codeRome` from profession/title using France Travail ROMEo. |
| `/api/offers/france-travail` | `GET` | Fetch/search France Travail offers using profile filters. |
| `/api/offers/adzuna` | `GET` | Fetch/search Adzuna offers using profile filters. |
| `/api/offers/cache` | `GET`, `POST` | Read cached offers or refresh stored results. |
| `/api/match` | `POST` | Rank stored/fetched offers against the structured CV/profile. |
| `/api/generate` | `POST` | Generate a tailored French CV for one selected offer. |
| `/api/applications` | `GET`, `POST` | List/create tracked applications. |
| `/api/applications/[id]` | `GET`, `PUT`, `DELETE` | View/update/delete one application. |
| `/api/statistics/applications` | `GET` | Compute application skill summaries. |

Route Handler rules:

- Validate all inputs with TypeScript-safe schemas.
- Reject unauthenticated requests.
- Check ownership for every resource ID.
- Never return provider keys or raw auth tokens.
- Normalize errors into French user-facing messages and English developer logs.
- Include server-side rate limiting or debounce for expensive search/generation routes.

---

## Authentication milestone

### Goal

Add simple authentication with username/email + password and magic link.

### Clarified implementation

Supabase Auth commonly uses email/password and magic link. If the product requires a visible `username`, store it in the user profile, but still use email as the primary login identifier unless a custom username-login strategy is explicitly approved.

### UI labels

- `Connexion`
- `Adresse e-mail ou nom d’utilisateur`
- `Mot de passe`
- `Se connecter`
- `Recevoir un lien magique`
- `Créer un compte`
- `Se déconnecter`

### Acceptance criteria

- User can create an account.
- User can sign in with password.
- User can request a magic link.
- Authenticated user can access protected pages.
- Unauthenticated user is redirected to sign-in.
- API routes reject unauthenticated requests.
- Supabase RLS protects user-scoped tables.

### Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

---

## CV upload milestone

### Goal

On `Vue d’ensemble`, welcome the user and ask for a CV or career corpus. The user can add, amend, replace, export, and delete it later.

### Requirements

- Accept PDF and DOCX at minimum.
- Store original file in `cv-originals`.
- Store metadata in `resume_files`.
- Compute checksum to avoid duplicate uploads.
- Show upload status and validation errors in French.
- Support `POST`, `GET`, `PUT`, and `DELETE` on `/api/upload`.
- Keep old versions unless the user explicitly deletes them.

### Suggested UI copy

- `Importez votre CV`
- `Déposez un fichier PDF ou DOCX, ou décrivez votre parcours.`
- `Remplacer le fichier`
- `Supprimer le CV`
- `Fichier envoyé avec succès`

### Acceptance criteria

- Uploaded CV appears in the overview page.
- File is stored in Supabase Storage under the authenticated user path.
- File metadata is stored in Supabase.
- User cannot access another user’s file.
- Delete action requires confirmation.

---

## CV corpus editor milestone

### Goal

Let the user edit the CV content/career corpus and export the revised result as PDF and DOCX.

### Clarified implementation

A full in-PDF editor is heavy and can be fragile. Prefer this staged implementation:

1. Display the uploaded PDF/DOCX preview.
2. Extract or let the user enter a structured editable corpus beside the preview.
3. Provide rich-text formatting for the editable corpus.
4. Regenerate clean PDF and DOCX exports from the edited corpus.

This satisfies the product goal while keeping the CV source auditable and exportable.

### Requirements

- On `Vue d’ensemble`, show upload/preview and editor side by side.
- Save edited corpus as a new `resume_versions` row.
- Export to PDF and DOCX, not legacy `.doc`.
- Store exports in `cv-versions`.
- Add button `Générer le profil`.

### Acceptance criteria

- User can edit text and basic formatting.
- User can save a new version.
- User can export PDF and DOCX.
- User can trigger profile generation from a chosen version.

---

## Profile generation milestone

### Goal

Generate and store a structured professional profile from the selected CV/corpus version.

### Profile page structure

The `Profil` page has two major sections:

1. `Détails du profil`
2. `Critères de recherche`

### Détails du profil

Show and store the following French sections:

| UI section | Internal field |
|---|---|
| `Profil` | `summary` |
| `Profession` | `profession` |
| `Formation` | `education` |
| `Expériences professionnelles` | `professionalExperiences` |
| `Centres d’intérêt` | `hobbies` |
| `Certifications` | `certifications` |
| `Compétences` | `skills` |
| `Langues` | `languages` |
| `Réalisations` | `achievements` |
| `Code ROME` | `romeCode` |

Generation rules:

- Leave a segment blank if the CV does not support it.
- Canonicalize skills, certifications, hobbies, and profession when possible.
- Rephrase for clarity, but do not add unsupported facts.
- Let the user edit every section before saving.
- Store confirmed profile data in `candidate_profiles`.
- Keep identity/contact data separate from scoring fields.

### ROME code

Use France Travail ROMEo prediction for the `codeRome` from profession/title.

- If `scorePrediction < 0.7`, store and display `Inconnu`.
- If `scorePrediction >= 0.7`, store the predicted ROME code.
- If official docs do not provide refresh tokens, cache and refresh access tokens according to the documented OAuth flow instead of inventing a refresh-token flow.

### Candidate profile TypeScript shape

```ts
export type RemoteMode = "onsite" | "hybrid" | "remote";
export type Cecrl = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface LocationRef {
  city?: string;
  postalCode?: string;
  inseeCode?: string;
  departmentCode?: string;
  regionCode?: string;
  lat?: number;
  lon?: number;
  remotePreference?: RemoteMode;
  maxCommuteKm?: number;
}

export interface SkillItem {
  raw: string;
  canonicalSkillId?: string;
  level?: "basic" | "intermediate" | "advanced" | "expert";
  lastUsedDate?: string | null;
}

export interface CandidateResume {
  candidateId: string;
  headline: string;
  location?: LocationRef;
  targetSalary?: { minAnnualGrossEur?: number; maxAnnualGrossEur?: number };
  titles: Array<{ raw: string; canonicalRomeCode?: string }>;
  experiences: Array<{
    titleRaw: string;
    canonicalRomeCode?: string;
    startDate?: string;
    endDate?: string | null;
    summary?: string;
    skills?: SkillItem[];
  }>;
  skills: SkillItem[];
  education: Array<{ degreeLabel: string; rncpLevel?: number; field?: string }>;
  certifications?: Array<{ label: string; rncpCode?: string; rsCode?: string; expiryDate?: string | null }>;
  languages?: Array<{ code: string; cecrl?: Cecrl }>;
  softSkills?: string[];
  keywords?: string[];
}
```

### Acceptance criteria

- Profile is generated from the selected CV/corpus version.
- Unsupported fields remain blank.
- User can edit and save all sections.
- ROME code is predicted or marked `Inconnu` with threshold logic.
- Profile data is associated with the authenticated user.

---

## Profile requirements milestone

### Goal

Let the user configure job-search filters that are compatible with France Travail and Adzuna.

### Location data

Use the workspace CSV files:

- `communes-france-2025.csv`
- `departements-france.csv`

Requirements:

- Provide searchable dropdowns for city, department, and region.
- Store INSEE/COG codes when available.
- Support France and Monaco only.
- Do not use exact street address for scoring.

### Shared filters

Suggested UI fields:

| French UI label | Internal field | Notes |
|---|---|---|
| `Métier ou mots-clés` | `keywords` | Use profession or free text. |
| `Code ROME` | `romeCode` | Use if not `Inconnu`. |
| `Ville` | `city` | From CSV. |
| `Département` | `departmentCode` | From CSV. |
| `Région` | `regionCode` | Derived from location data if available. |
| `Rayon` | `radiusKm` | Use only for APIs that support radius/distance. |
| `Expérience` | `experience` | Map to provider-supported values. |
| `Disponibilité` | `availabilityDate` | Store in profile; use upstream only if supported. |
| `Type de contrat` | `contractType` | CDI, CDD, alternance, stage, intérim, freelance if supported. |
| `Temps de travail` | `workingTime` | Full-time/part-time. |
| `Salaire souhaité` | `salaryMinAnnualGrossEur` | Convert units before matching. |
| `Télétravail` | `remotePreference` | Use for scoring and upstream if supported. |
| `Handicap accepté` | `disabledAccepted` | France Travail if supported. |
| `Nom de l’entreprise` | `companyName` | Adzuna if supported, otherwise server-side post-filter. |

### Provider compatibility rule

When a filter is unsupported by a provider:

- Do not break the search.
- Omit the parameter for that provider.
- Apply post-filtering only if it does not mislead the user.
- Show a small French note if a filter applies only to one source.

### Acceptance criteria

- User can save requirements.
- Search button `Rechercher des offres` triggers both providers.
- Unsupported filters are handled gracefully.
- Saved filters are reused on next visit.

---

## France Travail offers milestone

### Goal

Fetch public job offers from France Travail into the `Offres publiques` tab on `Mes offres`.

### Requirements

- Use official France Travail documentation for the current OAuth and endpoint behavior.
- Use server-side token handling only.
- Cache access tokens until expiry; refresh them according to official docs.
- Do not assume a refresh token exists unless official docs explicitly provide one.
- Use `FRANCE_TRAVAIL_CLIENT_ID` and `FRANCE_TRAVAIL_CLIENT_KEY` from `.env`.
- Search by `codeRome` when available.
- If `codeRome` is `Inconnu`, search using the profile `Profession` as keywords.
- Use profile requirements as query parameters when supported.
- Retrieve at least:
  - offer ID,
  - title,
  - description,
  - experience,
  - city/location,
  - wage/salary,
  - contract type,
  - publication date if available,
  - application URL,
  - source metadata.
- Normalize into the internal `JobOffer` shape.
- Add a button `Générer un CV` on each offer.

### UI

- Page: `Mes offres`
- Tab: `Offres publiques`
- Sidebar/card: `Offre publique`

### Acceptance criteria

- `/api/offers/france-travail` returns normalized offers for the authenticated user query.
- Results are stored or linked to a search run.
- Offers outside France/Monaco are excluded.
- Each offer has an application URL when provider data includes one.
- User sees a clear empty/error state in French.

---

## Adzuna offers milestone

### Goal

Fetch private job offers from Adzuna into the `Offres privées` tab on `Mes offres`.

### Requirements

- Use Adzuna REST API server-side only.
- Use the France country endpoint where appropriate, for example `/jobs/fr/search/{page}` after verifying current docs.
- Use `ADZUNA_API_ID` and `ADZUNA_API_KEY` from `.env`.
- Use profile requirements as query parameters when supported.
- At minimum, map:
  - `what` from profession/keywords,
  - `where` from selected city/department/region,
  - `salary_min` from salary preference when supported,
  - `full_time` / part-time equivalent when supported,
  - `permanent` / contract filters when supported.
- Retrieve at least:
  - offer ID,
  - title,
  - description snippet,
  - city/location,
  - wage/salary,
  - contract type,
  - company name when available,
  - redirect/application URL,
  - publication date when available,
  - source metadata.
- Normalize into the internal `JobOffer` shape.
- Add a button `Générer un CV` on each offer.

### UI

- Page: `Mes offres`
- Tab: `Offres privées`
- Sidebar/card: `Offre privée`

### Acceptance criteria

- `/api/offers/adzuna` returns normalized offers for the authenticated user query.
- Results are stored or linked to a search run.
- Offers outside France/Monaco are excluded.
- Each offer has an application URL when provider data includes one.
- User sees a clear empty/error state in French.

---

## Offer storage and 24-hour cache milestone

### Goal

Store fetched job offers and avoid unnecessary upstream API calls.

### Cache rules

Refresh provider data only:

1. on first visit/search for a new query,
2. automatically when cached data is older than 24 hours,
3. when the user explicitly clicks refresh,
4. when the user changes the job-search query parameters.

### Deduplication rules

- Keep a new `job_search_queries` row for each distinct query/run.
- Deduplicate canonical `job_offers` by `(source, source_offer_id)`.
- Preserve search-run history in `job_offer_search_results`.
- If manual refresh returns an already-known offer, update mutable fields and attach it to the new run instead of creating misleading duplicates.

### Acceptance criteria

- Repeated visits within 24 hours use cached results.
- Refresh after 24 hours calls providers again.
- Manual refresh works.
- Changed filters create a new query/run.
- Search history remains auditable.

---

## Ranking and scoring milestone

### Goal

Classify offers from Adzuna and France Travail according to the deterministic protocol from `deep-research-report.md`.

### Key rule

Do **not** ask a generative model to decide ranking. Generative AI may help parse text into structured fields, but final ranking must be deterministic, explainable, and reproducible.

### Internal offer shape

```ts
export type Importance = "must" | "should" | "nice";

export interface JobOffer {
  offerId: string;
  source: "france_travail" | "adzuna";
  sourceOfferId: string;
  publishedAt?: string;
  title: string;
  description: string;
  company?: { name?: string };
  location: LocationRef;
  remoteMode?: RemoteMode;
  contract?: { type?: string; weeklyHours?: number; workingTime?: string };
  salary?: { minAnnualGrossEur?: number; maxAnnualGrossEur?: number; isPredicted?: boolean };
  jobTarget: { rawTitle: string; canonicalRomeCode?: string };
  skills: Array<SkillItem & { importance?: Importance }>;
  experienceRequirement?: { minYears?: number };
  educationRequirements?: Array<{ degreeLabel?: string; rncpLevel?: number; field?: string; mandatory?: boolean }>;
  certificationRequirements?: Array<{ label: string; mandatory?: boolean }>;
  languageRequirements?: Array<{ code: string; minCecrl?: Cecrl; mandatory?: boolean }>;
  softSkills?: string[];
  keywords?: string[];
  legalRequirements?: string[];
  applicationUrl?: string;
}
```

### Score breakdown

Use a weighted score over 100:

| Signal | Weight |
|---|---:|
| Skills | 35 |
| Job title / ROME proximity | 15 |
| Experience | 15 |
| Education | 8 |
| Certifications | 5 |
| Languages | 6 |
| Keywords | 4 |
| Soft skills | 4 |
| Location | 3 |
| Salary | 3 |
| Remote work | 2 |

### Matching rules

- Normalize every CV and offer into stable canonical artifacts before scoring.
- Prefer exact canonical matches.
- Use fuzzy matching only after exact matching fails.
- Use controlled semantic matching through curated ROME/ESCO/RNCP/COG/CECRL dictionaries.
- Disable embeddings in v1.
- Apply tokenization that preserves `c++`, `c#`, `.net`, `node.js`, `next.js`, `ci/cd`, and `3d`.
- Compare accents insensitively in the index only; preserve accents for display.
- Merge overlapping experience intervals before computing years.

### Caps and blockers

Apply deterministic caps after raw score:

- Score `0` for absolute blockers: missing legally required authorization, permit, or mandatory regulatory certification.
- Cap at `59` if must-have skill coverage is below 50%.
- Cap at `69` if relevant experience is below 75% of the minimum for offers requiring at least 3 years.
- Cap at `49` if a mandatory language is at least two CECRL levels below requirement.

### Tie-breakers

For equal final scores:

1. Better must-have skill coverage.
2. More relevant experience years.
3. Better title/ROME similarity.
4. Better location/remote compatibility.
5. Better salary overlap.
6. More recent publication date.

### Output

```ts
export interface ScoreBreakdown {
  skills: number;
  title: number;
  experience: number;
  education: number;
  certifications: number;
  languages: number;
  keywords: number;
  softSkills: number;
  location: number;
  salary: number;
  remote: number;
  mustHaveCoverage: number;
  hardBlocker?: string | null;
  finalScore: number;
}

export interface ScoredOffer {
  offer: JobOffer;
  breakdown: ScoreBreakdown;
  matchedFeatures: {
    exactSkills: string[];
    fuzzySkills: string[];
    semanticSkills: string[];
    missingMustHave: string[];
  };
}
```

### UI

Each ranked offer must show:

- final score,
- short French explanation,
- matched skills,
- missing important skills,
- blocker/cap reason when applicable,
- `Générer un CV` button.

Suggested labels:

- `Score de correspondance`
- `Compétences trouvées`
- `Compétences manquantes`
- `Pourquoi ce score ?`
- `Contrainte bloquante`

### Tests

Minimum tests:

- `développeur` equals `developpeur` in index.
- `Node.js`, `C++`, `C#`, `.NET`, `Next.js`, `CI/CD` remain valid tokens.
- Overlapping experience intervals do not double count years.
- CECRL ordering is correct.
- RNCP ordering is correct.
- Salary normalization works for hourly/monthly/annual amounts.
- Fuzzy thresholds are respected.
- Expired certifications do not satisfy mandatory certification requirements.
- Adding a matched must-have skill cannot lower the score.
- Removing a matched must-have skill cannot raise the score.
- `finalScore` is always between 0 and 100.
- `POST /api/match` returns stable sorted results.

---

## Tailored CV generation milestone

### Goal

Generate a one-page French CV adapted to a selected job offer by selecting and rephrasing only relevant factual elements from the confirmed profile/CV.

### API

`POST /api/generate`

Input:

- selected `offerId`,
- selected `candidateProfileId`,
- selected `resumeVersionId`,
- optional user instructions.

Output:

- generated CV content,
- matched evidence map,
- PDF export path,
- DOCX export path,
- source offer ID,
- source CV/profile version IDs.

### Required CV sections

Use these sections when data exists:

1. `Nom`
2. `Coordonnées`
3. `Poste visé`
4. `Compétences clés`
5. `Expériences professionnelles`
6. `Formation`
7. `Langues`
8. `Certifications`
9. `Réalisations`
10. `Centres d’intérêt`

Rules:

- The generated CV must read linearly.
- French grammar and syntax must be clean.
- Keep it simple and not overloaded.
- Aim for one page.
- Do not invent missing facts.
- Do not exaggerate skill levels.
- Use the job offer only to select/reorder/rephrase existing facts.
- If the job offer requires a key skill absent from the CV, show it as missing in the explanation, not inside the CV as if the user has it.
- Store every generated CV in `generated_resumes` and Supabase Storage.

### Evidence map

For each generated bullet or section, keep a source reference:

```ts
export interface GeneratedResumeEvidence {
  generatedText: string;
  sourceType: "profile" | "resume_version" | "offer";
  sourceField: string;
  sourceId: string;
  confidence: "supported" | "user_confirmed" | "needs_review";
}
```

### Acceptance criteria

- Generated CV is in French.
- Generated CV uses only supported facts.
- User can preview, edit, export PDF, and export DOCX.
- Generated output is stored and tied to the selected offer/profile/CV version.
- App shows a French warning for unsupported job requirements.

---

## My applications milestone

### Goal

Let the user track generated CVs and applications.

### Requirements

On `Mes candidatures`, show rows/cards containing:

- generated CV title,
- source offer title,
- company if available,
- offer source,
- offer content/details,
- application URL,
- generated PDF and DOCX download actions,
- current application status,
- delete action with confirmation.

Statuses:

- `Acceptée`
- `En attente`
- `Refusée`

Store:

- generated CV file paths,
- offer content snapshot,
- offer URL,
- application status,
- status history.

### Acceptance criteria

- User can create an application from a generated CV.
- User can update status.
- User can open/download generated files.
- User can view the original offer snapshot and URL.
- User can delete an application only after confirmation.
- User cannot see another user’s applications.

---

## Mini statistics milestone

### Goal

Show a small skill summary on `Mes candidatures`.

### Clarified wording

The app should not claim to know what “delighted recruiters.” Instead, show skills most represented among applications marked `Acceptée` and skills most represented among applications marked `Refusée`. These statuses are user-entered outcomes, not proof of recruiter preference.

### Required statistics

- Top 3 skills appearing in generated CVs/offers for `Acceptée` applications.
- Top 3 skills appearing in generated CVs/offers for `Refusée` applications.
- Count and percentage for each skill.
- Empty state if there are not enough applications.

### Suggested UI labels

- `Compétences les plus présentes dans les candidatures acceptées`
- `Compétences les plus présentes dans les candidatures refusées`
- `Données insuffisantes pour afficher une tendance fiable`

### Acceptance criteria

- Statistics update when application statuses change.
- Only the authenticated user’s applications are included.
- The UI avoids causal claims.

---

## Suggested additional tasks

These are recommended guardrails and implementation tasks not explicitly stated in the original spec.

### 1. Project setup and durable Codex memory

Create and maintain:

- `PLAN.md`
- `IMPLEMENT.md`
- `STATUS.md`
- `DECISIONS.md`

Acceptance:

- Every milestone has a clear acceptance checklist.
- `STATUS.md` is updated after every milestone.
- Failed validations are logged with fixes.

### 2. Security and RLS hardening

Add migrations and tests for:

- private buckets,
- user-scoped RLS,
- API ownership checks,
- secret-handling policy,
- authenticated API middleware.

### 3. External API resilience

Add:

- timeout handling,
- retry with backoff for safe GETs,
- rate-limit handling,
- normalized provider errors,
- provider response snapshots for debugging without secrets.

### 4. Data normalization/taxonomies

Add versioned normalization helpers for:

- ROME,
- ESCO if used,
- RNCP levels,
- CECRL language levels,
- INSEE/COG location codes,
- local curated skill synonym dictionary.

### 5. Export quality

Add snapshot tests or regression tests for:

- one-page PDF layout,
- DOCX generation,
- French typography,
- long names/titles,
- missing optional sections.

### 6. Accessibility and UX polish

Add:

- keyboard navigation,
- visible focus styles,
- loading/empty/error states,
- confirmation dialogs,
- mobile dashboard layout.

---

## Milestone plan

Codex should implement in this order. After each milestone: update `STATUS.md`, run validations, repair failures, then ask the user before continuing.

| Milestone | Name | Main deliverable |
|---:|---|---|
| 0 | Project setup | Next.js app, lint/test/build commands, durable memory files. |
| 1 | Auth | Supabase Auth, protected pages/routes, RLS foundation. |
| 2 | CV upload | `/api/upload`, Supabase Storage, upload UI. |
| 3 | CV editor/export | Editable corpus, preview, PDF/DOCX export. |
| 4 | Profile generation | Structured profile, ROME code prediction, editable profile page. |
| 5 | Profile requirements | Search filters, CSV location dropdowns, saved preferences. |
| 6 | France Travail integration | Public offers API route, normalized offers. |
| 7 | Adzuna integration | Private offers API route, normalized offers. |
| 8 | Offer cache/storage | 24-hour cache, query runs, deduplication. |
| 9 | Deterministic ranking | `/api/match`, PRCV-R scoring, explanations, tests. |
| 10 | Tailored CV generation | `/api/generate`, evidence map, PDF/DOCX generated CV. |
| 11 | Applications tracking | `Mes candidatures`, statuses, delete confirmation. |
| 12 | Statistics | Skill summaries for accepted/refused applications. |
| 13 | Hardening | Security, accessibility, error states, performance, final test pass. |

---

## Validation commands

Run these after each milestone that modifies source files:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If the repository does not yet define these scripts, Milestone 0 must add them.

For API integrations, add targeted tests with mocked provider responses before live calls.

For Supabase work, add migration and RLS tests where feasible.

For ranking, add deterministic unit tests and regression cases.

---

## Long-horizon operating rules for Codex

Codex must:

1. Read `SPEC.md` before starting.
2. Create or update `PLAN.md` before code changes.
3. Keep diffs scoped to the active milestone.
4. Prefer TypeScript for all new files.
5. Keep UI copy in French.
6. Use Context7/Supabase/DuckDuckGo MCP when docs or schemas are needed.
7. Run validation commands after each milestone.
8. Repair failures before moving to the next milestone.
9. Update `STATUS.md` with what changed, what passed, what failed, and what remains.
10. Ask the user before continuing to the next milestone.
11. Never broaden scope without logging the decision and asking the user.
12. Never invent candidate facts, offer details, or API behavior.

---

## Definition of done

The project is done when:

- A user can authenticate.
- A user can upload and edit a CV/career corpus.
- A user can export revised CV content as PDF and DOCX.
- A user can generate, review, edit, and save a structured profile.
- A ROME code is predicted or marked `Inconnu` using the defined threshold.
- A user can configure job-search requirements.
- France Travail and Adzuna offers are fetched, normalized, cached, and displayed.
- Offers are ranked with deterministic score breakdowns and explanations.
- A user can generate a French tailored CV from a selected offer without invented facts.
- Generated CVs are stored and downloadable as PDF/DOCX.
- Applications can be tracked with `Acceptée`, `En attente`, and `Refusée` statuses.
- Mini statistics display skill trends without causal overclaiming.
- All protected data is scoped to the authenticated user.
- Lint, typecheck, Jest tests, and build pass.
- `STATUS.md` and `DECISIONS.md` document the final state.

---

## Reference documents and links

Use these references during implementation and record exact docs consulted in `STATUS.md`:

- OpenAI Developers — `Run long horizon tasks with Codex`: https://developers.openai.com/blog/run-long-horizon-tasks-with-codex
- Original user spec: `SPEC_CV.md`
- Ranking protocol: `deep-research-report.md`
- France Travail API Offres d’emploi documentation: https://francetravail.io/produits-partages/catalogue/offres-emploi/documentation#/api-reference/operations/recupererListeOffre
- France Travail ROMEo documentation: https://francetravail.io/produits-partages/catalogue/romeo/documentation#/api-reference/operations/Pr%C3%A9diction%20des%20appellations%20m%C3%A9tier%20du%20ROME
- France Travail ROME reference information: https://www.francetravail.fr/employeur/vos-recrutements/le-rome-et-les-fiches-metiers.html
- Adzuna Search docs: https://developer.adzuna.com/docs/search
- Adzuna Interactive docs: https://developer.adzuna.com/activedocs#/default/search

