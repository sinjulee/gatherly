import { contextKey, PortError, type SyncItem, type LocalSyncQueue, type UserMediaDriveRepository, type UserResearchSheetRepository } from "./contracts";

/** Mock worker; real remote adapters must additionally guarantee cross-tab/process idempotency. */
export class SyncWorker {
  private running = new Map<string, Promise<SyncItem>>();
  constructor(private queue: LocalSyncQueue, private drive: UserMediaDriveRepository, private sheets: UserResearchSheetRepository, private now = Date.now) {}
  run(item: SyncItem, manualRetry = false): Promise<SyncItem> {
    const key = contextKey(item, item.id);
    const running = this.running.get(key);
    if (running) return running;
    const task = this.execute(item, manualRetry).finally(() => this.running.delete(key));
    this.running.set(key, task); return task;
  }
  private async execute(input: SyncItem, manual: boolean) {
    // Reload the ledger: a stale UI snapshot must not forget a successful Drive upload.
    let item = (await this.queue.list(input.userId)).find(row => contextKey(row, row.id) === contextKey(input, input.id)) ?? structuredClone(input);
    if (["SYNCED", "FAILED_FINAL", "CONFLICT"].includes(item.state)) return item;
    if (item.state === "BLOCKED_REAUTH" && !manual) return item;
    if (!manual && item.nextAttemptAt > this.now()) return item;
    const persist = async (patch: Partial<SyncItem>) => { item = { ...item, ...patch }; await this.queue.put(item); };
    try {
      await persist({ attempts: item.attempts + 1, error: undefined });
      if (item.kind === "MEDIA" && !item.driveFileId) {
        if (!item.blob) throw new PortError("FINAL");
        await persist({ state: "DRIVE_UPLOADING" });
        const driveFileId = await this.drive.upload(item, item.id, item.blob);
        await persist({ driveFileId, state: "DRIVE_UPLOADED_SHEET_PENDING" });
      }
      await persist({ state: "SHEET_SYNCING" });
      await this.sheets.upsert({ userId: item.userId, fieldDayId: item.fieldDayId, exhibitorId: item.exhibitorId, id: item.id, title: item.title, revision: item.revision, ...(item.kind === "NOTE" ? { text: item.text ?? "" } : { driveFileId: item.driveFileId }) }, `${contextKey(item, item.id)}:${item.revision}`);
      await persist({ state: "SYNCED", nextAttemptAt: 0 });
    } catch (error) {
      const code = error instanceof PortError ? error.code : "RETRY";
      await persist({ state: code === "REAUTH" ? "BLOCKED_REAUTH" : code === "CONFLICT" ? "CONFLICT" : code === "FINAL" || item.attempts >= 5 ? "FAILED_FINAL" : "FAILED_RETRYABLE", error: code, nextAttemptAt: this.now() + Math.min(60_000, 1000 * 2 ** item.attempts) });
    }
    return item;
  }
}
