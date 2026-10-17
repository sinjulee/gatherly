import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cloudRoute, isVercel, legacyMapAsset } from './lib/gatherly-2/integration/platform';
import { enabled, required, origin } from './lib/gatherly-2/integration/config';
export async function proxy(request: NextRequest) {
  if (legacyMapAsset(request.nextUrl.pathname)) return NextResponse.json({ error: 'PRIVATE_ASSET' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (isVercel()) {
    const route = cloudRoute(request.nextUrl.pathname);
    if (route === 'redirect') return NextResponse.redirect(new URL('/v2', request.url));
    if (route === 'block') return NextResponse.json({ error: 'LOCAL_LEGACY_ONLY' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  if (!enabled() || !(request.nextUrl.pathname === '/phase-one' || request.nextUrl.pathname === '/v2' || request.nextUrl.pathname.startsWith('/v2/') || request.nextUrl.pathname.startsWith('/api/v2/'))) return response;
  // Start on the callback's host before creating host-bound PKCE/session cookies.
  // Never forward OAuth codes, arbitrary next URLs, or POST bodies across origins.
  if (['GET', 'HEAD'].includes(request.method) && ['/v2', '/v2/auth-complete'].includes(request.nextUrl.pathname) && request.nextUrl.origin !== origin()) {
    return NextResponse.redirect(new URL('/v2', origin()), { status: 307, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const client = createServerClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    cookies: { getAll: () => request.cookies.getAll(), setAll: values => {
      for (const { name, value } of values) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of values) response.cookies.set(name, value, options);
      response.headers.set('Cache-Control', 'private, no-store');
    } },
  });
  await client.auth.getUser(); // Refresh and verify; each API also authorizes independently.
  return response;
}
export const config = { matcher: ['/:path*'] };
