import type { Environment } from './environment';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { emptyVault, seal, unseal, type VaultData } from './vault';
import { IntegrationError } from './config';
export interface VaultRpc {
  call(name: string, args: Record<string, unknown>): Promise<unknown>;
}
export function vaultRpc(url: string, secret: string): VaultRpc {
  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return { async call(name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new IntegrationError('RETRY', 503);
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
    const row = await this.rpc.call('g2_vault_claim', { p_environment: this.namespace, p_user: userId, p_token: token }) as { ciphertext: string | null; revision: number };
    try {
      const state = row.ciphertext ? unseal<VaultData>(`${this.namespace}:${userId}`, row.ciphertext, this.key) : emptyVault();
      let revision = row.revision;
      const save = async () => {
        const next = await this.rpc.call('g2_vault_save', { p_environment: this.namespace, p_user: userId, p_token: token, p_revision: revision, p_ciphertext: seal(`${this.namespace}:${userId}`, state, this.key) });
        if (next !== revision + 1) throw new IntegrationError('CONFLICT', 409);
        revision++;
      };
      return await action(state, save);
    } finally {
      await this.rpc.call('g2_vault_release', { p_environment: this.namespace, p_user: userId, p_token: token });
    }
  }
}
