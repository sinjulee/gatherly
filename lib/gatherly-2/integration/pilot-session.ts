import { randomUUID } from 'node:crypto';
import { IntegrationError } from './config';
import { requirePilotUser } from './write-access';
import { emptyVault, type VaultData } from './vault';
import type { PilotData, PilotKind } from './pilot-storage';
export type PilotSessionView = { id: string; operations: Record<PilotKind, string>; status: 'OPEN' | 'CLOSED'; readOnly?: true; endsAt: number };
export type PilotSession = PilotSessionView & { data: PilotData; startsAt: number };
type Env = Record<string, string | undefined>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Approval is deployment-owned. No request parameter can grant another budget. */
export function pilotApproval(user: string, env: Env = process.env, now = Date.now()) {
  requirePilotUser(user, env);
  const approval = env.GATHERLY_V2_PILOT_APPROVAL_ID ?? '';
  const startsAt = Date.parse(env.GATHERLY_V2_PILOT_STARTS_AT ?? '');
  const endsAt = Date.parse(env.GATHERLY_V2_PILOT_ENDS_AT ?? '');
  if (!uuid.test(approval) || env.GATHERLY_V2_PILOT_STATE !== 'open' || !Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt || now < startsAt || now >= endsAt) throw new IntegrationError('DISABLED', 503);
  return { approval, startsAt, endsAt };
}
export function sessionView(row: PilotSession): PilotSessionView { return { id: row.id, operations: { ...row.operations }, status: row.status, endsAt: row.endsAt }; }
/** Must execute within the existing owner-scoped Vault lease. No Google calls. */
export async function openPilotSession(state: VaultData, user: string, save: () => Promise<void>, env: Env = process.env, now = Date.now()) {
  const policy = pilotApproval(user, env, now);
  const existing = state.pilotSessions?.[policy.approval];
  if (existing) {
    if (existing.startsAt !== policy.startsAt || existing.endsAt !== policy.endsAt) throw new IntegrationError('CONFLICT', 409);
    return existing; // Closed sessions never reopen or get another quota.
  }
  const row: PilotSession = { id: randomUUID(), operations: { photo: randomUUID(), audio: randomUUID(), note: randomUUID() }, status: 'OPEN', startsAt: policy.startsAt, endsAt: policy.endsAt, data: { ...emptyVault(), slots: {}, requests: 0, googleRequests: 0, checks: 0 } };
  state.pilotSessions ??= {}; state.pilotSessions[policy.approval] = row;
  await save(); return row;
}
export function activePilotSession(state: VaultData, user: string, id: unknown, env: Env = process.env, now = Date.now()) {
  const policy = pilotApproval(user, env, now), row = state.pilotSessions?.[policy.approval];
  if (!row || row.id !== id || row.status !== 'OPEN' || row.startsAt !== policy.startsAt || row.endsAt !== policy.endsAt || now >= row.endsAt) throw new IntegrationError('CONFLICT', 409);
  return row;
}
export async function closePilotSession(state: VaultData, user: string, id: unknown, save: () => Promise<void>, env: Env = process.env) {
  requirePilotUser(user, env);
  const row = state.pilotSessions?.[env.GATHERLY_V2_PILOT_APPROVAL_ID ?? ''];
  if (!row || row.id !== id) throw new IntegrationError('CONFLICT', 409);
  if (row.status !== 'CLOSED') { row.status = 'CLOSED'; await save(); }
  return row;
}
export function requireSessionOperation(row: PilotSession, slot: { kind: PilotKind; record: { id: string } }) {
  if (row.operations[slot.kind] !== slot.record.id) throw new IntegrationError('CONFLICT', 409);
}
