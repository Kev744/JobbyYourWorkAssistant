import { randomUUID } from 'node:crypto';

import { requireAuthenticatedUser } from '@/lib/auth';
import { generateDocumentFromText } from '@/lib/export/simple-documents';
import {
  decideGenerationHandoff,
  generateCoverLetterDraftWithOpenAI,
} from '@/lib/generate/cover-letter';
import { generateTailoredResumeDraftWithOpenAI } from '@/lib/generate/tailored-resume';
import {
  createPastedWebOffer,
  PastedOfferValidationError,
  persistPastedWebOffer,
} from '@/lib/offers/pasted-offer';
import { CANDIDATE_PROFILE_SELECT, mapCandidateProfileRow } from '@/lib/profile/candidate-profiles';
import { createServerDbClient } from '@/lib/db/server';
import { mapResumeVersionRow } from '@/lib/upload/resume-versions';
import type { GeneratedResumeEvidence, GeneratedResumeRecord, JobOffer } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENERATED_RESUMES_BUCKET = 'generated-resumes';
const RESUME_VERSION_SELECT =
  'id, resume_file_id, version_number, title, corpus_content, pdf_storage_path, docx_storage_path, created_at, updated_at';
const GENERATED_RESUME_SELECT =
  'id, candidate_profile_id, resume_version_id, job_offer_id, title, content, evidence_map, user_instructions, pdf_storage_path, docx_storage_path, created_at, updated_at';

interface GeneratePayload {
  offerId?: unknown;
  pastedOfferText?: unknown;
  pastedOfferUrl?: unknown;
  candidateProfileId?: unknown;
  resumeVersionId?: unknown;
  userInstructions?: unknown;
  generationType?: unknown;
  openAiApiKey?: unknown;
}

