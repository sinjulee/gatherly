export function isVercel(env: Record<string, string | undefined> = process.env) { return env.VERCEL === '1'; }
export function legacyMapAsset(path: string) {
  try { return decodeURIComponent(path).includes('ESG_2026_Official_BoothMap_TitleRemoved_Reference'); }
  catch { return true; }
}
/** Cloud exposes only V2; the unchanged SQLite application remains a local development app. */
export function cloudRoute(path: string): 'redirect' | 'allow' | 'block' {
  if (legacyMapAsset(path)) return 'block';
  if (path === '/') return 'redirect';
  if (path === '/v2' || path.startsWith('/v2/') || path === '/phase-one' || path.startsWith('/api/v2/') || path.startsWith('/_next/static/') || ['/icon.svg', '/favicon.ico', '/manifest.webmanifest'].includes(path)) return 'allow';
  return 'block';
}
export const MEDIA_CHUNK_BYTES = 1024 * 1024;
