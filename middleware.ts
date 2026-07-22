import { NextResponse, type NextRequest } from 'next/server';

import { clearAuthCookies, getSessionTokensFromCookies } from '@/lib/auth/cookies';
import { getAuthenticatedUser } from '@/lib/auth';

const protectedPrefixes = ['/overview', '/profile', '/my-offers', '/my-applications'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const user = await getAuthenticatedUser(request.cookies);

  if (!user && getSessionTokensFromCookies(request.cookies).accessToken) {
    clearAuthCookies(response);
  }

  const pathname = request.nextUrl.pathname;
  const isProtectedPath = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!user && isProtectedPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/sign-in';
    redirectUrl.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    if (getSessionTokensFromCookies(request.cookies).accessToken) {
      clearAuthCookies(redirectResponse);
    }

    return redirectResponse;
  }

  if (user && pathname === '/sign-in') {
    return NextResponse.redirect(new URL('/overview', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
