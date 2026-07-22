import { requireAuthenticatedUser } from '@/lib/auth';
import { generateDocumentFromText, type ExportFormat } from '@/lib/export/simple-documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExportPayload {
  title?: unknown;
  content?: unknown;
  format?: unknown;
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const payload = (await readPayload(request)) as ExportPayload;
  const format = payload.format === 'pdf' || payload.format === 'docx' ? payload.format : null;
  const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 180) : '';
  const content = typeof payload.content === 'string' ? payload.content.trim().slice(0, 20_000) : '';

  if (!format) {
    return Response.json({ error: 'Format invalide. Utilisez pdf ou docx.' }, { status: 400 });
  }

  if (!content) {
    return Response.json({ error: 'Le contenu à exporter est obligatoire.' }, { status: 400 });
  }

  const document = generateDocumentFromText(title, content, format);
  const filename = getFilename(title, format);
  const body = new Blob([new Uint8Array(document.bytes)], { type: document.contentType });

  return new Response(body, {
    headers: {
      'Content-Type': document.contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
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

function getFilename(title: string, format: ExportFormat): string {
  const normalizedTitle = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `${normalizedTitle || 'document-genere'}.${format}`;
}

