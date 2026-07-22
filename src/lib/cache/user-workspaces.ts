import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

import { createServerDbClient } from '@/lib/db/server';
import { CANDIDATE_PROFILE_SELECT, mapCandidateProfileRow } from '@/lib/profile/candidate-profiles';
import {
  mapProfileRequirementsRow,
  PROFILE_REQUIREMENTS_SELECT,
} from '@/lib/profile/profile-requirements';
import { mapResumeFileRow } from '@/lib/upload/resume-files';
import type { CandidateProfile, ProfileRequirements, ResumeFileRecord } from '@/types';

const RESUME_FILE_SELECT =
  'id, original_file_name, mime_type, file_size_bytes, checksum_sha256, storage_bucket, storage_path, created_at, updated_at';

function profileWorkspaceTag(userId: string) {
  return `profile-workspace:${userId}`;
}

function resumeWorkspaceTag(userId: string) {
  return `resume-workspace:${userId}`;
}

export async function getCachedProfileWorkspace(userId: string): Promise<{
  profiles: CandidateProfile[];
  requirements: ProfileRequirements | null;
}> {
  return unstable_cache(
    async () => {
      const db = await createServerDbClient();
      const [profilesResult, requirementsResult] = await Promise.all([
        db
          .from('candidate_profiles')
          .select(CANDIDATE_PROFILE_SELECT)
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(50),
        db
          .from('profile_requirements')
          .select(PROFILE_REQUIREMENTS_SELECT)
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (profilesResult.error) {
        throw new Error('Unable to load candidate profiles for the cached profile workspace.');
      }

      if (requirementsResult.error) {
        throw new Error('Unable to load profile requirements for the cached profile workspace.');
      }

      return {
        profiles: (profilesResult.data ?? []).map(mapCandidateProfileRow),
        requirements: requirementsResult.data
          ? mapProfileRequirementsRow(requirementsResult.data)
          : null,
      };
    },
    ['profile-workspace', userId],
    { revalidate: 300, tags: [profileWorkspaceTag(userId)] },
  )();
}

export async function getCachedResumeFiles(userId: string): Promise<ResumeFileRecord[]> {
  return unstable_cache(
    async () => {
      const db = await createServerDbClient();
      const { data, error } = await db
        .from('resume_files')
        .select(RESUME_FILE_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error('Unable to load resume files for the cached resume workspace.');
      }

      return (data ?? []).map(mapResumeFileRow);
    },
    ['resume-workspace', userId],
    { revalidate: 300, tags: [resumeWorkspaceTag(userId)] },
  )();
}

export function invalidateProfileWorkspace(userId: string) {
  revalidateTag(profileWorkspaceTag(userId), { expire: 0 });
  revalidatePath('/profile');
  revalidatePath('/my-offers');
}

export function invalidateResumeWorkspace(userId: string) {
  revalidateTag(resumeWorkspaceTag(userId), { expire: 0 });
  revalidatePath('/overview');
}
