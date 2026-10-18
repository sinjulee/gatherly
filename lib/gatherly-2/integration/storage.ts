import { createHash } from 'node:crypto';
import { GoogleApi } from './google';
import { IntegrationError, atOperation } from './config';
import type { VaultData, Ledger } from './vault';
export type RemoteRecord = { id: string; fieldDayId: string; exhibitorId: string; title: string; text?: string; revision: number; kind: 'NOTE' | 'MEDIA' };
const DRIVE = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const columns = ['record_id', 'field_day_id', 'exhibitor_id', 'title', 'text', 'drive_file_id', 'sync_revision', 'mutation_id', 'payload_hash'];
/** All methods run inside the owner's durable vault lock; no user-supplied Google file IDs. */
export class GoogleStorage {
  constructor(private api: GoogleApi, private state: VaultData, private save: () => Promise<void>, private ownerId: string) {}
  private async owned(id: string) {
    const file = await this.api.json<{ ownedByMe: boolean; trashed?: boolean }>(`${DRIVE}/files/${encodeURIComponent(id)}?fields=ownedByMe,trashed`);
    if (!file.ownedByMe || file.trashed) throw new IntegrationError('REAUTH', 401);
  }
  async resource(key: string, name: string, mimeType: string, parent?: string): Promise<string> {
    const marker = digest(this.ownerId + ":" + key), saved = this.state.resources[key];
    if (saved?.id) { await this.owned(saved.id); return saved.id; }
    const query = new URLSearchParams({ q: `trashed = false and 'me' in owners and appProperties has { key='gatherlyKey' and value='${marker}' }`, fields: 'files(id)', pageSize: '100' });
    const found = await this.api.json<{ files: { id: string }[] }>(`${DRIVE}/files?${query}`);
    if (found.files.length > 1) throw new IntegrationError('CONFLICT', 409);
    if (found.files.length === 1) { this.state.resources[key] = { id: found.files[0].id }; await this.save(); return found.files[0].id; }
    // If a create response was lost, wait for reconciliation; NEVER issue another create.
    if (saved?.pending) throw new IntegrationError('RETRY', 503, 'RESOURCE_RECONCILIATION_REQUIRED');
    this.state.resources[key] = { pending: true }; await this.save();
    const file = await this.api.json<{ id: string }>(`${DRIVE}/files?fields=id`, json({ name, mimeType, ...(parent ? { parents: [parent] } : {}), appProperties: { gatherlyKey: marker } }));
    this.state.resources[key] = { id: file.id }; await this.save(); return file.id;
  }
  async workspace(fieldDayId: string) {
    const root = await this.resource('root', 'Gatherly', 'application/vnd.google-apps.folder');
    const folder = await this.resource(`field:${fieldDayId}`, fieldDayId, 'application/vnd.google-apps.folder', root);
    const sheet = await this.resource(`sheet:${fieldDayId}`, 'Gatherly 현장 기록', 'application/vnd.google-apps.spreadsheet', folder);
    const meta = await atOperation('SHEETS_INITIALIZATION_FAILED', () => this.api.json<{ sheets: { properties: { title: string } }[] }>(`${SHEETS}/${sheet}?fields=sheets.properties.title`));
    const missing = ['notes', 'assets'].filter(name => !meta.sheets.some(s => s.properties.title === name));
    if (missing.length) await atOperation('SHEETS_INITIALIZATION_FAILED', () => this.api.json(`${SHEETS}/${sheet}:batchUpdate`, json({ requests: missing.map(title => ({ addSheet: { properties: { title, gridProperties: { rowCount: 10000, columnCount: columns.length } } } })) })));
    return { folder, sheet };
  }
  async upload(record: RemoteRecord, blob: Blob, folder: string, ledger: Ledger) {
    if (!ledger.fileId) {
      const ids = await this.api.json<{ ids: string[] }>(`${DRIVE}/files/generateIds?count=1&space=drive&type=files`);
      ledger.fileId = ids.ids[0]; await this.save();
    }
    const id = ledger.fileId;
    const existing = await this.api.request(`${DRIVE}/files/${id}?fields=id,ownedByMe,trashed,appProperties,size`);
    if (existing.ok) {
      const file = await existing.json();
      if (!file.ownedByMe || file.trashed || file.appProperties?.payloadHash !== ledger.hash || Number(file.size) !== blob.size) throw new IntegrationError('CONFLICT', 409);
      return id;
    }
    if (existing.status !== 404) throw new IntegrationError('RETRY', 503);
    let offset = 0;
    if (ledger.uploadUrl) {
      const progress = await this.api.request(ledger.uploadUrl, { method: 'PUT', headers: { 'Content-Length': '0', 'Content-Range': `bytes */${blob.size}` } });
      if (progress.ok) return id;
      if (progress.status === 404 || progress.status === 410) { delete ledger.uploadUrl; await this.save(); }
      else if (progress.status === 308) {
        const range = progress.headers.get('range');
        offset = range ? Number(range.match(/^bytes=0-(\d+)$/)?.[1]) + 1 : 0;
        if (!Number.isSafeInteger(offset) || offset < 0 || offset >= blob.size) throw new IntegrationError('CONFLICT', 409);
      } else throw new IntegrationError('RETRY', 503);
    }
    if (!ledger.uploadUrl) {
      const started = await this.api.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
        ...json({ id, name: record.title || '현장 미디어', parents: [folder], appProperties: { payloadHash: ledger.hash, clientAssetId: record.id } }),
        headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': blob.type, 'X-Upload-Content-Length': String(blob.size) },
      });
      if (!started.ok) throw new IntegrationError('RETRY', 503);
      const location = started.headers.get('location');
      if (!location) throw new IntegrationError('RETRY', 503);
      ledger.uploadUrl = location; await this.save();
    }
    const uploaded = await this.api.request(ledger.uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type, 'Content-Range': `bytes ${offset}-${blob.size - 1}/${blob.size}` }, body: blob.slice(offset, blob.size, blob.type) });
    if (!uploaded.ok) throw new IntegrationError('RETRY', 503);
    delete ledger.uploadUrl; await this.save();
    return id;
  }
  async sync(record: RemoteRecord, blob?: Blob, uploaded?: { fileId: string; sha256: string; mimeType: string }) {
    const key = JSON.stringify([record.fieldDayId, record.exhibitorId, record.id]);
    const hash = digest(JSON.stringify(record) + (uploaded ? uploaded.sha256 + uploaded.mimeType : blob ? digest(new Uint8Array(await blob.arrayBuffer())) + blob.type : ''));
    const mutation = `${key}:${record.revision}`, last = this.state.records[key];
    let ledger = this.state.records[mutation];
    if (ledger && ledger.hash !== hash) throw new IntegrationError('CONFLICT', 409);
    if (ledger?.done) return { driveFileId: ledger.fileId, revision: record.revision };
    if (last && record.revision <= last.revision) throw new IntegrationError('CONFLICT', 409);
    if (Object.entries(this.state.records).some(([k, row]) => k.startsWith(key + ':') && k !== mutation && !row.done)) throw new IntegrationError('CONFLICT', 409);
    ledger ??= { hash, revision: record.revision }; this.state.records[mutation] = ledger; await this.save();
    const workspace = await this.workspace(record.fieldDayId);
    if (record.kind === 'MEDIA') {
      if (uploaded) { ledger.fileId = uploaded.fileId; await this.save(); }
      else {
      if (!blob?.size) throw new IntegrationError('INVALID');
      const typeFolder = await this.resource(`${blob.type.startsWith('image/') ? 'photos' : 'recordings'}:${record.fieldDayId}`, blob.type.startsWith('image/') ? 'Photos' : 'Recordings', 'application/vnd.google-apps.folder', workspace.folder);
      await this.upload(record, blob, typeFolder, ledger);
      }
    }
    const tab = record.kind === 'NOTE' ? 'notes' : 'assets';
    const url = `${SHEETS}/${workspace.sheet}/values/${tab}!A:I`;
    const read = await atOperation('SHEETS_ROW_WRITE_FAILED', () => this.api.json<{ values?: string[][] }>(url));
    const rows = read.values ?? [];
    if (rows.length && JSON.stringify(rows[0]) !== JSON.stringify(columns)) throw new IntegrationError('CONFLICT', 409, 'SHEETS_HEADER_FAILED');
    if (!rows.length) await atOperation('SHEETS_HEADER_FAILED', () => this.api.json(`${SHEETS}/${workspace.sheet}/values/${tab}!A1:I1?valueInputOption=RAW`, { ...json({ values: [columns] }), method: 'PUT' }));
    const matching = rows.flatMap((row, i) => row[0] === record.id ? [i] : []);
    if (matching.length > 1) throw new IntegrationError('CONFLICT', 409);
    const values = [record.id, record.fieldDayId, record.exhibitorId, record.title, record.text ?? '', ledger.fileId ?? '', String(record.revision), mutation, hash];
    const rowHash = digest(JSON.stringify(values));
    if (matching.length) {
      const current = rows[matching[0]];
      if (JSON.stringify(current) !== JSON.stringify(values) && (!last || digest(JSON.stringify(current)) !== last.hash)) throw new IntegrationError('CONFLICT', 409);
      ledger.row = matching[0] + 1;
    } else {
      if (last) throw new IntegrationError('CONFLICT', 409); // User removed a previously synced row.
      ledger.row ??= Math.max(2, rows.length + 1);
      if (rows[ledger.row - 1]?.some(Boolean)) throw new IntegrationError('CONFLICT', 409);
    }
    await this.save(); // Reserve exact row before PUT; response loss cannot duplicate an append.
    await atOperation('SHEETS_ROW_WRITE_FAILED', () => this.api.json(`${SHEETS}/${workspace.sheet}/values/${tab}!A${ledger.row}:I${ledger.row}?valueInputOption=RAW`, { ...json({ values: [values] }), method: 'PUT' }));
    const verified = await atOperation('SHEETS_ROW_VERIFY_FAILED', () => this.api.json<{ values?: string[][] }>(`${SHEETS}/${workspace.sheet}/values/${tab}!A${ledger.row}:I${ledger.row}`));
    if (JSON.stringify(verified.values?.[0]) !== JSON.stringify(values)) throw new IntegrationError('CONFLICT', 409, 'SHEETS_ROW_VERIFY_FAILED');
    ledger.done = true; this.state.records[key] = { hash: rowHash, revision: record.revision, done: true }; await this.save();
    return { driveFileId: ledger.fileId, revision: record.revision };
  }
}
