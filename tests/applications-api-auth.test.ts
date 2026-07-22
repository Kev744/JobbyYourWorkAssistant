import { requireAuthenticatedUser } from '@/lib/auth';
import { GET as getApplications } from '@/app/api/applications/route';
import { GET as getApplication } from '@/app/api/applications/[id]/route';
import { GET as getApplicationStatistics } from '@/app/api/statistics/applications/route';
import type { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}));

const mockedRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser);

describe('applications API authentication', () => {
  beforeEach(() => {
    mockedRequireAuthenticatedUser.mockResolvedValue({
      user: null,
      response: Response.json({ error: 'Authentification requise.' }, { status: 401 }),
    } as never);
  });

  it('rejects unauthenticated collection requests', async () => {
    const response = await getApplications();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentification requise.' });
  });

  it('rejects unauthenticated item requests', async () => {
    const response = await getApplication(
      new Request('http://localhost/api/applications/test-id') as NextRequest,
      {
        params: Promise.resolve({ id: 'test-id' }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentification requise.' });
  });

  it('rejects unauthenticated statistics requests', async () => {
    const response = await getApplicationStatistics();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentification requise.' });
  });
});
