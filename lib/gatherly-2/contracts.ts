/** V2 ports: no Prisma, credentials or network implementation in this layer. */
export type Context = { userId: string; fieldDayId: string; exhibitorId: string };
export type Exhibition = { id: string; name: string };
export type Exhibitor = { id: string; companyId: string; exhibitionId: string; name: string; booth: string | null; summary: string; sourceId: string; review: "DRAFT" | "PUBLISHED" };
export type Geometry = { x: number; y: number; width: number; height: number };
export type Hotspot = { id: string; exhibitionId: string; exhibitorId: string; mapVersion: string; geometry: Geometry; review: "DRAFT" | "VERIFIED" };
export interface PublicCatalogRepository {
  list(exhibitionId: string): Promise<Exhibitor[]>;
}
export type Note = Context & { id: string; title: string; text: string; revision: number; updatedAt: string };
export type SheetRecord = Context & { id: string; revision: number; text?: string; driveFileId?: string; title: string };
export interface UserResearchSheetRepository {
  upsert(record: SheetRecord, mutationId: string): Promise<void>;
  list(userId: string): Promise<SheetRecord[]>;
}
export interface UserMediaDriveRepository {
  upload(context: Context, assetId: string, blob: Blob): Promise<string>;
}
export type SyncState = "LOCAL_PENDING" | "DRIVE_UPLOADING" | "DRIVE_UPLOADED_SHEET_PENDING" | "SHEET_SYNCING" | "SYNCED" | "FAILED_RETRYABLE" | "BLOCKED_REAUTH" | "CONFLICT" | "FAILED_FINAL";
export type SyncItem = Context & { id: string; kind: "NOTE" | "MEDIA"; title: string; text?: string; blob?: Blob; revision: number; state: SyncState; driveFileId?: string; attempts: number; nextAttemptAt: number; error?: string };
export interface LocalSyncQueue {
  put(item: SyncItem): Promise<void>;
  list(userId: string): Promise<SyncItem[]>;
}
export interface ReportRepository {
  save(userId: string, requestId: string, content: string): Promise<{ documentId: string }>;
  read(userId: string, documentId: string): Promise<string>;
}
export class PortError extends Error {
  constructor(public code: "REAUTH" | "CONFLICT" | "RETRY" | "FINAL") { super(code); }
}
export const contextKey = (context: Context, id: string) => JSON.stringify([context.userId, context.fieldDayId, context.exhibitorId, id]);
