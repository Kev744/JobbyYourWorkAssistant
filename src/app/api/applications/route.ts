import { requireAuthenticatedUser } from '@/lib/auth';
import {
  APPLICATION_SELECT,
  APPLICATION_STATUS_EVENT_SELECT,
  ApplicationValidationError,
  mapApplicationRow,
  mapApplicationStatusEventRow,
  normalizeApplicationStatus,
  normalizeApplicationUrl,
  normalizeStatusNote,
} from '@/lib/applications/applications';
import { hasPrismaErrorCode, withSerializableTransaction } from '@/lib/db/transactions';
import { createServerDbClient } from '@/lib/db/server';
import type { Prisma } from '@/generated/prisma/client';
import type { JobOffer } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GeneratedResumeJoinRow {
  id: string;
  pdf_storage_path: string | null;
  docx_storage_path: string | null;
  job_offer_id: string;
  job_offers?: { normalized_offer?: unknown } | Array<{ normalized_offer?: unknown }>;
}

export async function GET() {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const db = await createServerDbClient();
  const { data: applicationRows, error } = await db
    .from('applications')
    .select(APPLICATION_SELECT)
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return Response.json({ error: 'Impossible de charger les candidatures.' }, { status: 500 });
  }

  const applicationIds = (applicationRows ?? []).map((row) => row.id);
  const statusHistory = await loadStatusHistory(db, applicationIds);

  return Response.json({
    applications: (applicationRows ?? []).map((row) =>
      mapApplicationRow(row, statusHistory.get(row.id) ?? []),
    ),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = await readPayload(request);
    const generatedResumeId = stringValue(payload.generatedResumeId);
    const applicationUrl = normalizeApplicationUrl(payload.applicationUrl);
    const status = normalizeApplicationStatus(payload.status, 'pending');
    const note = normalizeStatusNote(payload.note);

    if (!generatedResumeId) {
      return Response.json({ error: 'CV généré manquant.' }, { status: 400 });
    }

    const db = await createServerDbClient();
    const generatedResume = await loadGeneratedResume(db, generatedResumeId, auth.user.id);

    if (!generatedResume) {
      return Response.json({ error: 'CV généré introuvable.' }, { status: 404 });
    }

    const applicationId = await withSerializableTransaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          user_id: auth.user.id,
          generated_resume_id: generatedResume.id,
          job_offer_id: generatedResume.job_offer_id,
          offer_snapshot: toInputJsonValue(generatedResume.offerSnapshot),
          generated_resume_pdf_path: generatedResume.pdf_storage_path,
          generated_resume_docx_path: generatedResume.docx_storage_path,
          application_url: applicationUrl || generatedResume.offerSnapshot.applicationUrl || null,
          current_status: status,
        },
        select: { id: true },
      });

      await tx.applicationStatusEvent.create({
        data: {
          user_id: auth.user.id,
          application_id: application.id,
          from_status: null,
          to_status: status,
          note,
        },
      });

      return application.id;
    });

    const { data: application, error } = await db
      .from('applications')
      .select(APPLICATION_SELECT)
      .eq('id', applicationId)
      .eq('user_id', auth.user.id)
      .single();

    if (error || !application) {
      throw new Error('Unable to reload the created application.');
    }

    const history = await loadStatusHistory(db, [application.id]);

    return Response.json(
      { application: mapApplicationRow(application, history.get(application.id) ?? []) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApplicationValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (hasPrismaErrorCode(error, 'P2002')) {
      return Response.json({ error: 'Cette candidature existe déjà.' }, { status: 409 });
    }

    return Response.json({ error: 'Impossible de créer la candidature.' }, { status: 500 });
  }
}

async function loadGeneratedResume(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  id: string,
  userId: string,
): Promise<
  | (GeneratedResumeJoinRow & {
      offerSnapshot: JobOffer;
    })
  | null
> {
  const { data } = await db
    .from('generated_resumes')
    .select('id, pdf_storage_path, docx_storage_path, job_offer_id, job_offers(normalized_offer)')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const row = data as GeneratedResumeJoinRow;
  const joinedOffer = Array.isArray(row.job_offers) ? row.job_offers[0] : row.job_offers;

  if (!joinedOffer?.normalized_offer) {
    return null;
  }

  return {
    ...row,
    offerSnapshot: joinedOffer.normalized_offer as JobOffer,
  };
}

async function loadStatusHistory(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  applicationIds: string[],
): Promise<Map<string, ReturnType<typeof mapApplicationStatusEventRow>[]>> {
  if (applicationIds.length === 0) {
    return new Map();
  }

  const { data } = await db
    .from('application_status_events')
    .select(APPLICATION_STATUS_EVENT_SELECT)
    .in('application_id', applicationIds)
    .order('created_at', { ascending: false });
  const map = new Map<string, ReturnType<typeof mapApplicationStatusEventRow>[]>();

  for (const row of data ?? []) {
    const event = mapApplicationStatusEventRow(row);
    const events = map.get(event.applicationId) ?? [];
    events.push(event);
    map.set(event.applicationId, events);
  }

  return map;
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

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
