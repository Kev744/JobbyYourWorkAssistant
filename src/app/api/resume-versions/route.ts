import { type NextRequest } from 'next/server';

import { requireAuthenticatedUser } from '@/lib/auth';
import { createServerDbClient } from '@/lib/db/server';
import { hasPrismaErrorCode, withSerializableTransaction } from '@/lib/db/transactions';
import {
  mapResumeVersionRow,
  ResumeVersionValidationError,
  validateCorpusContent,
  validateVersionTitle,
} from '@/lib/upload/resume-versions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERSION_SELECT =
  'id, resume_file_id, version_number, title, corpus_content, pdf_storage_path, docx_storage_path, created_at, updated_at';

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const resumeFileId = request.nextUrl.searchParams.get('resumeFileId');
  const db = await createServerDbClient();
  let query = db.from('resume_versions').select(VERSION_SELECT).order('created_at', {
    ascending: false,
  });
  query = query.eq('user_id', auth.user.id);

  if (resumeFileId) {
    query = query.eq('resume_file_id', resumeFileId);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: 'Impossible de charger les versions du CV.' }, { status: 500 });
  }

  return Response.json({ versions: (data ?? []).map(mapResumeVersionRow) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json()) as {
    resumeFileId?: unknown;
    title?: unknown;
    corpusContent?: unknown;
  };

  try {
    const title = validateVersionTitle(payload.title);
    const corpusContent = validateCorpusContent(payload.corpusContent);
    const resumeFileId =
      typeof payload.resumeFileId === 'string' && payload.resumeFileId.trim()
        ? payload.resumeFileId.trim()
        : null;
    const db = await createServerDbClient();

    if (resumeFileId) {
      const { data: resumeFile, error: resumeFileError } = await db
        .from('resume_files')
        .select('id')
        .eq('id', resumeFileId)
        .eq('user_id', auth.user.id)
        .single();

      if (resumeFileError || !resumeFile) {
        return Response.json({ error: 'CV source introuvable.' }, { status: 404 });
      }
    }

    const insertedVersionId = await withSerializableTransaction(async (tx) => {
      const latestVersion = await tx.resumeVersion.aggregate({
        where: { user_id: auth.user.id, resume_file_id: resumeFileId },
        _max: { version_number: true },
      });
      const version = await tx.resumeVersion.create({
        data: {
          user_id: auth.user.id,
          resume_file_id: resumeFileId,
          version_number: (latestVersion._max.version_number ?? 0) + 1,
          title,
          corpus_content: corpusContent,
        },
        select: { id: true },
      });

      return version.id;
    });
    const { data: insertedVersion, error: insertError } = await db
      .from('resume_versions')
      .select(VERSION_SELECT)
      .eq('id', insertedVersionId)
      .eq('user_id', auth.user.id)
      .single();

    if (insertError || !insertedVersion) {
      throw new Error('Unable to reload the created resume version.');
    }

    return Response.json({ version: mapResumeVersionRow(insertedVersion) }, { status: 201 });
  } catch (error) {
    if (error instanceof ResumeVersionValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (hasPrismaErrorCode(error, 'P2002')) {
      return Response.json({ error: 'Une version identique existe déjà. Réessayez.' }, { status: 409 });
    }

    return Response.json({ error: 'Impossible d’enregistrer la version du CV.' }, { status: 500 });
  }
}
