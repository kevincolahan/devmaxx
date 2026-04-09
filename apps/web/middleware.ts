import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get('ref');
  const response = NextResponse.next();

  if (ref && /^[a-z0-9_]{4,20}$/i.test(ref)) {
    // Store referral code in cookie — 30 day expiry
    response.cookies.set('devmaxx_ref', ref, {
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
      httpOnly: false, // Allow client-side access for banner display
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
