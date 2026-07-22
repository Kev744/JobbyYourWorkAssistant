import {
  MAX_RESUME_FILE_SIZE_BYTES,
  prepareResumeFile,
  UploadValidationError,
} from '@/lib/upload/resume-files';

describe('prepareResumeFile', () => {
  it('accepts a PDF and computes a SHA-256 checksum', async () => {
    const file = new File(['contenu cv'], 'Mon CV.pdf', {
      type: 'application/pdf',
    });

    const prepared = await prepareResumeFile(file, 'user-1');

    expect(prepared.originalFileName).toBe('Mon-CV.pdf');
    expect(prepared.mimeType).toBe('application/pdf');
    expect(prepared.fileSizeBytes).toBe(file.size);
    expect(prepared.checksumSha256).toHaveLength(64);
    expect(prepared.storagePath).toMatch(/^user-1\/.+\.pdf$/);
  });

  it('accepts an image source for OCR extraction', async () => {
    const file = new File(['image'], 'photo.png', {
      type: 'image/png',
    });

    const prepared = await prepareResumeFile(file, 'user-1');

    expect(prepared.originalFileName).toBe('photo.png');
    expect(prepared.mimeType).toBe('image/png');
    expect(prepared.storagePath).toMatch(/^user-1\/.+\.png$/);
  });

  it('accepts a plain text corpus file', async () => {
    const file = new File(['Profil\nDeveloppeur TypeScript'], 'corpus.txt', {
      type: 'text/plain',
    });

    const prepared = await prepareResumeFile(file, 'user-1');

    expect(prepared.originalFileName).toBe('corpus.txt');
    expect(prepared.mimeType).toBe('text/plain');
    expect(prepared.storagePath).toMatch(/^user-1\/.+\.txt$/);
  });

  it('accepts a Markdown corpus file by extension even when the browser sends text/plain', async () => {
    const file = new File(['## Profil\n**Developpeur TypeScript**'], 'corpus.md', {
      type: 'text/plain',
    });

    const prepared = await prepareResumeFile(file, 'user-1');

    expect(prepared.originalFileName).toBe('corpus.md');
    expect(prepared.mimeType).toBe('text/markdown');
    expect(prepared.storagePath).toMatch(/^user-1\/.+\.md$/);
  });

  it('rejects unsupported formats with a French validation error', async () => {
    const file = new File(['texte'], 'notes.rtf', {
      type: 'application/rtf',
    });

    await expect(prepareResumeFile(file, 'user-1')).rejects.toThrow(UploadValidationError);
    await expect(prepareResumeFile(file, 'user-1')).rejects.toThrow(
      'Format non pris en charge. Ajoutez un fichier PDF, DOCX, PNG, JPG, WEBP, Markdown ou TXT.',
    );
  });

  it('rejects files above the configured size limit', async () => {
    const file = {
      name: 'cv.pdf',
      type: 'application/pdf',
      size: MAX_RESUME_FILE_SIZE_BYTES + 1,
      arrayBuffer: jest.fn(),
    } as unknown as File;

    await expect(prepareResumeFile(file, 'user-1')).rejects.toThrow(
      'Le fichier dépasse la limite de 10 Mo.',
    );
  });
});
