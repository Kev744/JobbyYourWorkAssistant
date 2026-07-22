import { type NextRequest } from 'next/server';

import { requireAuthenticatedUser } from '@/lib/auth';
import { createServerDbClient } from '@/lib/db/server';
import { extractResumeTextWithOpenAIOcr, isSupportedOcrMimeType } from '@/lib/upload/resume-ocr';
import { extractResumeTextFromBuffer } from '@/lib/upload/resume-text-extractor';

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
    .select('id, original_file_name, storage_bucket, storage_path, mime_type')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();

  if (error || !resumeFile) {
    return Response.json({ error: 'CV introuvable.' }, { status: 404 });
  }

  const { data, error: downloadError } = await db.storage
    .from(resumeFile.storage_bucket)
    .download(resumeFile.storage_path);

  if (downloadError || !data) {
    return Response.json({ error: 'Impossible de lire le fichier CV.' }, { status: 500 });
  }

  const bytes = Buffer.from(await data.arrayBuffer());

  if (shouldUseOpenAIFirst(resumeFile.mime_type)) {
    const ocrExtraction = await tryOpenAIExtraction({
      bytes,
      mimeType: resumeFile.mime_type,
      fileName: resumeFile.original_file_name,
    });

    if (ocrExtraction.text || ocrExtraction.shouldStop) {
      return Response.json({
        text: ocrExtraction.text,
        warnings: ocrExtraction.warnings,
      });
    }
  }

  const localExtraction = extractResumeTextFromBuffer({
    bytes,
    mimeType: resumeFile.mime_type,
  });

  if (localExtraction.text || !isSupportedOcrMimeType(resumeFile.mime_type)) {
    return Response.json(localExtraction);
  }

  const ocrExtraction = await tryOpenAIExtraction({
    bytes,
    mimeType: resumeFile.mime_type,
    fileName: resumeFile.original_file_name,
  });

  return Response.json({
    text: ocrExtraction.text,
    warnings: ocrExtraction.warnings,
  });
}

function shouldUseOpenAIFirst(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

async function tryOpenAIExtraction(params: {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<{ text: string; warnings: string[]; shouldStop: boolean }> {
  try {
    const ocrText = await extractResumeTextWithOpenAIOcr({
      bytes: params.bytes,
      mimeType: params.mimeType,
      fileName: params.fileName,
    });

    return {
      text: ocrText,
      warnings: ocrText
        ? [buildOpenAIExtractionWarning(params.mimeType)]
        : ['Analyse OpenAI terminée, mais aucun texte exploitable n’a été trouvé.'],
      shouldStop: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'OPENAI_KEY is missing.') {
      return {
        text: '',
        warnings: ['Analyse OpenAI indisponible : clé OpenAI manquante côté serveur.'],
        shouldStop: false,
      };
    }

    if (params.mimeType.startsWith('image/')) {
      return {
        text: '',
        warnings: ['OCR OpenAI indisponible pour cette image.'],
        shouldStop: true,
      };
    }

    return {
      text: '',
      warnings: ['Analyse OpenAI indisponible pour ce PDF. Extraction locale utilisée si possible.'],
      shouldStop: false,
    };
  }
}

function buildOpenAIExtractionWarning(mimeType: string): string {
  if (mimeType === 'application/pdf') {
    return 'Texte PDF extrait par analyse OpenAI. Relisez attentivement avant d’enregistrer.';
  }

  return 'Texte extrait par OCR OpenAI. Relisez attentivement avant d’enregistrer.';
}
