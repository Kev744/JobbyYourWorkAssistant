ALTER TABLE "job_offer_sources"
  DROP CONSTRAINT IF EXISTS "job_offer_sources_source_check";

ALTER TABLE "job_offer_sources"
  ADD CONSTRAINT "job_offer_sources_source_check"
  CHECK ("source" IN ('france_travail', 'adzuna', 'web'));

INSERT INTO "job_offer_sources" ("source", "label")
VALUES ('web', 'Offre importée du web')
ON CONFLICT ("source") DO UPDATE SET "label" = EXCLUDED."label";
