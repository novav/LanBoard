import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_RE = /^\/admin(\/|$)/;
const SETUP_RE = /^\/setup(\/|$)/;
const SETUP_API = '/api/auth/setup';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Inject the current pathname as a request header so server components can
  // read it via headers(). We clone the request, modify the clone's header,
  // then pass it into NextResponse.next() so the server component sees the
  // header in its headers() store.
  const clonedRequest = request.clone();
  clonedRequest.headers.set('x-pathname', pathname);

  const response = NextResponse.next(clonedRequest);

  // --- /admin route protection (cookie-presence only) ---
  if (ADMIN_RE.test(pathname) && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('navbox_session')?.value;

    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};