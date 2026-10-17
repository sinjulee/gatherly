import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, unlink, rmdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IntegrationError } from './config';
export type Ledger = { hash: string; revision: number; row?: number; fileId?: string; uploadUrl?: string; media?: { size: number; mimeType: string; sha256: string }; done?: boolean; driveVerified?: boolean };
export type VaultData = {
  pilot?: import('./pilot-storage').PilotData;
  oauth?: { refreshToken: string; accessToken: string; expiresAt: number };
  flow?: { state: string; verifier: string; expiresAt: number };
  resources: Record<string, { id?: string; pending?: boolean }>;
  records: Record<string, Ledger>;
};
export const emptyVault = (): VaultData => ({ resources: {}, records: {} });
export function seal(userId: string, value: unknown, key: Buffer) {
  if (key.length !== 32) throw new IntegrationError('DISABLED', 503);
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
export function unseal<T>(userId: string, value: string, key: Buffer): T {
  try {
    const raw = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(userId)); decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString()) as T;
  } catch { throw new IntegrationError('REAUTH', 401); }
}
/** Single-host durable metadata. Crash locks fail closed: inspect/reconcile before manual unlock. */
export class FileVault {
  constructor(private directory: string, private key: Buffer) {
    if (!path.isAbsolute(directory) || key.length !== 32) throw new IntegrationError('DISABLED', 503);
  }
  async locked<T>(userId: string, action: (state: VaultData, save: () => Promise<void>) => Promise<T>) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const file = path.join(this.directory, createHash('sha256').update(userId).digest('hex'));
    try { await mkdir(file + '.lock', { mode: 0o700 }); } catch { throw new IntegrationError('RETRY', 503); }
    try {
      let state: VaultData;
      try { state = unseal(userId, await readFile(file, 'utf8'), this.key); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') state = emptyVault(); else throw error; }
      const save = async () => {
        const temp = file + '.' + randomBytes(8).toString('hex');
        try { await writeFile(temp, seal(userId, state, this.key), { mode: 0o600, flag: 'wx' }); await rename(temp, file); }
        finally { await unlink(temp).catch(() => {}); }
      };
      return await action(state, save);
    } finally { await rmdir(file + '.lock'); }
  }
}
