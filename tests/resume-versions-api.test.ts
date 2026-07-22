import { POST } from '@/app/api/resume-versions/route';
import { requireAuthenticatedUser } from '@/lib/auth';
import { createServerDbClient } from '@/lib/db/server';
import { withSerializableTransaction } from '@/lib/db/transactions';

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/db/server', () => ({
  createServerDbClient: jest.fn(),
}));

jest.mock('@/lib/db/transactions', () => ({
  hasPrismaErrorCode: jest.fn(() => false),
  withSerializableTransaction: jest.fn(),
}));

const mockedRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser);
const mockedcreateServerDbClient = jest.mocked(createServerDbClient);
const mockedWithSerializableTransaction = jest.mocked(withSerializableTransaction);

describe('resume versions API', () => {
  beforeEach(() => {
    mockedRequireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      response: null,
    } as never);
  });

  it('saves a manual corpus without requiring an uploaded resume file', async () => {
    const versionRow = {
      id: 'version-1',
      resume_file_id: null,
      version_number: 1,
      title: 'Corpus manuel',
      corpus_content: 'Profil\nDeveloppeur TypeScript',
      pdf_storage_path: null,
      docx_storage_path: null,
      created_at: '2026-05-21T08:00:00Z',
      updated_at: '2026-05-21T08:00:00Z',
    };
    const transaction = {
      resumeVersion: {
        aggregate: jest.fn().mockResolvedValue({ _max: { version_number: null } }),
        create: jest.fn().mockResolvedValue({ id: versionRow.id }),
      },
    };
    mockedWithSerializableTransaction.mockImplementation(async (work) => work(transaction as never));
    const readBuilder = {
      select: jest.fn(),
      eq: jest.fn(),
      single: jest.fn().mockResolvedValue({ data: versionRow, error: null }),
    };
    readBuilder.select.mockReturnValue(readBuilder);
    readBuilder.eq.mockReturnValue(readBuilder);
    const db = {
      from: jest.fn((table: string) => {
        if (table !== 'resume_versions') {
          throw new Error(`Unexpected table ${table}`);
        }

        return readBuilder;
      }),
    };
    mockedcreateServerDbClient.mockResolvedValue(db as never);

    const response = await POST(
      new Request('http://localhost/api/resume-versions', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Corpus manuel',
          corpusContent: 'Profil\nDeveloppeur TypeScript',
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.version.resumeFileId).toBeNull();
    expect(db.from).toHaveBeenCalledWith('resume_versions');
    expect(transaction.resumeVersion.aggregate).toHaveBeenCalledWith({
      where: { user_id: 'user-1', resume_file_id: null },
      _max: { version_number: true },
    });
    expect(transaction.resumeVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 'user-1',
          resume_file_id: null,
          version_number: 1,
          title: 'Corpus manuel',
        }),
      }),
    );
  });
});