interface GeneratedResumeRow {
  id: string;
  candidate_profile_id: string;
  resume_version_id: string;
  job_offer_id: string;
  title: string;
  content: string;
  evidence_map: unknown;
  user_instructions: string;
  pdf_storage_path: string | null;
  docx_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const db = await createServerDbClient();
  const { data, error } = await db
    .from('generated_resumes')
    .select(GENERATED_RESUME_SELECT)
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ error: 'Impossible de lire les CV générés.' }, { status: 500 });
  }

  return Response.json({
    generatedResumes: (data ?? []).map(mapGeneratedResumeRow),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const payload = (await readPayload(request)) as GeneratePayload;
  const offerId = stringValue(payload.offerId);
  const pastedOfferText = stringValue(payload.pastedOfferText);
  const pastedOfferUrl = stringValue(payload.pastedOfferUrl);
  const candidateProfileId = stringValue(payload.candidateProfileId);
  const resumeVersionId = stringValue(payload.resumeVersionId);
  const userInstructions = stringValue(payload.userInstructions).slice(0, 2000);
  const openAiApiKey = stringValue(payload.openAiApiKey).slice(0, 500);
  const handoff = decideGenerationHandoff(payload.generationType);

  if ((!offerId && !pastedOfferText) || !candidateProfileId || !resumeVersionId) {
    return Response.json(
      {
        error:
          'Une offre existante ou une offre collée, candidateProfileId et resumeVersionId sont obligatoires.',
      },
      { status: 400 },
    );
  }

  if (offerId && pastedOfferText) {
    return Response.json({ error: 'Utilisez une seule source d’offre par génération.' }, { status: 400 });
  }

  if (!handoff) {
    return Response.json(
      { error: 'Type de génération invalide. Utilisez resume ou cover_letter.' },
      { status: 400 },
    );
  }

  const db = await createServerDbClient();
  const [{ data: profileRow }, { data: resumeVersionRow }] = await Promise.all([
    db
      .from('candidate_profiles')
      .select(CANDIDATE_PROFILE_SELECT)
      .eq('id', candidateProfileId)
      .eq('user_id', auth.user.id)
      .single(),
    db
      .from('resume_versions')
      .select(RESUME_VERSION_SELECT)
      .eq('id', resumeVersionId)
      .eq('user_id', auth.user.id)
      .single(),
  ]);

  if (!profileRow) {
    return Response.json({ error: 'Profil candidat introuvable.' }, { status: 404 });
  }

  if (!resumeVersionRow) {
    return Response.json({ error: 'Version du CV introuvable.' }, { status: 404 });
  }

  let offer: { id: string; normalizedOffer: JobOffer } | null;

  try {
    offer = pastedOfferText
      ? await persistPastedWebOffer(
          db,
          auth.user.id,
          createPastedWebOffer({
            text: pastedOfferText,
            applicationUrl: pastedOfferUrl,
            scopeId: auth.user.id,
          }),
        )
      : await loadJobOffer(db, offerId);
  } catch (error) {
    if (error instanceof PastedOfferValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error('Unable to prepare pasted web offer.', error);
    return Response.json({ error: 'Impossible de préparer l’offre collée.' }, { status: 500 });
  }

  if (!offer) {
    return Response.json({ error: 'Offre introuvable.' }, { status: 404 });
  }

  const profile = mapCandidateProfileRow(profileRow);
  const resumeVersion = mapResumeVersionRow(resumeVersionRow);
  let draft;

  try {
    draft =
      handoff === 'cover_letter_generation'
        ? await generateCoverLetterDraftWithOpenAI({
            profile,
            resumeVersion,
            offer: offer.normalizedOffer,
            userInstructions,
            openAiApiKey,
          })
        : await generateTailoredResumeDraftWithOpenAI({
            profile,
            resumeVersion,
            offer: offer.normalizedOffer,
            userInstructions,
            openAiApiKey,
          });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'OPENAI_KEY is missing.') {
      return Response.json({ error: 'Clé OpenAI manquante. Renseignez votre clé API OpenAI ou configurez OPENAI_KEY côté serveur.' }, { status: 500 });
    }

    return Response.json(
      {
        error:
          handoff === 'cover_letter_generation'
            ? 'Impossible de générer la lettre de motivation avec OpenAI.'
            : 'Impossible de générer le CV ciblé avec OpenAI.',
      },
      { status: 502 },
    );
  }
  const generatedResumeId = randomUUID();
  let pdf;
  let docx;

  try {
    pdf = generateDocumentFromText('', draft.content, 'pdf');
    docx = generateDocumentFromText('', draft.content, 'docx');
  } catch (error) {
    console.error('Generated document rendering failed.', error);

    return Response.json(
      {
        error:
          handoff === 'cover_letter_generation'
            ? 'Impossible de préparer les fichiers de la lettre de motivation.'
            : 'Impossible de préparer les fichiers du CV ciblé.',
      },
      { status: 500 },
    );
  }

  const basePath = `${auth.user.id}/${generatedResumeId}`;
  const pdfStoragePath =
    handoff === 'cover_letter_generation' ? `${basePath}/lettre-motivation.pdf` : `${basePath}/cv-cible.pdf`;
  const docxStoragePath =
    handoff === 'cover_letter_generation' ? `${basePath}/lettre-motivation.docx` : `${basePath}/cv-cible.docx`;
  const [pdfUpload, docxUpload] = await Promise.all([
    db.storage.from(GENERATED_RESUMES_BUCKET).upload(pdfStoragePath, toUploadBlob(pdf), {
      contentType: pdf.contentType,
      upsert: true,
    }),
    db.storage.from(GENERATED_RESUMES_BUCKET).upload(docxStoragePath, toUploadBlob(docx), {
      contentType: docx.contentType,
      upsert: true,
    }),
  ]);

  if (pdfUpload.error || docxUpload.error) {
    await removeGeneratedDocuments(db, [pdfStoragePath, docxStoragePath]);

    return Response.json(
      {
        error:
          handoff === 'cover_letter_generation'
            ? 'Impossible de créer les fichiers de la lettre de motivation.'
            : 'Impossible de créer les fichiers du CV ciblé.',
      },
      { status: 500 },
    );
  }

  const { data: generatedRow, error: insertError } = await db
    .from('generated_resumes')
    .insert({
      id: generatedResumeId,
      user_id: auth.user.id,
      candidate_profile_id: profile.id,
      resume_version_id: resumeVersion.id,
      job_offer_id: offer.id,
      title: draft.title,
      content: draft.content,
      evidence_map: draft.evidenceMap,
      user_instructions: userInstructions,
      pdf_storage_path: pdfStoragePath,
      docx_storage_path: docxStoragePath,
    })
    .select(GENERATED_RESUME_SELECT)
    .single();

  if (insertError || !generatedRow) {
    await removeGeneratedDocuments(db, [pdfStoragePath, docxStoragePath]);

    return Response.json(
      {
        error:
          handoff === 'cover_letter_generation'
            ? "Impossible d'enregistrer la lettre de motivation."
            : "Impossible d'enregistrer le CV ciblé.",
      },
      { status: 500 },
    );
  }

  const [pdfSignedUrl, docxSignedUrl] = await Promise.all([
    db.storage.from(GENERATED_RESUMES_BUCKET).createSignedUrl(pdfStoragePath, 300),
    db.storage.from(GENERATED_RESUMES_BUCKET).createSignedUrl(docxStoragePath, 300),
  ]);

  if (pdfSignedUrl.error || docxSignedUrl.error) {
    return Response.json({ error: 'Impossible de créer les liens de téléchargement.' }, { status: 500 });
  }

  return Response.json({
    generatedResume: mapGeneratedResumeRow(generatedRow),
    signedUrls: {
      pdf: pdfSignedUrl.data?.signedUrl,
      docx: docxSignedUrl.data?.signedUrl,
    },
    warnings: draft.warnings,
  });
}

async function loadJobOffer(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  offerId: string,
): Promise<{ id: string; normalizedOffer: JobOffer } | null> {
  let query = db
    .from('job_offers')
    .select('id, normalized_offer')
    .eq('offer_id', offerId);

  if (isUuid(offerId)) {
    query = db
      .from('job_offers')
      .select('id, normalized_offer')
      .or(`offer_id.eq.${escapeDbFilter(offerId)},id.eq.${offerId}`);
  }

  const { data } = await query.limit(1).maybeSingle();

  if (!data?.normalized_offer) {
    return null;
  }

  return {
    id: data.id,
    normalizedOffer: data.normalized_offer as JobOffer,
  };
}

function mapGeneratedResumeRow(row: GeneratedResumeRow): GeneratedResumeRecord {
  return {
    id: row.id,
    candidateProfileId: row.candidate_profile_id,
    resumeVersionId: row.resume_version_id,
    jobOfferId: row.job_offer_id,
    title: row.title,
    content: row.content,
    evidenceMap: Array.isArray(row.evidence_map)
      ? (row.evidence_map as GeneratedResumeEvidence[])
      : [],
    userInstructions: row.user_instructions,
    pdfStoragePath: row.pdf_storage_path,
    docxStoragePath: row.docx_storage_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readPayload(request: Request): Promise<Record<string, unknown>> {
  try {
    const payload = (await request.json()) as unknown;

    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toUploadBlob(document: ReturnType<typeof generateDocumentFromText>): Blob {
  return new Blob([new Uint8Array(document.bytes)], { type: document.contentType });
}

async function removeGeneratedDocuments(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  paths: string[],
): Promise<void> {
  const { error } = await db.storage.from(GENERATED_RESUMES_BUCKET).remove(paths);

  if (error) {
    console.error('Unable to remove unreferenced generated documents.', error);
  }
}

function escapeDbFilter(value: string): string {
  return value.replace(/"/g, '\\"');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

