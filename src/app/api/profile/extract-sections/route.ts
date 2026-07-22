import { createHash } from 'node:crypto';

import { type NextRequest } from 'next/server';

import { requireAuthenticatedUser } from '@/lib/auth';
import {
  DEFAULT_RESUME_EXTRACTION_MODEL,
  extractResumeSectionsWithOpenAI,
  formatResumeSectionsAsRichTextHtml,
} from '@/lib/profile/resume-section-extractor';
import { createServerDbClient } from '@/lib/db/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json()) as {
    title?: unknown;
    corpusContent?: unknown;
    resumeFileId?: unknown;
    resumeVersionId?: unknown;
  };

  if (typeof payload.corpusContent !== 'string' || !payload.corpusContent.trim()) {
    return Response.json({ error: 'Contenu du CV manquant.' }, { status: 400 });
  }

  try {
    const sections = await extractResumeSectionsWithOpenAI({
      title: typeof payload.title === 'string' ? payload.title : '',
      corpusContent: payload.corpusContent,
    });
    const richTextContent = formatResumeSectionsAsRichTextHtml(sections);
    const sourceContentSha256 = createHash('sha256').update(payload.corpusContent).digest('hex');
    const resumeFileId = typeof payload.resumeFileId === 'string' ? payload.resumeFileId : null;
    const resumeVersionId =
      typeof payload.resumeVersionId === 'string' ? payload.resumeVersionId : null;
    const db = await createServerDbClient();
    const { data: extraction, error: extractionError } = await db
      .from('resume_section_extractions')
      .upsert(
        {
          user_id: auth.user.id,
          resume_file_id: resumeFileId,
          resume_version_id: resumeVersionId,
          source_content_sha256: sourceContentSha256,
          model: process.env.OPENAI_MODEL || DEFAULT_RESUME_EXTRACTION_MODEL,
          sections,
          markdown_content: richTextContent,
          warnings: sections.warnings,
        },
        { onConflict: 'user_id,source_content_sha256' },
      )
      .select('id')
      .single();

    if (extractionError || !extraction) {
      return Response.json({ error: 'Impossible d’enregistrer les sections extraites.' }, { status: 500 });
    }

    return Response.json({
      extractionId: extraction.id,
      sections,
      richTextContent,
      warnings: sections.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'OPENAI_KEY is missing.') {
      return Response.json({ error: 'Clé OpenAI manquante côté serveur.' }, { status: 500 });
    }

    if (message === 'Resume content is too long for section extraction.') {
      return Response.json(
        { error: 'Le contenu du CV est trop long pour cette extraction.' },
        { status: 413 },
      );
    }

    return Response.json(
      { error: 'Impossible d’extraire les sections du CV.' },
      { status: 502 },
    );
  }
}
