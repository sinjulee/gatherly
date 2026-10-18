import { GoogleStorage, digest, type RemoteRecord } from './storage';
import { GoogleApi } from './google';
import type { VaultData } from './vault';
import { IntegrationError, atOperation } from './config';
import { MEDIA_CHUNK_BYTES } from './platform';
export type MediaInfo = { size: number; mimeType: string; sha256: string };
export function mediaInfo(value: unknown): MediaInfo {
  const m = value as MediaInfo;
  if (!m || !Number.isSafeInteger(m.size) || m.size <= 0 || m.size > 25 * 1024 * 1024 || typeof m.mimeType !== 'string' || !/^(image|audio)\/[a-zA-Z0-9.+;= -]+$/.test(m.mimeType) || !/^[a-f0-9]{64}$/.test(m.sha256)) throw new IntegrationError('INVALID', 413);
  return { size: m.size, mimeType: m.mimeType, sha256: m.sha256 };
}
/** Each invocation relocks persistent state and forwards at most 1 MiB. Never stores media on server disk. */
export class CloudMediaStorage {
  constructor(private api: GoogleApi, private state: VaultData, private save: () => Promise<void>, private owner: string) {}
  async step(record: RemoteRecord, info: MediaInfo, offset: number, chunk?: Blob): Promise<{ offset: number; done: boolean; driveFileId?: string }> {
    if (record.kind !== 'MEDIA' || !Number.isSafeInteger(offset) || offset < 0 || offset > info.size || (chunk && (!chunk.size || chunk.size > MEDIA_CHUNK_BYTES || offset + chunk.size > info.size || (offset + chunk.size < info.size && chunk.size % (256*1024) !== 0)))) throw new IntegrationError('INVALID');
    const key = JSON.stringify([record.fieldDayId, record.exhibitorId, record.id]), mutation = `${key}:${record.revision}`;
    const hash = digest(JSON.stringify(record) + info.sha256 + info.mimeType);
    let ledger = this.state.records[mutation];
    if (ledger && (ledger.hash !== hash || (ledger.media && JSON.stringify(ledger.media) !== JSON.stringify(info)))) throw new IntegrationError('CONFLICT', 409);
    if (ledger?.done) return { offset: info.size, done: true, driveFileId: ledger.fileId };
    if (this.state.records[key]?.revision >= record.revision || Object.entries(this.state.records).some(([k, row]) => k.startsWith(key + ':') && k !== mutation && !row.done)) throw new IntegrationError('CONFLICT', 409);
    ledger ??= { hash, revision: record.revision, media: info };
    this.state.records[mutation] = ledger; await this.save();
    const storage = new GoogleStorage(this.api, this.state, this.save, this.owner);
    if (!ledger.fileId) {
      const { ids } = await this.api.json<{ ids: string[] }>('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files');
      ledger.fileId = ids[0]; await this.save();
    }
    const fileUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(ledger.fileId)}?fields=id,ownedByMe,trashed,size,sha256Checksum,appProperties`;
    const complete = async () => {
      const file = await atOperation('DRIVE_UPLOAD_VERIFY_FAILED', () => this.api.json<{ ownedByMe: boolean; trashed: boolean; size: string; sha256Checksum?: string; appProperties?: { payloadHash?: string } }>(fileUrl));
      if (!file.sha256Checksum) throw new IntegrationError('RETRY', 503, 'DRIVE_UPLOAD_VERIFY_FAILED');
      if (!file.ownedByMe || file.trashed || Number(file.size) !== info.size || file.sha256Checksum !== info.sha256 || file.appProperties?.payloadHash !== hash) throw new IntegrationError('CONFLICT', 409, 'DRIVE_UPLOAD_VERIFY_FAILED');
      ledger.driveVerified = true; await this.save();
      const result = await storage.sync(record, undefined, { fileId: ledger.fileId!, sha256: info.sha256, mimeType: info.mimeType });
      return { offset: info.size, done: true, driveFileId: result.driveFileId };
    };
    const existing = await atOperation('DRIVE_UPLOAD_STATUS_FAILED', () => this.api.request(fileUrl));
    if (existing.ok) return complete();
    if (existing.status !== 404) throw new IntegrationError('RETRY', 503, 'DRIVE_UPLOAD_STATUS_FAILED', existing.status);
    let remoteOffset = 0;
    if (ledger.uploadUrl) {
      const progress = await atOperation('DRIVE_UPLOAD_STATUS_FAILED', () => this.api.request(ledger.uploadUrl!, { method: 'PUT', headers: { 'Content-Length': '0', 'Content-Range': `bytes */${info.size}` } }));
      if (progress.ok) return complete();
      if ([404,410].includes(progress.status)) { delete ledger.uploadUrl; await this.save(); }
      else if (progress.status === 308) {
        const range = progress.headers.get('range'); remoteOffset = range ? Number(range.match(/^bytes=0-(\d+)$/)?.[1]) + 1 : 0;
        if (!Number.isSafeInteger(remoteOffset) || remoteOffset < 0 || remoteOffset >= info.size) throw new IntegrationError('CONFLICT', 409, 'DRIVE_UPLOAD_STATUS_FAILED', progress.status);
      } else throw new IntegrationError('RETRY', 503, 'DRIVE_UPLOAD_STATUS_FAILED', progress.status);
    }
    if (!ledger.uploadUrl) {
      const { folder } = await storage.workspace(record.fieldDayId);
      const images = info.mimeType.startsWith('image/');
      const parent = await storage.resource(`${images ? 'photos' : 'recordings'}:${record.fieldDayId}`, images ? 'Photos' : 'Recordings', 'application/vnd.google-apps.folder', folder);
      const response = await atOperation('DRIVE_SESSION_INIT_FAILED', () => this.api.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': info.mimeType, 'X-Upload-Content-Length': String(info.size) },
        body: JSON.stringify({ id: ledger.fileId, name: record.title || '현장 미디어', parents: [parent], appProperties: { payloadHash: hash, clientAssetId: record.id } }),
      }));
      if (!response.ok || !response.headers.get('location')) throw new IntegrationError('RETRY', 503, 'DRIVE_SESSION_INIT_FAILED', response.status);
      ledger.uploadUrl = response.headers.get('location')!; await this.save();
    }
    if (!chunk || offset !== remoteOffset) return { offset: remoteOffset, done: false };
    const response = await atOperation('DRIVE_CHUNK_TRANSFER_FAILED', () => this.api.request(ledger.uploadUrl!, { method: 'PUT', headers: { 'Content-Type': info.mimeType, 'Content-Range': `bytes ${offset}-${offset + chunk.size - 1}/${info.size}` }, body: chunk }));
    if (response.ok) return complete();
    if (response.status !== 308) throw new IntegrationError('RETRY', 503, 'DRIVE_CHUNK_TRANSFER_FAILED', response.status);
    const range = response.headers.get('range'), acknowledged = range ? Number(range.match(/^bytes=0-(\d+)$/)?.[1]) + 1 : 0;
    if (!Number.isSafeInteger(acknowledged) || acknowledged <= offset || acknowledged > offset + chunk.size) throw new IntegrationError('RETRY', 503, 'DRIVE_CHUNK_TRANSFER_FAILED', response.status);
    return { offset: acknowledged, done: false };
  }
}
