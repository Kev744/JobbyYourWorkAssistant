import type { LocalDatabaseClient } from '@/lib/db/local-client';

import { CANDIDATE_PROFILE_SELECT, mapCandidateProfileRow } from '@/lib/profile/candidate-profiles';
import {
  mapProfileRequirementsRow,
  PROFILE_REQUIREMENTS_SELECT,
} from '@/lib/profile/profile-requirements';
import type { CandidateProfile, ProfileRequirements } from '@/types';

export interface OfferSearchContext {
  requirements: ProfileRequirements | null;
  profile: CandidateProfile | null;
}

export async function loadOfferSearchContext(
  db: LocalDatabaseClient,
  userId: string,
): Promise<OfferSearchContext> {
  const [{ data: requirementsRow }, { data: profileRow }] = await Promise.all([
    db
      .from('profile_requirements')
      .select(PROFILE_REQUIREMENTS_SELECT)
      .eq('user_id', userId)
      .maybeSingle(),
    db
      .from('candidate_profiles')
      .select(CANDIDATE_PROFILE_SELECT)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    requirements: requirementsRow ? mapProfileRequirementsRow(requirementsRow) : null,
    profile: profileRow ? mapCandidateProfileRow(profileRow) : null,
  };
}

export function hasOfferSearchContext(context: OfferSearchContext): boolean {
  return Boolean(context.requirements || context.profile);
}
