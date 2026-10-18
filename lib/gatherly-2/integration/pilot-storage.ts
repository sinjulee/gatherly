import { IntegrationError, atStage, atOperation, type RemoteEvidence } from './config';
import { GoogleApi, type Transport } from './google';
import { GoogleStorage, digest, type RemoteRecord } from './storage';
import { CloudMediaStorage, mediaInfo, type MediaInfo } from './cloud-media';
import { emptyVault, type VaultData } from './vault';
import { parseRecord } from './validation';
export type PilotKind = 'note' | 'photo' | 'audio';
type Slot = { record: RemoteRecord; media?: MediaInfo; hash: string };
export type PilotData = { resources: VaultData['resources']; records: VaultData['records']; slots: Partial<Record<PilotKind, Slot>>; requests: number; googleRequests: number; checks: number };
export const PILOT_FIELD = '00000000-0000-4000-8000-000000000012';
const PILOT_COMPANY = '00000000-0000-4000-8000-000000000013';
export function pilotData(state: VaultData): PilotData {
  return state.pilot ??= { ...emptyVault(), slots: {}, requests: 0, googleRequests: 0, checks: 0 };
}
export function pilotRecord(value: unknown, media?: unknown): Slot & { kind: PilotKind } {
  const input = value as Record<string, unknown>;
  if (!input || input.fieldDayId !== 'storage-test-event' || input.exhibitorId !== 'storage-test-company') throw new IntegrationError('FORBIDDEN', 403);
  const record = parseRecord({ ...input, fieldDayId: PILOT_FIELD, exhibitorId: PILOT_COMPANY });
  const info = record.kind === 'MEDIA' ? mediaInfo(media) : undefined;
  if (info && info.size > 5 * 1024 * 1024) throw new IntegrationError('INVALID', 413);
  const kind: PilotKind = !info ? 'note' : info.mimeType.startsWith('image/') ? 'photo' : 'audio';
  return { kind, record, media: info, hash: digest(JSON.stringify(record) + JSON.stringify(info ?? null)) };
}
/** Evidence of prior verification, never inferred from an allocated ID or pending resource. */
export function pilotRemoteEvidence(data: PilotData, slot: ReturnType<typeof pilotRecord>): RemoteEvidence {
  const record = slot.record;
  const ledger = data.records[`${JSON.stringify([record.fieldDayId, record.exhibitorId, record.id])}:${record.revision}`];
  return { file: ledger?.driveVerified ? 'CONFIRMED' : 'UNKNOWN', row: ledger?.done ? 'CONFIRMED' : 'UNKNOWN' };
}
/** Run only inside the server-selected owner's production Vault lease. */
export async function reservePilot(data: PilotData, slot: ReturnType<typeof pilotRecord>, save: () => Promise<void>) {
  const previous = data.slots[slot.kind];
  if (previous && previous.hash !== slot.hash) throw new IntegrationError('CONFLICT', 409);
  if (Object.entries(data.slots).some(([kind, row]) => kind !== slot.kind && row.record.id === slot.record.id)) throw new IntegrationError('CONFLICT', 409);
  if (data.requests >= 30) throw new IntegrationError('LIMIT', 429);
  data.slots[slot.kind] ??= { record: slot.record, media: slot.media, hash: slot.hash };
  data.requests++; await save(); // Durable reservation before any external side effect.
}
export function pilotTransport(data: PilotData, save: () => Promise<void>, transport: Transport = fetch): Transport {
  return async (url, init) => {
    if (data.googleRequests >= 240) throw new IntegrationError('LIMIT', 429);
    data.googleRequests++; await save();
    return transport(url, init);
  };
}
export class PilotStorage {
  private storage: GoogleStorage;
  constructor(private api: GoogleApi, private data: PilotData, private save: () => Promise<void>, private owner: string, private sessionId?: string) {
    this.storage = new GoogleStorage(api, data, save, this.resourceOwner());
  }
  private resourceOwner() { return this.owner + ':storage-test-v1' + (this.sessionId ? ':' + this.sessionId : ''); }
  private async prepare() {
    const root = await this.storage.resource('root', 'Gatherly 제한 실증 테스트' + (this.sessionId ? ' · 회차 ' + this.sessionId.slice(0, 8) : ''), 'application/vnd.google-apps.folder');
    const folder = await this.storage.resource(`field:${PILOT_FIELD}`, '사진·녹음·메모 3건 테스트', 'application/vnd.google-apps.folder', root);
    await atOperation('SHEETS_INITIALIZATION_FAILED', () => this.storage.resource(`sheet:${PILOT_FIELD}`, 'Gatherly 테스트 기록 (실제 행사 아님)', 'application/vnd.google-apps.spreadsheet', folder));
  }
  async upload(slot: ReturnType<typeof pilotRecord>, offset = 0, chunk?: Blob) {
    if (slot.media && (!Number.isSafeInteger(offset) || offset < 0 || offset > slot.media.size || (chunk && (!chunk.size || chunk.size > 1024 * 1024 || offset + chunk.size > slot.media.size || (offset + chunk.size < slot.media.size && chunk.size % (256 * 1024) !== 0))))) throw new IntegrationError('INVALID');
    if (!slot.media && (offset !== 0 || chunk)) throw new IntegrationError('INVALID');
    await reservePilot(this.data, slot, this.save);
    await this.prepare();
    if (!slot.media) {
      await this.storage.sync(slot.record);
      await this.verify(slot.kind);
      return { done: true, offset: 0 };
    }
    let result;
    try { result = await new CloudMediaStorage(this.api, this.data, this.save, this.resourceOwner()).step(slot.record, slot.media, offset, chunk); }
    catch (error) {
      const key = JSON.stringify([slot.record.fieldDayId, slot.record.exhibitorId, slot.record.id]);
      const ledger = this.data.records[`${key}:${slot.record.revision}`];
      if (ledger?.driveVerified && !ledger.done && (!(error instanceof IntegrationError) || error.code === 'RETRY')) throw new IntegrationError('SHEET_PENDING', 503, error instanceof IntegrationError ? error.diagnostic : undefined, error instanceof IntegrationError ? error.upstreamStatus : undefined);
      throw error;
    }
    if (result.done) await this.verify(slot.kind);
    // Never expose file IDs or resumable session URLs.
    return { done: result.done, offset: result.offset };
  }
  async verify(kind: PilotKind) {
    return atStage('VERIFY_FAILED', () => this.verifyRemote(kind));
  }
  private async verifyRemote(kind: PilotKind) {
    const slot = this.data.slots[kind];
    if (!slot) return 'NOT_UPLOADED' as const;
    const { record, media } = slot;
    const key = JSON.stringify([record.fieldDayId, record.exhibitorId, record.id]);
    const ledger = this.data.records[`${key}:${record.revision}`];
    if (!ledger?.done || !ledger.row) return ledger?.driveVerified ? 'SHEET_PENDING' as const : 'PENDING' as const;
    const sheet = this.data.resources[`sheet:${PILOT_FIELD}`]?.id;
    if (!sheet) throw new IntegrationError('CONFLICT', 409);
    const owned = async (id: string) => {
      const file = await this.api.json<{ ownedByMe: boolean; trashed?: boolean; size?: string; sha256Checksum?: string; appProperties?: { payloadHash?: string } }>(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=ownedByMe,trashed,size,sha256Checksum,appProperties`);
      if (!file.ownedByMe || file.trashed) throw new IntegrationError('CONFLICT', 409);
      return file;
    };
    await owned(sheet);
    if (media) {
      if (!ledger.fileId) throw new IntegrationError('CONFLICT', 409);
      const file = await atOperation('DRIVE_UPLOAD_VERIFY_FAILED', () => owned(ledger.fileId!));
      if (Number(file.size) !== media.size || file.sha256Checksum !== media.sha256 || file.appProperties?.payloadHash !== ledger.hash) throw new IntegrationError('CONFLICT', 409, 'DRIVE_UPLOAD_VERIFY_FAILED');
    }
    const tab = media ? 'assets' : 'notes';
    const row = await atOperation('SHEETS_ROW_VERIFY_FAILED', () => this.api.json<{ values?: string[][] }>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheet)}/values/${tab}!A${ledger.row}:I${ledger.row}`));
    const expected = [record.id, record.fieldDayId, record.exhibitorId, record.title, record.text ?? '', ledger.fileId ?? '', String(record.revision), `${key}:${record.revision}`, ledger.hash];
    if (JSON.stringify(row.values?.[0]) !== JSON.stringify(expected)) throw new IntegrationError('CONFLICT', 409, 'SHEETS_ROW_VERIFY_FAILED');
    return 'VERIFIED' as const;
  }
  async status() {
    if (this.data.checks >= 10) throw new IntegrationError('LIMIT', 429);
    this.data.checks++; await this.save();
    return { note: await this.verify('note'), photo: await this.verify('photo'), audio: await this.verify('audio') };
  }
}
