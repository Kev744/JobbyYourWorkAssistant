import { type NextRequest } from 'next/server';

import { generateDocumentFromText, type ExportFormat } from '@/lib/export/simple-documents';
import { requireAuthenticatedUser } from '@/lib/auth';
import { richTextHtmlToServerPlainText } from '@/lib/rich-text/html';
import { createServerDbClient } from '@/lib/db/server';
import { CV_VERSIONS_BUCKET, mapResumeVersionRow } from '@/lib/upload/resume-versions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERSION_SELECT =
  'id, resume_file_id, version_number, title, corpus_content, pdf_storage_path, docx_storage_path, created_at, updated_at';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const payload = (await request.json()) as { format?: unknown };
  const format = payload.format;

  if (format !== 'pdf' && format !== 'docx') {
    return Response.json({ error: 'Format d’export invalide.' }, { status: 400 });
  }

  const db = await createServerDbClient();
  const { data: version, error } = await db
    .from('resume_versions')
    .select(VERSION_SELECT)
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();

  if (error || !version) {
    return Response.json({ error: 'Version du CV introuvable.' }, { status: 404 });
  }

  const document = generateDocumentFromText(
    version.title,
    richTextHtmlToServerPlainText(version.corpus_content),
    format,
  );
  const storagePath = `${auth.user.id}/${version.id}/cv-version-${version.version_number}.${document.extension}`;
  const { error: uploadError } = await db.storage
    .from(CV_VERSIONS_BUCKET)
    .upload(storagePath, document.bytes, {
      contentType: document.contentType,
      upsert: true,
    });

  if (uploadError) {
    return Response.json({ error: 'Impossible de créer l’export du CV.' }, { status: 500 });
  }

  const pathColumn = getStoragePathColumn(format);
  const { data: updatedVersion, error: updateError } = await db
    .from('resume_versions')
    .update({ [pathColumn]: storagePath })
    .eq('id', version.id)
    .select(VERSION_SELECT)
    .single();

  if (updateError || !updatedVersion) {
    return Response.json({ error: 'Impossible d’enregistrer l’export du CV.' }, { status: 500 });
  }

  const { data: signedUrlData, error: signedUrlError } = await db.storage
    .from(CV_VERSIONS_BUCKET)
    .createSignedUrl(storagePath, 300);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return Response.json({ error: 'Impossible de créer le lien de téléchargement.' }, { status: 500 });
  }

  return Response.json({
    version: mapResumeVersionRow(updatedVersion),
    signedUrl: signedUrlData.signedUrl,
    format,
  });
}

function getStoragePathColumn(format: ExportFormat): 'pdf_storage_path' | 'docx_storage_path' {
  return format === 'pdf' ? 'pdf_storage_path' : 'docx_storage_path';
}
