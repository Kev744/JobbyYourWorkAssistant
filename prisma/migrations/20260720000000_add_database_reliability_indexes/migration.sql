-- Supports the unfiltered application list, resume-version history, and offer
-- lookup used during document generation.
CREATE INDEX IF NOT EXISTS "applications_user_updated_idx"
  ON "applications" ("user_id", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "job_offers_offer_id_idx"
  ON "job_offers" ("offer_id");

CREATE INDEX IF NOT EXISTS "resume_versions_user_created_idx"
  ON "resume_versions" ("user_id", "created_at" DESC);
