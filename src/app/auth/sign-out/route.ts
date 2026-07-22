import { NextResponse, type NextRequest } from 'next/server';

import { clearAuthCookies } from '@/lib/auth/cookies';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/sign-in', request.url));
  clearAuthCookies(response);
  return response;
}
