import type { Route } from 'next';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = requestUrl.searchParams.get('next') ?? '/overview';
  const safeNextPath = (nextPath.startsWith('/') ? nextPath : '/overview') as Route;
  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = '/sign-in';
  signInUrl.searchParams.set('next', safeNextPath);
  signInUrl.searchParams.set('error', 'auth_callback_not_supported');

  return NextResponse.redirect(signInUrl);
}
