const ACCESS_TOKEN_COOKIE_NAME = 'mv-auth-access-token';
const REFRESH_TOKEN_COOKIE_NAME = 'mv-auth-refresh-token';
const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

type CookieGetLike = {
  get(name: string): { value: string } | undefined;
};

type ResponseCookie = {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
      secure?: boolean;
      path?: string;
      maxAge?: number;
    },
  ): void;
  delete(name: string): void;
};

type ResponseCookieContainer = {
  cookies: ResponseCookie;
};

export function getSessionTokensFromCookies(cookieStore: CookieGetLike) {
  return {
    accessToken: cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value ?? null,
    refreshToken: cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value ?? null,
  };
}

export function setAuthCookies(
  response: ResponseCookieContainer,
  tokens?: {
    accessToken: string | null;
    refreshToken?: string | null;
    accessTokenExpiresAt?: number | null;
    refreshTokenExpiresAt?: number | null;
  } | null,
) {
  if (!tokens?.accessToken) {
    clearAuthCookies(response);
    return;
  }

  const defaultOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };

  const accessTokenMaxAge = tokens.accessTokenExpiresAt
    ? Math.max(60, tokens.accessTokenExpiresAt - Math.floor(Date.now() / 1000))
    : ACCESS_TOKEN_MAX_AGE_SECONDS;

  response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, {
    ...defaultOptions,
    maxAge: accessTokenMaxAge,
  });

  if (tokens.refreshToken) {
    const refreshTokenMaxAge = tokens.refreshTokenExpiresAt
      ? Math.max(60, tokens.refreshTokenExpiresAt - Math.floor(Date.now() / 1000))
      : REFRESH_TOKEN_MAX_AGE_SECONDS;

    response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, {
      ...defaultOptions,
      maxAge: refreshTokenMaxAge,
    });
  } else {
    response.cookies.delete(REFRESH_TOKEN_COOKIE_NAME);
  }
}

export function clearAuthCookies(response: ResponseCookieContainer) {
  response.cookies.delete(ACCESS_TOKEN_COOKIE_NAME);
  response.cookies.delete(REFRESH_TOKEN_COOKIE_NAME);
}
