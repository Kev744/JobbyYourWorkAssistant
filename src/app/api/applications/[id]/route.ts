import { type NextRequest } from 'next/server';

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
import { createServerDbClient } from '@/lib/db/server';
import type { ApplicationStatus } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ApplicationRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: ApplicationRouteContext) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const db = await createServerDbClient();
  const application = await loadApplication(db, id, auth.user.id);

  if (!application) {
    return Response.json({ error: 'Candidature introuvable.' }, { status: 404 });
  }

  return Response.json({ application });
}

export async function PUT(request: NextRequest, context: ApplicationRouteContext) {
  return updateApplication(request, context);
}

export async function PATCH(request: NextRequest, context: ApplicationRouteContext) {
  return updateApplication(request, context);
}

export async function DELETE(_request: NextRequest, context: ApplicationRouteContext) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const db = await createServerDbClient();
  const { error, count } = await db
    .from('applications')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', auth.user.id);

  if (error) {
    return Response.json({ error: 'Impossible de supprimer la candidature.' }, { status: 500 });
  }

  if (!count) {
    return Response.json({ error: 'Candidature introuvable.' }, { status: 404 });
  }

  return Response.json({ deleted: true });
}

async function updateApplication(request: NextRequest, context: ApplicationRouteContext) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const payload = await readPayload(request);
    const db = await createServerDbClient();
    const currentApplication = await loadApplication(db, id, auth.user.id);

    if (!currentApplication) {
      return Response.json({ error: 'Candidature introuvable.' }, { status: 404 });
    }

    const nextStatus = normalizeApplicationStatus(payload.status, currentApplication.currentStatus);
    const applicationUrl =
      payload.applicationUrl === undefined
        ? currentApplication.applicationUrl
        : normalizeApplicationUrl(payload.applicationUrl) || null;
    const note = normalizeStatusNote(payload.note);

    const { data: updatedRow, error } = await db
      .from('applications')
      .update({
        application_url: applicationUrl,
        current_status: nextStatus,
      })
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select(APPLICATION_SELECT)
      .single();

    if (error || !updatedRow) {
      return Response.json({ error: 'Impossible de mettre à jour la candidature.' }, { status: 500 });
    }

    if (nextStatus !== currentApplication.currentStatus) {
      await insertStatusEvent(db, {
        userId: auth.user.id,
        applicationId: id,
        fromStatus: currentApplication.currentStatus,
        toStatus: nextStatus,
        note,
      });
    }

    const statusHistory = await loadStatusHistory(db, id);

    return Response.json({
      application: mapApplicationRow(updatedRow, statusHistory),
    });
  } catch (error) {
    if (error instanceof ApplicationValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: 'Impossible de mettre à jour la candidature.' }, { status: 500 });
  }
}

async function loadApplication(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  id: string,
  userId: string,
) {
  const { data } = await db
    .from('applications')
    .select(APPLICATION_SELECT)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return mapApplicationRow(data, await loadStatusHistory(db, id));
}

async function loadStatusHistory(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  applicationId: string,
): Promise<ReturnType<typeof mapApplicationStatusEventRow>[]> {
  const { data } = await db
    .from('application_status_events')
    .select(APPLICATION_STATUS_EVENT_SELECT)
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapApplicationStatusEventRow);
}

async function insertStatusEvent(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  input: {
    userId: string;
    applicationId: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    note: string;
  },
): Promise<void> {
  const { error } = await db.from('application_status_events').insert({
    user_id: input.userId,
    application_id: input.applicationId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    note: input.note,
  });

  if (error) {
    throw new Error('Unable to insert application status event');
  }
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
