import { NextRequest } from 'next/server';

import { invalidateResumeWorkspace } from '@/lib/cache/user-workspaces';
import { requireAuthenticatedUser } from '@/lib/auth';
import { createServerDbClient } from '@/lib/db/server';
import {
  CV_ORIGINALS_BUCKET,
  mapResumeFileRow,
  prepareResumeFile,
  removeStoredResumeFile,
  UploadValidationError,
} from '@/lib/upload/resume-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const db = await createServerDbClient();
  const { data, error } = await db
    .from('resume_files')
    .select(
      'id, original_file_name, mime_type, file_size_bytes, checksum_sha256, storage_bucket, storage_path, created_at, updated_at',
    )
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json(
      { error: 'Impossible de charger les CV importés.' },
      { status: 500 },
    );
  }

  return Response.json({ files: (data ?? []).map(mapResumeFileRow) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return Response.json(
      { error: 'Ajoutez un fichier PDF, DOCX, PNG, JPG, WEBP, Markdown ou TXT.' },
      { status: 400 },
    );
  }

  return storeResumeFile(file, auth.user.id);
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const formData = await request.formData();
  const id = formData.get('id');
  const file = formData.get('file');

  if (typeof id !== 'string' || !id) {
    return Response.json({ error: 'Identifiant du CV manquant.' }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return Response.json(
      { error: 'Ajoutez un fichier PDF, DOCX, PNG, JPG, WEBP, Markdown ou TXT.' },
      { status: 400 },
    );
  }

  const db = await createServerDbClient();
  const { data: existingFile, error: existingError } = await db
    .from('resume_files')
    .select('id, storage_path')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();

  if (existingError || !existingFile) {
    return Response.json({ error: 'CV introuvable.' }, { status: 404 });
  }

  try {
    const prepared = await prepareResumeFile(file, auth.user.id);
    const { error: uploadError } = await db.storage
      .from(CV_ORIGINALS_BUCKET)
      .upload(prepared.storagePath, prepared.bytes, {
        contentType: prepared.mimeType,
        upsert: false,
      });

    if (uploadError) {
      return Response.json({ error: 'Impossible de stocker le fichier.' }, { status: 500 });
    }

    const { data: updatedFile, error: updateError } = await db
      .from('resume_files')
      .update({
        original_file_name: prepared.originalFileName,
        mime_type: prepared.mimeType,
        file_size_bytes: prepared.fileSizeBytes,
        checksum_sha256: prepared.checksumSha256,
        storage_bucket: CV_ORIGINALS_BUCKET,
        storage_path: prepared.storagePath,
      })
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select(
        'id, original_file_name, mime_type, file_size_bytes, checksum_sha256, storage_bucket, storage_path, created_at, updated_at',
      )
      .single();

    if (updateError || !updatedFile) {
      await removeStoredResumeFile(db, prepared.storagePath);

      if (updateError?.code === '23505') {
        return Response.json({ error: 'Ce fichier existe déjà.' }, { status: 409 });
      }

      return Response.json({ error: 'Impossible de remplacer le CV.' }, { status: 500 });
    }

    await removeStoredResumeFile(db, existingFile.storage_path);

    invalidateResumeWorkspace(auth.user.id);
    return Response.json({ file: mapResumeFileRow(updatedFile) });
  } catch (error) {
    return handleUploadError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'Identifiant du CV manquant.' }, { status: 400 });
  }

  const db = await createServerDbClient();
  const { data: existingFile, error: existingError } = await db
    .from('resume_files')
    .select('id, storage_path')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();

  if (existingError || !existingFile) {
    return Response.json({ error: 'CV introuvable.' }, { status: 404 });
  }

  const { error: deleteError } = await db
    .from('resume_files')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id);

  if (deleteError) {
    return Response.json({ error: 'Impossible de supprimer le CV.' }, { status: 500 });
  }

  await removeStoredResumeFile(db, existingFile.storage_path);

  invalidateResumeWorkspace(auth.user.id);
  return Response.json({ deleted: true });
}

async function storeResumeFile(file: File, userId: string) {
  const db = await createServerDbClient();

  try {
    const prepared = await prepareResumeFile(file, userId);
    const { data: duplicate } = await db
      .from('resume_files')
      .select('id')
      .eq('checksum_sha256', prepared.checksumSha256)
      .eq('user_id', userId)
      .maybeSingle();

    if (duplicate) {
      return Response.json({ error: 'Ce fichier existe déjà.' }, { status: 409 });
    }

    const { error: uploadError } = await db.storage
      .from(CV_ORIGINALS_BUCKET)
      .upload(prepared.storagePath, prepared.bytes, {
        contentType: prepared.mimeType,
        upsert: false,
      });

    if (uploadError) {
      return Response.json({ error: 'Impossible de stocker le fichier.' }, { status: 500 });
    }

    const { data: insertedFile, error: insertError } = await db
      .from('resume_files')
      .insert({
        user_id: userId,
        original_file_name: prepared.originalFileName,
        mime_type: prepared.mimeType,
        file_size_bytes: prepared.fileSizeBytes,
        checksum_sha256: prepared.checksumSha256,
        storage_bucket: CV_ORIGINALS_BUCKET,
        storage_path: prepared.storagePath,
      })
      .select(
        'id, original_file_name, mime_type, file_size_bytes, checksum_sha256, storage_bucket, storage_path, created_at, updated_at',
      )
      .single();

    if (insertError || !insertedFile) {
      await removeStoredResumeFile(db, prepared.storagePath);

      if (insertError?.code === '23505') {
        return Response.json({ error: 'Ce fichier existe déjà.' }, { status: 409 });
      }

      return Response.json({ error: 'Impossible d’enregistrer le CV.' }, { status: 500 });
    }

    invalidateResumeWorkspace(userId);
    return Response.json({ file: mapResumeFileRow(insertedFile) }, { status: 201 });
  } catch (error) {
    return handleUploadError(error);
  }
}

function handleUploadError(error: unknown) {
  if (error instanceof UploadValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: 'Une erreur est survenue pendant l’import.' }, { status: 500 });
}
