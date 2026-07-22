import { type NextRequest } from 'next/server';

import { requireAuthenticatedUser } from '@/lib/auth';
import { createServerDbClient } from '@/lib/db/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const db = await createServerDbClient();
  const { data: resumeFile, error } = await db
    .from('resume_files')
    .select('id, storage_bucket, storage_path, mime_type')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();

  if (error || !resumeFile) {
    return Response.json({ error: 'CV introuvable.' }, { status: 404 });
  }

  const { data, error: signedUrlError } = await db.storage
    .from(resumeFile.storage_bucket)
    .createSignedUrl(resumeFile.storage_path, 300);

  if (signedUrlError || !data?.signedUrl) {
    return Response.json({ error: 'Impossible de créer l’aperçu du CV.' }, { status: 500 });
  }

  return Response.json({
    signedUrl: data.signedUrl,
    mimeType: resumeFile.mime_type,
  });
}
