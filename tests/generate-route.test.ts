import { POST } from '@/app/api/generate/route';
import { requireAuthenticatedUser } from '@/lib/auth';
import { generateDocumentFromText } from '@/lib/export/simple-documents';
import { generateTailoredResumeDraftWithOpenAI } from '@/lib/generate/tailored-resume';
import { mapCandidateProfileRow } from '@/lib/profile/candidate-profiles';
import { createServerDbClient } from '@/lib/db/server';
import { mapResumeVersionRow } from '@/lib/upload/resume-versions';

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/db/server', () => ({
  createServerDbClient: jest.fn(),
}));

jest.mock('@/lib/profile/candidate-profiles', () => ({
  CANDIDATE_PROFILE_SELECT: 'id',
  mapCandidateProfileRow: jest.fn(),
}));

jest.mock('@/lib/upload/resume-versions', () => ({
  mapResumeVersionRow: jest.fn(),
}));

jest.mock('@/lib/generate/tailored-resume', () => ({
  generateTailoredResumeDraftWithOpenAI: jest.fn(),
}));

jest.mock('@/lib/export/simple-documents', () => ({
  generateDocumentFromText: jest.fn(),
}));

describe('/api/generate', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a JSON error when generated document rendering fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(requireAuthenticatedUser).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);
    jest.mocked(createServerDbClient).mockResolvedValue(buildDbMock());
    jest.mocked(mapCandidateProfileRow).mockReturnValue({ id: 'profile-1' } as never);
    jest.mocked(mapResumeVersionRow).mockReturnValue({ id: 'version-1', title: 'CV source' } as never);
    jest.mocked(generateTailoredResumeDraftWithOpenAI).mockResolvedValue({
      title: 'CV ciblé',
      content: 'Objectif professionnel',
      evidenceMap: [],
      warnings: [],
    });
    jest.mocked(generateDocumentFromText).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory, open Helvetica');
    });

    const response = await POST(
      new Request('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          generationType: 'resume',
          offerId: 'france_travail:123',
          candidateProfileId: 'profile-1',
          resumeVersionId: 'version-1',
        }),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Impossible de préparer les fichiers du CV ciblé.');
  });

  it('uploads generated CV files as Blob bodies', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const createSignedUrl = jest
      .fn()
      .mockResolvedValueOnce({ data: { signedUrl: 'https://example.test/cv.pdf' }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: 'https://example.test/cv.docx' }, error: null });
    jest.mocked(requireAuthenticatedUser).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>);
    jest
      .mocked(createServerDbClient)
      .mockResolvedValue(buildDbMock({ upload, createSignedUrl }));
    jest.mocked(mapCandidateProfileRow).mockReturnValue({ id: 'profile-1' } as never);
    jest.mocked(mapResumeVersionRow).mockReturnValue({ id: 'version-1', title: 'CV source' } as never);
    jest.mocked(generateTailoredResumeDraftWithOpenAI).mockResolvedValue({
      title: 'CV ciblé',
      content: 'Objectif professionnel',
      evidenceMap: [],
      warnings: [],
    });
    jest
      .mocked(generateDocumentFromText)
      .mockReturnValueOnce({
        bytes: Buffer.from('%PDF-1.3\nxref\ntrailer\nstartxref\n9\n%%EOF'),
        contentType: 'application/pdf',
        extension: 'pdf',
      })
      .mockReturnValueOnce({
        bytes: Buffer.from('PK docx'),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      });

    const response = await POST(
      new Request('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          generationType: 'resume',
          offerId: 'france_travail:123',
          candidateProfileId: 'profile-1',
          resumeVersionId: 'version-1',
          openAiApiKey: 'sk-user-test-key',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(generateTailoredResumeDraftWithOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ openAiApiKey: 'sk-user-test-key' }),
    );
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0]?.[1]).toBeInstanceOf(Blob);
    expect(upload.mock.calls[1]?.[1]).toBeInstanceOf(Blob);
  });
});

function buildDbMock(storageOverrides?: {
  upload?: jest.Mock;
  createSignedUrl?: jest.Mock;
}) {
  const upload = storageOverrides?.upload ?? jest.fn();
  const createSignedUrl = storageOverrides?.createSignedUrl ?? jest.fn();

  return {
    from(tableName: string) {
      if (tableName === 'candidate_profiles') {
        return buildSingleQuery({ id: 'profile-1' });
      }

      if (tableName === 'resume_versions') {
        return buildSingleQuery({ id: 'version-1', title: 'CV source' });
      }

      if (tableName === 'job_offers') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'job-offer-row-1',
              normalized_offer: {
                offerId: 'france_travail:123',
                source: 'france_travail',
                sourceOfferId: '123',
                title: 'Développeur React',
                description: 'React TypeScript',
                location: { city: 'Paris' },
                jobTarget: { rawTitle: 'Développeur React', canonicalRomeCode: 'M1805' },
                skills: [],
              },
            },
          }),
        };
      }

      if (tableName === 'generated_resumes') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'generated-1',
              candidate_profile_id: 'profile-1',
              resume_version_id: 'version-1',
              job_offer_id: 'job-offer-row-1',
              title: 'CV ciblé',
              content: 'Objectif professionnel',
              evidence_map: [],
              user_instructions: '',
              pdf_storage_path: 'user-1/generated-1/cv-cible.pdf',
              docx_storage_path: 'user-1/generated-1/cv-cible.docx',
              created_at: '',
              updated_at: '',
            },
          }),
        };
      }

      return buildSingleQuery(null);
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload,
        createSignedUrl,
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createServerDbClient>>;
}

function buildSingleQuery(data: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data }),
  };
}
