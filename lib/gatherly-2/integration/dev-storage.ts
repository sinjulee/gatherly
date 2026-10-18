import { IntegrationError, atOperation } from './config';
import { GoogleApi, type Transport } from './google';
import { GoogleStorage } from './storage';
import { CloudMediaStorage } from './cloud-media';
import { pilotRecord, PILOT_FIELD, verifyStoredRecord } from './pilot-storage';
import type { VaultData } from './vault';
type Slot = ReturnType<typeof pilotRecord>;
export type DevData = Pick<VaultData, 'resources' | 'records'> & { operations: Record<string, Slot>; bytes: number; requests: number; googleRequests: number };
export function devData(state: VaultData): DevData {
  return state.devStorage ??= { resources: {}, records: {}, operations: {}, bytes: 0, requests: 0, googleRequests: 0 };
}
/** Lifetime ceilings: no rolling-window reset can forget an uncertain upload. */
export async function reserveDev(data: DevData, slot: Slot, save: () => Promise<void>) {
  const old = data.operations[slot.record.id];
  if (old && old.hash !== slot.hash) throw new IntegrationError('CONFLICT', 409);
  if (data.requests >= 10000 || (!old && (Object.keys(data.operations).length >= 100 || data.bytes + (slot.media?.size ?? 0) > 100 * 1024 * 1024))) throw new IntegrationError('LIMIT', 429);
  if (!old) { data.operations[slot.record.id] = slot; data.bytes += slot.media?.size ?? 0; }
  data.requests++; await save();
}
export function devTransport(data: DevData, save: () => Promise<void>, transport: Transport = fetch): Transport {
  return async (url, init) => {
    if (data.googleRequests >= 20000) throw new IntegrationError('LIMIT', 429);
    data.googleRequests++; await save(); return transport(url, init);
  };
}
export class DevStorage {
  private storage: GoogleStorage;
  constructor(private api: GoogleApi, private data: DevData, private save: () => Promise<void>, private owner: string) {
    this.storage = new GoogleStorage(api, data, save, owner);
  }
  private async prepare() {
    const root = await this.storage.resource('root', 'Gatherly 개발 전용 테스트', 'application/vnd.google-apps.folder');
    const folder = await this.storage.resource(`field:${PILOT_FIELD}`, '개발 자료 · 실제 행사 아님', 'application/vnd.google-apps.folder', root);
    await atOperation('SHEETS_INITIALIZATION_FAILED', () => this.storage.resource(`sheet:${PILOT_FIELD}`, 'Gatherly 개발 테스트 기록', 'application/vnd.google-apps.spreadsheet', folder));
  }
  async upload(slot: Slot, offset: number, chunk?: Blob) {
    if (!slot.media && (offset !== 0 || chunk)) throw new IntegrationError('INVALID');
    if (slot.media && (!Number.isSafeInteger(offset) || offset < 0 || offset > slot.media.size || (chunk && (!chunk.size || chunk.size > 1024*1024 || offset+chunk.size > slot.media.size || (offset+chunk.size < slot.media.size && chunk.size % (256*1024)!==0))))) throw new IntegrationError('INVALID');
    await reserveDev(this.data, slot, this.save); await this.prepare();
    const result = slot.media ? await new CloudMediaStorage(this.api, this.data, this.save, this.owner).step(slot.record, slot.media, offset, chunk) : (await this.storage.sync(slot.record), {done:true,offset:0});
    if (result.done && await verifyStoredRecord(this.api, this.data, slot) !== 'VERIFIED') throw new IntegrationError('RETRY', 503, 'VERIFY_FAILED');
    return {done:result.done,offset:result.offset};
  }
  async status(id: string) {
    const slot = this.data.operations[id];
    if (!slot) return 'NOT_UPLOADED';
    if (this.data.requests >= 10000) throw new IntegrationError('LIMIT',429);
    this.data.requests++; await this.save();
    return verifyStoredRecord(this.api,this.data,slot);
  }
}
