import { type NextRequest } from 'next/server';

import { invalidateProfileWorkspace } from '@/lib/cache/user-workspaces';
import { hasPrismaErrorCode, withSerializableTransaction } from '@/lib/db/transactions';
import {
  CANDIDATE_PROFILE_SELECT,
  mapCandidateProfileRow,
  profileToUpdatePayload,
} from '@/lib/profile/candidate-profiles';
import { generateCandidateProfileDraft } from '@/lib/profile/profile-extractor';
import { requireAuthenticatedUser } from '@/lib/auth';
import {
  mapProfileRequirementsRow,
  normalizeRequirementsPayload,
  PROFILE_REQUIREMENTS_SELECT,
} from '@/lib/profile/profile-requirements';
import { createServerDbClient } from '@/lib/db/server';
import type { Prisma } from '@/generated/prisma/client';
import type { CandidateProfile } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const id = request.nextUrl.searchParams.get('id');
  const resource = request.nextUrl.searchParams.get('resource');
  const db = await createServerDbClient();

  if (resource === 'requirements') {
    const { data, error } = await db
      .from('profile_requirements')
      .select(PROFILE_REQUIREMENTS_SELECT)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (error) {
      return Response.json({ error: 'Impossible de charger les critères de recherche.' }, { status: 500 });
    }

    return Response.json({ requirements: data ? mapProfileRequirementsRow(data) : null });
  }

  let query = db.from('candidate_profiles').select(CANDIDATE_PROFILE_SELECT);
  query = query.eq('user_id', auth.user.id);

  if (id) {
    query = query.eq('id', id);
  } else {
    query = query.order('updated_at', { ascending: false }).limit(1);
  }

  const { data, error } = id ? await query.single() : await query.maybeSingle();

  if (error) {
    return Response.json({ error: 'Impossible de charger le profil.' }, { status: 500 });
  }

  return Response.json({ profile: data ? mapCandidateProfileRow(data) : null });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json()) as Partial<CandidateProfile> & {
    id?: unknown;
    resource?: unknown;
  };
  const db = await createServerDbClient();

  if (payload.resource === 'requirements') {
    const normalized = normalizeRequirementsPayload(payload as Record<string, unknown>);
    const { data: requirements, error } = await db
      .from('profile_requirements')
      .upsert(
        {
          user_id: auth.user.id,
          ...normalized,
        },
        { onConflict: 'user_id' },
      )
      .select(PROFILE_REQUIREMENTS_SELECT)
      .single();

    if (error || !requirements) {
      return Response.json({ error: 'Impossible d’enregistrer les critères de recherche.' }, { status: 500 });
    }

    invalidateProfileWorkspace(auth.user.id);
    return Response.json({ requirements: mapProfileRequirementsRow(requirements) });
  }

  if (typeof payload.id !== 'string' || !payload.id) {
    return Response.json({ error: 'Identifiant du profil manquant.' }, { status: 400 });
  }

  const updatePayload = removeUndefinedValues(profileToUpdatePayload(payload));
  const { data: profile, error } = await db
    .from('candidate_profiles')
    .update(updatePayload)
    .eq('id', payload.id)
    .eq('user_id', auth.user.id)
    .select(CANDIDATE_PROFILE_SELECT)
    .single();

  if (error || !profile) {
    return Response.json({ error: 'Impossible d’enregistrer le profil.' }, { status: 500 });
  }

  invalidateProfileWorkspace(auth.user.id);
  return Response.json({ profile: mapCandidateProfileRow(profile) });
}

/** Creates a blank profile for candidates who prefer not to upload a resume. */
export async function POST() {
  const auth = await requireAuthenticatedUser();

  if (auth.response) return auth.response;

  try {
    const profileId = await withSerializableTransaction(async (tx) => {
      const latestVersion = await tx.resumeVersion.aggregate({
        where: { user_id: auth.user.id, resume_file_id: null },
        _max: { version_number: true },
      });
      const version = await tx.resumeVersion.create({
        data: {
          user_id: auth.user.id,
          resume_file_id: null,
          version_number: (latestVersion._max.version_number ?? 0) + 1,
          title: 'Profil saisi manuellement',
          corpus_content: '',
        },
        select: { id: true },
      });
      const draft = generateCandidateProfileDraft({
        resumeVersionId: version.id,
        corpusContent: '',
        title: 'Profil saisi manuellement',
        romeCode: 'Inconnu',
        romePredictionScore: 0,
      });
      const profile = await tx.candidateProfile.create({
        data: {
          user_id: auth.user.id,
          resume_version_id: draft.resumeVersionId,
          summary: draft.summary,
          profession: draft.profession,
          education: toInputJsonValue(draft.education),
          professional_experiences: toInputJsonValue(draft.professionalExperiences),
          hobbies: toInputJsonValue(draft.hobbies),
          certifications: toInputJsonValue(draft.certifications),
          skills: toInputJsonValue(draft.skills),
          languages: toInputJsonValue(draft.languages),
          achievements: toInputJsonValue(draft.achievements),
          identity_contact: toInputJsonValue(draft.identityContact),
          scoring_payload: toInputJsonValue(draft.scoringPayload),
          rome_code: draft.romeCode,
          rome_prediction_score: draft.romePredictionScore,
          generation_warnings: toInputJsonValue(draft.generationWarnings),
          confirmation_status: draft.confirmationStatus,
        },
        select: { id: true },
      });

      return profile.id;
    });
    const db = await createServerDbClient();
    const { data: profile, error } = await db
      .from('candidate_profiles')
      .select(CANDIDATE_PROFILE_SELECT)
      .eq('id', profileId)
      .eq('user_id', auth.user.id)
      .single();

    if (error || !profile) {
      throw new Error('Unable to reload the created manual profile.');
    }

    invalidateProfileWorkspace(auth.user.id);
    return Response.json({ profile: mapCandidateProfileRow(profile) }, { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2002')) {
      return Response.json({ error: 'Le profil manuel existe déjà.' }, { status: 409 });
    }

    return Response.json({ error: 'Impossible de créer le profil manuel.' }, { status: 500 });
  }
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, unknown] => entry[1] !== undefined),
  ) as Partial<T>;
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
