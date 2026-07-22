import { extractResumeTextWithOpenAIOcr, isSupportedOcrMimeType } from '@/lib/upload/resume-ocr';

describe('resume OCR extraction', () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_KEY = originalOpenAiKey;
    delete process.env.OPENAI_OCR_MODEL;
  });

  it('supports PDF and image OCR sources', () => {
    expect(isSupportedOcrMimeType('application/pdf')).toBe(true);
    expect(isSupportedOcrMimeType('image/png')).toBe(true);
    expect(isSupportedOcrMimeType('image/jpeg')).toBe(true);
    expect(isSupportedOcrMimeType('image/webp')).toBe(true);
    expect(isSupportedOcrMimeType('application/msword')).toBe(false);
  });

  it('sends image bytes as a base64 image input', async () => {
    process.env.OPENAI_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [
          {
            content: [{ type: 'output_text', text: 'Profil\nDéveloppeur TypeScript' }],
          },
        ],
      }),
    } as unknown as Response);

    const text = await extractResumeTextWithOpenAIOcr({
      bytes: Buffer.from('fake-image'),
      mimeType: 'image/png',
      fileName: 'cv.png',
    });
    const body = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body)) as {
      input: Array<{ content: Array<{ type: string; image_url?: string }> }>;
    };

    expect(text).toBe('Profil\nDéveloppeur TypeScript');
    expect(body.input[0]?.content[0]).toEqual({
      type: 'input_image',
      image_url: `data:image/png;base64,${Buffer.from('fake-image').toString('base64')}`,
    });
  });

  it('sends PDF bytes as a base64 file input', async () => {
    process.env.OPENAI_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [{ content: [{ type: 'output_text', text: 'Formation\nMaster' }] }],
      }),
    } as unknown as Response);

    await extractResumeTextWithOpenAIOcr({
      bytes: Buffer.from('%PDF-'),
      mimeType: 'application/pdf',
      fileName: 'cv.pdf',
    });
    const body = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body)) as {
      input: Array<{ content: Array<{ type: string; filename?: string; file_data?: string }> }>;
    };

    expect(body.input[0]?.content[0]).toEqual({
      type: 'input_file',
      filename: 'cv.pdf',
      file_data: `data:application/pdf;base64,${Buffer.from('%PDF-').toString('base64')}`,
    });
  });
});
