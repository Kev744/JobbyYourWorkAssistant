import { type NextRequest } from 'next/server';

import { invalidateProfileWorkspace } from '@/lib/cache/user-workspaces';
import { requireAuthenticatedUser } from '@/lib/auth';
import { predictRomeCode } from '@/lib/france-travail/romeo';
import { CANDIDATE_PROFILE_SELECT, mapCandidateProfileRow } from '@/lib/profile/candidate-profiles';
import { generateCandidateProfileDraft } from '@/lib/profile/profile-extractor';
import {
  formatResumeSectionsAsRichTextHtml,
  normalizeResumeSectionExtraction,
  type ResumeSectionExtraction,
} from '@/lib/profile/resume-section-extractor';
import { richTextHtmlToServerPlainText } from '@/lib/rich-text/html';
import { createServerDbClient } from '@/lib/db/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json()) as {
    resumeVersionId?: unknown;
    title?: unknown;
    corpusContent?: unknown;
  };

  if (typeof payload.resumeVersionId !== 'string' || !payload.resumeVersionId) {
    return Response.json({ error: 'Version du CV manquante.' }, { status: 400 });
  }

  const db = await createServerDbClient();
  const { data: version, error: versionError } = await db
    .from('resume_versions')
    .select('id, resume_file_id, title, corpus_content')
    .eq('id', payload.resumeVersionId)
    .eq('user_id', auth.user.id)
    .single();

  if (versionError || !version) {
    return Response.json({ error: 'Version du CV introuvable.' }, { status: 404 });
  }

  const requestCorpusContent =
    typeof payload.corpusContent === 'string' && payload.corpusContent.trim()
      ? payload.corpusContent
      : '';
  const latestExtraction = await loadLatestExtraction({
    db,
    userId: auth.user.id,
    resumeFileId: version.resume_file_id,
    resumeVersionId: version.id,
  });
  const corpusContent =
    requestCorpusContent ||
    latestExtraction.richTextContent ||
    version.corpus_content;
  const corpusPlainText = richTextHtmlToServerPlainText(corpusContent);
  const identityCorpusPlainText = richTextHtmlToServerPlainText(
    requestCorpusContent || version.corpus_content,
  );
  const latestExtractionPlainText = richTextHtmlToServerPlainText(latestExtraction.richTextContent);
  const extractedSections =
    latestExtraction.sections &&
    (!requestCorpusContent || sameNormalizedPlainText(corpusPlainText, latestExtractionPlainText))
      ? latestExtraction.sections
      : null;
  const title =
    typeof payload.title === 'string' && payload.title.trim() ? payload.title : version.title;
  const initialDraft = generateCandidateProfileDraft({
    resumeVersionId: version.id,
    corpusContent: corpusPlainText,
    title,
    romeCode: 'Inconnu',
    romePredictionScore: 0,
    extractedSections,
    identityCorpusContent: identityCorpusPlainText,
  });
  const professionForRome =
    initialDraft.profession || title || corpusPlainText.split(/\r?\n/).find(Boolean) || '';
  const romePrediction = await predictRomeCode(professionForRome);
  const draft = generateCandidateProfileDraft({
    resumeVersionId: version.id,
    corpusContent: corpusPlainText,
    title,
    romeCode: romePrediction.romeCode,
    romePredictionScore: romePrediction.scorePrediction,
    extractedSections,
    identityCorpusContent: identityCorpusPlainText,
  });
  const warnings = romePrediction.warning
    ? [...draft.generationWarnings, romePrediction.warning]
    : draft.generationWarnings;
  const { data: profile, error: upsertError } = await db
    .from('candidate_profiles')
    .upsert(
      {
        user_id: auth.user.id,
        resume_version_id: draft.resumeVersionId,
        summary: draft.summary,
        profession: draft.profession,
        education: draft.education,
        professional_experiences: draft.professionalExperiences,
        hobbies: draft.hobbies,
        certifications: draft.certifications,
        skills: draft.skills,
        languages: draft.languages,
        achievements: draft.achievements,
        identity_contact: draft.identityContact,
        scoring_payload: draft.scoringPayload,
        rome_code: draft.romeCode,
        rome_prediction_score: draft.romePredictionScore,
        generation_warnings: warnings,
        confirmation_status: 'draft',
      },
      { onConflict: 'user_id,resume_version_id' },
    )
    .select(CANDIDATE_PROFILE_SELECT)
    .single();

  if (upsertError || !profile) {
    return Response.json({ error: 'Impossible de générer le profil.' }, { status: 500 });
  }

  invalidateProfileWorkspace(auth.user.id);
  return Response.json({ profile: mapCandidateProfileRow(profile) }, { status: 201 });
}

function sameNormalizedPlainText(left: string, right: string): boolean {
  return normalizePlainText(left) === normalizePlainText(right);
}

function normalizePlainText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export async function loadLatestExtraction(params: {
  db: Awaited<ReturnType<typeof createServerDbClient>>;
  userId: string;
  resumeFileId?: string | null;
  resumeVersionId: string;
}): Promise<{ richTextContent: string; sections: ResumeSectionExtraction | null }> {
  const byVersion = await loadExtractionByQuery(
    params.db
      .from('resume_section_extractions')
      .select('sections, markdown_content')
      .eq('user_id', params.userId)
      .eq('resume_version_id', params.resumeVersionId)
      .order('updated_at', { ascending: false })
      .limit(1),
  );

  if (byVersion.sections || byVersion.richTextContent) {
    return byVersion;
  }

  if (!params.resumeFileId) {
    return byVersion;
  }

  return loadExtractionByQuery(
    params.db
      .from('resume_section_extractions')
      .select('sections, markdown_content')
      .eq('user_id', params.userId)
      .eq('resume_file_id', params.resumeFileId)
      .is('resume_version_id', null)
      .order('updated_at', { ascending: false })
      .limit(1),
  );
}

async function loadExtractionByQuery(
  query: {
    maybeSingle: () => PromiseLike<{ data?: { sections?: unknown; markdown_content?: unknown } | null }>;
  },
): Promise<{ richTextContent: string; sections: ResumeSectionExtraction | null }> {
  const { data } = await query.maybeSingle();

  const sections = normalizeResumeSectionExtraction(data?.sections);
  const richTextContent = sections
    ? formatResumeSectionsAsRichTextHtml(sections)
    : typeof data?.markdown_content === 'string'
      ? data.markdown_content.trim()
      : '';

  return { richTextContent, sections };
}
