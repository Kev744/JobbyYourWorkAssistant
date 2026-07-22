import { cookies } from 'next/headers';

import { requireAuthenticatedUser } from '@/lib/auth';
import { verifyAccessToken } from '@/lib/auth/jwt';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: jest.fn(),
}));

const mockedCookies = jest.mocked(cookies);
const mockedVerifyAccessToken = jest.mocked(verifyAccessToken);

function cookieStoreWithToken(accessToken: string | null) {
  return {
    get(name: string) {
      return name === 'mv-auth-access-token' && accessToken ? { value: accessToken } : undefined;
    },
  } as never;
}

describe('requireAuthenticatedUser', () => {
  it('returns a French 401 response when no user is authenticated', async () => {
    mockedCookies.mockResolvedValue(cookieStoreWithToken(null));
    mockedVerifyAccessToken.mockResolvedValueOnce(null);

    const result = await requireAuthenticatedUser();

    expect(result.user).toBeNull();
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({
      error: 'Authentification requise.',
    });
  });

  it('returns the authenticated user without a rejection response', async () => {
    const user = { id: 'user-1', email: 'user@example.com' };

    mockedCookies.mockResolvedValue(cookieStoreWithToken('access-token'));
    mockedVerifyAccessToken.mockResolvedValueOnce(user);

    const result = await requireAuthenticatedUser();

    expect(result.user).toEqual(user);
    expect(result.response).toBeNull();
  });
});
