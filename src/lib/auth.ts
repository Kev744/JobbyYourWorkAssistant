import { cookies } from 'next/headers';

import { getSessionTokensFromCookies } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';

type CookieGetLike = {
  get(name: string): { value: string } | undefined;
};

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export async function getAuthenticatedUser(cookieStore?: CookieGetLike) {
  const resolvedCookieStore = cookieStore ?? (await cookies());
  const { accessToken } = getSessionTokensFromCookies(resolvedCookieStore);
  const user = await verifyAccessToken(accessToken);

  if (!user) {
    return null;
  }

  return user;
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      user: null,
      response: Response.json(
        { error: 'Authentification requise.' },
        { status: 401 },
      ),
    };
  }

  return { user, response: null };
}
