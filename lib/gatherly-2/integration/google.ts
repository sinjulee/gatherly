import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { IntegrationError, atStage, classified, type Diagnostic } from './config';
import type { VaultData } from './vault';
export type Transport = (input: string, init?: RequestInit) => Promise<Response>;
export const FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };
export function startConsent(config: GoogleConfig, now = Date.now()) {
  const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: FILE_SCOPE, access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
  return { url: url.toString(), flow: { state, verifier, expiresAt: now + 600_000 } };
}
export function consumeState(data: VaultData, state: string, now = Date.now()) {
  const flow = data.flow; delete data.flow;
  if (!flow || flow.expiresAt <= now || state.length !== flow.state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state))) throw new IntegrationError('FORBIDDEN', 403);
  return flow.verifier;
}
export class GoogleApi {
  constructor(private config: GoogleConfig, private state: VaultData, private save: () => Promise<void>, private transport: Transport = fetch, private now = Date.now) {}
  private async token(values: Record<string, string>) {
    return atStage(values.grant_type === 'refresh_token' ? 'GOOGLE_TOKEN_REFRESH_FAILED' : 'GOOGLE_TOKEN_EXCHANGE_FAILED', async () => {
    const response = await this.transport('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, ...values }), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new IntegrationError(retryable ? 'RETRY' : 'REAUTH', retryable ? 503 : 401, undefined, response.status);
    }
    const result = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!result.access_token || !result.expires_in) throw new IntegrationError('REAUTH', 401);
    return result;
    });
  }
  async exchange(code: string, verifier: string) {
    const token = await this.token({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: this.config.redirectUri });
    if (!token.refresh_token || !token.scope?.split(' ').includes(FILE_SCOPE)) throw new IntegrationError('REAUTH', 401);
    // Switching Google accounts with existing remote IDs would misroute private data.
    if (Object.keys(this.state.resources).length) {
      const old = this.state.oauth;
      this.state.oauth = { refreshToken: token.refresh_token, accessToken: token.access_token!, expiresAt: this.now() + token.expires_in! * 1000 };
      try { for (const resource of Object.values(this.state.resources)) if (resource.id) await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resource.id)}?fields=id,ownedByMe`).then(async r => { if (!(await r.json()).ownedByMe) throw new IntegrationError('FORBIDDEN', 403); }); }
      catch (error) { this.state.oauth = old; throw error; }
    }
    this.state.oauth = { refreshToken: token.refresh_token, accessToken: token.access_token!, expiresAt: this.now() + token.expires_in! * 1000 };
    await this.save();
  }
  private async access(force = false) {
    const current = this.state.oauth;
    if (!current) throw new IntegrationError('REAUTH', 401);
    if (!force && current.expiresAt > this.now() + 60_000) return current.accessToken;
    const next = await this.token({ grant_type: 'refresh_token', refresh_token: current.refreshToken });
    this.state.oauth = { refreshToken: next.refresh_token ?? current.refreshToken, accessToken: next.access_token!, expiresAt: this.now() + next.expires_in! * 1000 };
    try { await atStage('VAULT_SAVE_FAILED', this.save); }
    catch (error) { this.state.oauth = current; throw error; }
    return next.access_token!;
  }
  async request(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !['www.googleapis.com', 'sheets.googleapis.com'].includes(target.hostname)) throw new IntegrationError('FORBIDDEN', 403);
    const stage: Diagnostic = target.hostname === 'sheets.googleapis.com' ? (['POST', 'PUT', 'PATCH'].includes(init.method ?? 'GET') ? 'SHEETS_WRITE_FAILED' : 'SHEETS_READ_FAILED') : target.pathname.includes('/upload/') ? 'DRIVE_UPLOAD_FAILED' : init.method === 'POST' ? 'DRIVE_CREATE_FAILED' : 'DRIVE_READ_FAILED';
    // Drive uses HTTP 308 for resumable progress, not navigation. Native fetch
    // with redirect:error throws before callers can inspect its status/Range.
    const resumablePut = target.hostname === 'www.googleapis.com' && target.pathname.startsWith('/upload/') && init.method === 'PUT' && new Headers(init.headers).has('Content-Range');
    return atStage(stage, async () => {
    const response = await this.transport(url, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${await this.access()}` }, signal: AbortSignal.timeout(30_000), redirect: resumablePut ? 'manual' : 'error' });
    if (resumablePut && response.status >= 300 && response.status < 400 && response.status !== 308) throw new IntegrationError('RETRY', 503, stage, response.status);
    if (response.status === 401 && retry) { await this.access(true); return this.request(url, init, false); }
    if (response.status === 401 || response.status === 403) throw new IntegrationError('REAUTH', 401, stage, response.status);
    if (response.status === 429 || response.status >= 500) throw new IntegrationError('RETRY', 503, stage, response.status);
    return response;
    });
  }
  async json<T>(url: string, init: RequestInit = {}): Promise<T> {
    const r = await this.request(url, init);
    if (!r.ok) throw classified(new IntegrationError(r.status === 404 ? 'REAUTH' : 'CONFLICT', r.status === 404 ? 401 : 409), url.includes('sheets.googleapis.com') ? (init.method ? 'SHEETS_WRITE_FAILED' : 'SHEETS_READ_FAILED') : (init.method ? 'DRIVE_CREATE_FAILED' : 'DRIVE_READ_FAILED'), r.status);
    return atStage(url.includes('sheets.googleapis.com') ? 'SHEETS_READ_FAILED' : 'DRIVE_READ_FAILED', () => r.json() as Promise<T>);
  }
}
