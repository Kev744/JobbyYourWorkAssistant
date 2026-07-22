-- DropForeignKey
ALTER TABLE "application_status_events" DROP CONSTRAINT "application_status_events_application_id_fkey";

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_generated_resume_id_fkey";

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_job_offer_id_fkey";

-- DropForeignKey
ALTER TABLE "candidate_profiles" DROP CONSTRAINT "candidate_profiles_resume_version_id_fkey";

-- DropForeignKey
ALTER TABLE "generated_resumes" DROP CONSTRAINT "generated_resumes_candidate_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "generated_resumes" DROP CONSTRAINT "generated_resumes_job_offer_id_fkey";

-- DropForeignKey
ALTER TABLE "generated_resumes" DROP CONSTRAINT "generated_resumes_resume_version_id_fkey";

-- DropForeignKey
ALTER TABLE "job_offer_search_results" DROP CONSTRAINT "job_offer_search_results_job_offer_id_fkey";

-- DropForeignKey
ALTER TABLE "job_offer_search_results" DROP CONSTRAINT "job_offer_search_results_query_id_fkey";

-- DropForeignKey
ALTER TABLE "job_offers" DROP CONSTRAINT "job_offers_source_fkey";

-- DropForeignKey
ALTER TABLE "job_search_queries" DROP CONSTRAINT "job_search_queries_source_fkey";

-- DropForeignKey
ALTER TABLE "profile_requirements" DROP CONSTRAINT "profile_requirements_candidate_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "resume_section_extractions" DROP CONSTRAINT "resume_section_extractions_resume_file_id_fkey";

-- DropForeignKey
ALTER TABLE "resume_section_extractions" DROP CONSTRAINT "resume_section_extractions_resume_version_id_fkey";

-- DropForeignKey
ALTER TABLE "resume_versions" DROP CONSTRAINT "resume_versions_resume_file_id_fkey";

-- DropForeignKey
ALTER TABLE "scored_offers" DROP CONSTRAINT "scored_offers_candidate_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "scored_offers" DROP CONSTRAINT "scored_offers_job_offer_id_fkey";

-- DropForeignKey
ALTER TABLE "scored_offers" DROP CONSTRAINT "scored_offers_source_fkey";

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_resume_file_id_fkey" FOREIGN KEY ("resume_file_id") REFERENCES "resume_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_resume_version_id_fkey" FOREIGN KEY ("resume_version_id") REFERENCES "resume_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_requirements" ADD CONSTRAINT "profile_requirements_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_source_fkey" FOREIGN KEY ("source") REFERENCES "job_offer_sources"("source") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_search_queries" ADD CONSTRAINT "job_search_queries_source_fkey" FOREIGN KEY ("source") REFERENCES "job_offer_sources"("source") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_search_results" ADD CONSTRAINT "job_offer_search_results_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "job_search_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_search_results" ADD CONSTRAINT "job_offer_search_results_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scored_offers" ADD CONSTRAINT "scored_offers_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scored_offers" ADD CONSTRAINT "scored_offers_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scored_offers" ADD CONSTRAINT "scored_offers_source_fkey" FOREIGN KEY ("source") REFERENCES "job_offer_sources"("source") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_resumes" ADD CONSTRAINT "generated_resumes_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_resumes" ADD CONSTRAINT "generated_resumes_resume_version_id_fkey" FOREIGN KEY ("resume_version_id") REFERENCES "resume_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_resumes" ADD CONSTRAINT "generated_resumes_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_generated_resume_id_fkey" FOREIGN KEY ("generated_resume_id") REFERENCES "generated_resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_events" ADD CONSTRAINT "application_status_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_section_extractions" ADD CONSTRAINT "resume_section_extractions_resume_file_id_fkey" FOREIGN KEY ("resume_file_id") REFERENCES "resume_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_section_extractions" ADD CONSTRAINT "resume_section_extractions_resume_version_id_fkey" FOREIGN KEY ("resume_version_id") REFERENCES "resume_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
