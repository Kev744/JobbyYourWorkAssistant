import { normalizeCorpusText } from '@/lib/export/simple-documents';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OCR_MODEL = 'gpt-5.5';
const SUPPORTED_OCR_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface OpenAIResponsePayload {
  output?: OpenAIResponseOutputItem[];
  error?: {
    message?: string;
  } | null;
}

interface OpenAIResponseOutputItem {
  content?: OpenAIResponseContentItem[];
}

interface OpenAIResponseContentItem {
  type?: string;
  text?: string;
}

export async function extractResumeTextWithOpenAIOcr(params: {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_KEY is missing.');
  }

  if (!isSupportedOcrMimeType(params.mimeType)) {
    throw new Error('Unsupported OCR MIME type.');
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL || process.env.OPENAI_MODEL || DEFAULT_OCR_MODEL,
      instructions: [
        'Transcribe the visible resume text exactly for an editable CV corpus.',
        'Return only the transcribed text. Do not summarize, describe the layout, add commentary, infer missing words, or invent facts.',
        'Preserve meaningful line breaks and section labels. If text is unreadable, return an empty string.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            buildOcrInputItem(params),
            {
              type: 'input_text',
              text: 'Transcris uniquement le texte visible de ce CV pour remplir un éditeur de corpus.',
            },
          ],
        },
      ],
      max_output_tokens: 8_000,
      reasoning: { effort: 'low' },
      store: false,
      text: {
        format: { type: 'text' },
        verbosity: 'low',
      },
    }),
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI OCR failed.');
  }

  return normalizeCorpusText(extractOutputText(payload));
}

export function isSupportedOcrMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf' || SUPPORTED_OCR_IMAGE_TYPES.has(mimeType);
}

function buildOcrInputItem(params: { bytes: Buffer; mimeType: string; fileName: string }) {
  const fileData = `data:${params.mimeType};base64,${params.bytes.toString('base64')}`;

  if (params.mimeType === 'application/pdf') {
    return {
      type: 'input_file',
      filename: params.fileName || 'cv.pdf',
      file_data: fileData,
    };
  }

  return {
    type: 'input_image',
    image_url: fileData,
  };
}

function extractOutputText(payload: OpenAIResponsePayload): string {
  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === 'output_text' && typeof content.text === 'string')
      .map((content) => content.text)
      .join('\n')
      .trim() ?? ''
  );
}
