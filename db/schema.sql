create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists user_credentials (
  user_id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_credentials_email_idx on user_credentials (email);

drop trigger if exists user_credentials_set_updated_at on user_credentials;
create trigger user_credentials_set_updated_at
  before update on user_credentials
  for each row
  execute function set_updated_at();

create table if not exists resume_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  original_file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  checksum_sha256 text not null,
  storage_bucket text not null default 'cv-originals',
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, checksum_sha256)
);

drop trigger if exists resume_files_set_updated_at on resume_files;
create trigger resume_files_set_updated_at
  before update on resume_files
  for each row
  execute function set_updated_at();

create table if not exists resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  resume_file_id uuid references resume_files(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null,
  corpus_content text not null,
  pdf_storage_path text,
  docx_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resume_file_id, version_number)
);

create unique index if not exists resume_versions_manual_version_number_idx
  on resume_versions (user_id, version_number)
  where resume_file_id is null;

drop trigger if exists resume_versions_set_updated_at on resume_versions;
create trigger resume_versions_set_updated_at
  before update on resume_versions
  for each row
  execute function set_updated_at();

create table if not exists candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  resume_version_id uuid not null references resume_versions(id) on delete cascade,
  summary text not null default '',
  profession text not null default '',
  education jsonb not null default '[]'::jsonb,
  professional_experiences jsonb not null default '[]'::jsonb,
  hobbies jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  identity_contact jsonb not null default '{}'::jsonb,
  scoring_payload jsonb not null default '{}'::jsonb,
  rome_code text not null default 'Inconnu',
  rome_prediction_score numeric,
  generation_warnings jsonb not null default '[]'::jsonb,
  confirmation_status text not null default 'draft' check (confirmation_status in ('draft', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, resume_version_id)
);

drop trigger if exists candidate_profiles_set_updated_at on candidate_profiles;
create trigger candidate_profiles_set_updated_at
  before update on candidate_profiles
  for each row
  execute function set_updated_at();

create table if not exists profile_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  candidate_profile_id uuid references candidate_profiles(id) on delete set null,
  profession_keywords text not null default '',
  city jsonb,
  department jsonb,
  region jsonb,
  radius_km integer not null default 10 check (radius_km between 0 and 100),
  experience_level text not null default '',
  availability text not null default '',
  contract_types text[] not null default '{}'::text[],
  disabled_accepted boolean not null default false,
  salary_min_annual_gross_eur integer,
  remote_preference text not null default '',
  full_time boolean,
  permanent boolean,
  company_name text not null default '',
  provider_notes text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profile_requirements_set_updated_at on profile_requirements;
create trigger profile_requirements_set_updated_at
  before update on profile_requirements
  for each row
  execute function set_updated_at();

create table if not exists job_offer_sources (
  source text primary key check (source in ('france_travail', 'adzuna')),
  label text not null,
  created_at timestamptz not null default now()
);

insert into job_offer_sources (source, label)
values ('france_travail', 'France Travail'), ('adzuna', 'Adzuna')
on conflict (source) do update set label = excluded.label;

create table if not exists job_offers (
  id uuid primary key default gen_random_uuid(),
  source text not null references job_offer_sources(source) on delete restrict,
  source_offer_id text not null,
  created_by uuid,
  offer_id text not null,
  title text not null,
  description text not null,
  company_name text,
  location jsonb not null default '{}'::jsonb,
  normalized_offer jsonb not null,
  published_at timestamptz,
  application_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_offer_id)
);

create index if not exists job_offers_created_by_idx on job_offers (created_by);

drop trigger if exists job_offers_set_updated_at on job_offers;
create trigger job_offers_set_updated_at
  before update on job_offers
  for each row
  execute function set_updated_at();

create table if not exists job_search_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null references job_offer_sources(source) on delete restrict,
  query_hash text not null,
  query_payload jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}'::text[],
  result_count integer not null default 0,
  cache_status text not null default 'miss' check (cache_status in ('miss', 'refresh')),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists job_search_queries_user_source_hash_idx
  on job_search_queries (user_id, source, query_hash, expires_at desc);

create table if not exists job_offer_search_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  query_id uuid not null references job_search_queries(id) on delete cascade,
  job_offer_id uuid not null references job_offers(id) on delete cascade,
  rank integer not null,
  created_at timestamptz not null default now(),
  unique (query_id, job_offer_id)
);

create index if not exists job_offer_search_results_query_rank_idx
  on job_offer_search_results (query_id, rank);

create table if not exists scored_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  candidate_profile_id uuid not null references candidate_profiles(id) on delete cascade,
  job_offer_id uuid not null references job_offers(id) on delete cascade,
  source text not null references job_offer_sources(source) on delete restrict,
  final_score numeric not null check (final_score >= 0 and final_score <= 100),
  score_breakdown jsonb not null,
  matched_features jsonb not null default '{}'::jsonb,
  missing_must_haves text[] not null default '{}'::text[],
  explanation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, candidate_profile_id, job_offer_id)
);

drop trigger if exists scored_offers_set_updated_at on scored_offers;
create trigger scored_offers_set_updated_at
  before update on scored_offers
  for each row
  execute function set_updated_at();

create table if not exists generated_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  candidate_profile_id uuid not null references candidate_profiles(id) on delete cascade,
  resume_version_id uuid not null references resume_versions(id) on delete cascade,
  job_offer_id uuid not null references job_offers(id) on delete cascade,
  title text not null,
  content text not null,
  evidence_map jsonb not null default '[]'::jsonb,
  user_instructions text not null default '',
  pdf_storage_path text,
  docx_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generated_resumes_user_created_idx
  on generated_resumes (user_id, created_at desc);

drop trigger if exists generated_resumes_set_updated_at on generated_resumes;
create trigger generated_resumes_set_updated_at
  before update on generated_resumes
  for each row
  execute function set_updated_at();

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  generated_resume_id uuid not null references generated_resumes(id) on delete cascade,
  job_offer_id uuid not null references job_offers(id) on delete cascade,
  offer_snapshot jsonb not null,
  generated_resume_pdf_path text,
  generated_resume_docx_path text,
  application_url text,
  current_status text not null default 'pending' check (current_status in ('accepted', 'pending', 'refused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, generated_resume_id)
);

create index if not exists applications_user_status_idx
  on applications (user_id, current_status, updated_at desc);

drop trigger if exists applications_set_updated_at on applications;
create trigger applications_set_updated_at
  before update on applications
  for each row
  execute function set_updated_at();

create table if not exists application_status_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  application_id uuid not null references applications(id) on delete cascade,
  from_status text check (from_status in ('accepted', 'pending', 'refused')),
  to_status text not null check (to_status in ('accepted', 'pending', 'refused')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists application_status_events_application_created_idx
  on application_status_events (application_id, created_at desc);

create table if not exists resume_section_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  resume_file_id uuid references resume_files(id) on delete cascade,
  resume_version_id uuid references resume_versions(id) on delete cascade,
  source_content_sha256 text not null,
  model text not null default '',
  sections jsonb not null default '{}'::jsonb,
  markdown_content text not null default '',
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resume_section_extractions_source_check
    check (resume_file_id is not null or resume_version_id is not null),
  unique (user_id, source_content_sha256)
);

create index if not exists resume_section_extractions_user_created_at_idx
  on resume_section_extractions (user_id, created_at desc);

drop trigger if exists resume_section_extractions_set_updated_at on resume_section_extractions;
create trigger resume_section_extractions_set_updated_at
  before update on resume_section_extractions
  for each row
  execute function set_updated_at();
