import { contextKey, PortError, type Exhibitor, type PublicCatalogRepository, type UserResearchSheetRepository, type SheetRecord, type UserMediaDriveRepository, type Context, type LocalSyncQueue, type SyncItem, type ReportRepository } from "./contracts";

export class MockCatalog implements PublicCatalogRepository {
  constructor(private rows: Exhibitor[]) {}
  async list(exhibitionId: string) { return structuredClone(this.rows.filter(row => row.exhibitionId === exhibitionId && row.review === "PUBLISHED")); }
}
/** Scoped at construction to model an authenticated server adapter, not a caller-supplied owner. */
export class MockSheets implements UserResearchSheetRepository {
  private rows = new Map<string, SheetRecord>();
  private mutations = new Map<string, string>();
  failNext?: PortError["code"];
  constructor(private owner: string) {}
  async upsert(record: SheetRecord, mutationId: string) {
    if (record.userId !== this.owner) throw new PortError("FINAL");
    if (this.failNext) { const code = this.failNext; this.failNext = undefined; throw new PortError(code); }
    const payload = JSON.stringify(record);
    const previous = this.mutations.get(mutationId);
    if (previous) { if (previous !== payload) throw new PortError("CONFLICT"); return; }
    const key = contextKey(record, record.id);
    const current = this.rows.get(key);
    if (record.revision !== (current?.revision ?? 0) + 1) throw new PortError("CONFLICT");
    this.rows.set(key, structuredClone(record)); this.mutations.set(mutationId, payload);
  }
  async list(userId: string) { if (userId !== this.owner) throw new PortError("FINAL"); return structuredClone([...this.rows.values()]); }
}
export class MockDrive implements UserMediaDriveRepository {
  private files = new Map<string, { id: string; bytes: string }>();
  uploads = 0;
  constructor(private owner: string) {}
  async upload(context: Context, assetId: string, blob: Blob) {
    if (context.userId !== this.owner) throw new PortError("FINAL");
    const key = contextKey(context, assetId);
    const bytes = JSON.stringify([blob.type, [...new Uint8Array(await blob.arrayBuffer())]]);
    const previous = this.files.get(key);
    if (previous) { if (previous.bytes !== bytes) throw new PortError("CONFLICT"); return previous.id; }
    const id = `mock-drive-${++this.uploads}`;
    this.files.set(key, { id, bytes }); return id;
  }
}
export class MockQueue implements LocalSyncQueue {
  private rows = new Map<string, SyncItem>();
  async put(item: SyncItem) { this.rows.set(contextKey(item, item.id), structuredClone(item)); }
  async list(userId: string) { return structuredClone([...this.rows.values()].filter(item => item.userId === userId)); }
}
export class MockReports implements ReportRepository {
  private documents = new Map<string, string>();
  async save(userId: string, requestId: string, content: string) {
    const documentId = JSON.stringify([userId, requestId]);
    const previous = this.documents.get(documentId);
    if (previous !== undefined && previous !== content) throw new PortError("CONFLICT");
    this.documents.set(documentId, content); return { documentId };
  }
  async read(userId: string, documentId: string) {
    if (JSON.parse(documentId)[0] !== userId || !this.documents.has(documentId)) throw new PortError("FINAL");
    return this.documents.get(documentId)!;
  }
}
