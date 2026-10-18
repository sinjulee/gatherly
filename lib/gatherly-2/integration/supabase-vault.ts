import type { Environment } from './environment';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { emptyVault, seal, unseal, type VaultData } from './vault';
import { IntegrationError, atStage, classified } from './config';
export interface VaultRpc {
  call(name: string, args: Record<string, unknown>): Promise<unknown>;
}
export function vaultRpc(url: string, secret: string): VaultRpc {
  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return { async call(name, args) {
    const { data, error, status } = await client.rpc(name, args);
    if (error) throw new IntegrationError('RETRY', 503, undefined, status);
    return data;
  } };
}
/** Persistent fail-closed lock; no automatic lease stealing while Google results are uncertain. */
export class SupabaseVault {
  constructor(private rpc: VaultRpc, private key: Buffer, private namespace: Environment = 'development') {
    if (key.length !== 32) throw new IntegrationError('DISABLED', 503);
  }
  async locked<T>(userId: string, action: (state: VaultData, save: () => Promise<void>) => Promise<T>) {
    const token = randomUUID();
    const row = await atStage('VAULT_CLAIM_FAILED', () => this.rpc.call('g2_vault_claim', { p_environment: this.namespace, p_user: userId, p_token: token })) as { ciphertext: string | null; revision: number };
    let primary: unknown;
    let failed = false;
    try {
      const state = await atStage('VAULT_DECRYPT_FAILED', async () => row.ciphertext ? unseal<VaultData>(`${this.namespace}:${userId}`, row.ciphertext, this.key) : emptyVault());
      let revision = row.revision;
      const save = async () => atStage('VAULT_SAVE_FAILED', async () => {
        const next = await this.rpc.call('g2_vault_save', { p_environment: this.namespace, p_user: userId, p_token: token, p_revision: revision, p_ciphertext: seal(`${this.namespace}:${userId}`, state, this.key) });
        if (next !== revision + 1) throw new IntegrationError('CONFLICT', 409);
        revision++;
      });
      return await action(state, save);
    } catch (error) {
      failed = true; primary = error; throw error;
    } finally {
      try {
        const released = await this.rpc.call('g2_vault_release', { p_environment: this.namespace, p_user: userId, p_token: token });
        // Expired/stale workers must not report successful completion after losing the lease.
        if (released !== true) throw new IntegrationError('RETRY', 503);
      } catch (error) {
        if (failed) {
          const original = classified(primary, 'UNCLASSIFIED_FAILURE');
          original.secondary = 'VAULT_RELEASE_FAILED';
          throw original;
        }
        else throw classified(error, 'VAULT_RELEASE_FAILED');
      }
    }
  }
}
