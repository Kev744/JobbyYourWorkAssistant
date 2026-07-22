create index if not exists resume_files_user_created_idx
  on resume_files (user_id, created_at desc);

create index if not exists resume_versions_user_file_created_idx
  on resume_versions (user_id, resume_file_id, created_at desc);

create index if not exists candidate_profiles_user_updated_idx
  on candidate_profiles (user_id, updated_at desc);
