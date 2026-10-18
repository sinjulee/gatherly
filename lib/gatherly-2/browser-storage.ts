import { contextKey, type Context, type Note, type SyncItem, type LocalSyncQueue } from "./contracts";
import { pilotKind, type PilotKind } from "./pilot-ui";
// Digests fence late queue writes without retaining clear record/user identifiers or content.
async function deletionDigest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export type Draft = Context & { title: string; text: string };
/** Separate database: never opens or upgrades legacy gatherly-upload-queue. */
export class BrowserWorkspace implements LocalSyncQueue {
  constructor(private name = "gatherly-v2-phase1-local") {}
  private async database() {
    if (typeof indexedDB === "undefined") throw new Error("이 브라우저는 로컬 저장을 지원하지 않습니다.");
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("records");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("로컬 저장소를 열 수 없습니다."));
    });
  }
  private async transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (value: T) => void) => void) {
    const db = await this.database();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction("records", mode); let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(new Error("기기 저장에 실패했습니다. 저장 공간과 브라우저 권한을 확인해 주세요."));
      tx.onerror = () => reject(new Error("기기 저장에 실패했습니다."));
      try { action(tx.objectStore("records"), result => { value = result; }); } catch (error) { tx.abort(); reject(error); }
    }).finally(() => db.close());
  }
  private get<T>(key: string) { return this.transaction<T | undefined>("readonly", (store, done) => { const request = store.get(key); request.onsuccess = () => done(request.result as T | undefined); }); }
  getNote(context: Context) { return this.get<Note>(`note:${contextKey(context, "note")}`); }
  getDraft(context: Context) { return this.get<Draft>(`draft:${contextKey(context, "note")}`); }
  saveDraft(draft: Draft) { return this.transaction<void>("readwrite", store => { store.put(draft, `draft:${contextKey(draft, "note")}`); }); }
  discardDraft(context: Context) { return this.transaction<void>("readwrite", store => { store.delete(`draft:${contextKey(context, "note")}`); }); }
  saveNote(draft: Draft) {
    if (!draft.text.trim()) return Promise.reject(new Error("메모 내용을 입력해 주세요."));
    return this.transaction<Note>("readwrite", (store, done) => {
      const key = contextKey(draft, "note"); const request = store.get(`note:${key}`);
      request.onsuccess = () => {
        const previous = request.result as Note | undefined;
        const note: Note = { ...draft, id: previous?.id ?? crypto.randomUUID(), revision: (previous?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
        const item: SyncItem = { ...note, kind: "NOTE", state: "LOCAL_PENDING", attempts: 0, nextAttemptAt: 0 };
        store.put(note, `note:${key}`); store.put(item, `queue:${contextKey(note, note.id)}`); store.delete(`draft:${key}`); done(note);
      };
    });
  }
  async put(item: SyncItem) {
    const key = contextKey(item, item.id), digest = await deletionDigest(key);
    const deleted = await this.transaction<boolean>('readwrite', (store, done) => {
      const check = store.get(`local-deleted:${digest}`);
      check.onsuccess = () => { if (!check.result) store.put(item, `queue:${key}`); done(!!check.result); };
    });
    if (deleted) throw new Error('이미 로컬 삭제한 자료입니다. 이전 전송 작업을 복원하지 않았습니다.');
  }
  async transfer(item: SyncItem) {
    const key = `transfer:${contextKey(item, item.id)}`;
    return this.transaction<SyncItem | undefined>("readwrite", (store, done) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result) { done(request.result as SyncItem); return; }
        const current = store.get(`queue:${contextKey(item, item.id)}`);
        current.onsuccess = () => { const snapshot = current.result as SyncItem | undefined; if (snapshot) store.put(snapshot, key); done(snapshot); };
      };
    }).then(snapshot => { if (!snapshot) throw new Error('로컬 삭제되었거나 존재하지 않는 자료입니다. 전송하지 않았습니다.'); return snapshot; });
  }
  async finishTransfer(item: SyncItem) {
    return this.transaction<void>("readwrite", store => {
      const key = contextKey(item, item.id), current = store.get(`queue:${key}`);
      current.onsuccess = () => {
        // Never recreate a deleted queue or its transfer snapshot.
        if (!current.result) return;
        // Never let an old upload replace a newer local edit.
        if (current.result?.revision === item.revision) store.put(item, `queue:${key}`);
        if (item.state === "SYNCED") store.delete(`transfer:${key}`);
        else store.put(item, `transfer:${key}`);
      };
    });
  }
  async deletedPilotKinds(userId: string) {
    const owner = await deletionDigest(userId);
    return this.transaction<PilotKind[]>("readonly", (store, done) => {
      const kinds: PilotKind[] = []; const request = store.openCursor();
      request.onsuccess = () => { const cursor = request.result;
        if (!cursor) { done(kinds); return; }
        if (String(cursor.key).startsWith("pilot-deleted:") && cursor.value.userId === userId) kinds.push(cursor.value.kind);
        if (String(cursor.key).startsWith("local-deleted:") && cursor.value.owner === owner && cursor.value.reserved) kinds.push(cursor.value.kind);
        cursor.continue();
      };
    });
  }
  async pilotLocalStatus(item: SyncItem, userId: string) {
    this.requirePilotOwner(item, userId);
    const snapshot = await this.get<SyncItem>(`transfer:${contextKey(item, item.id)}`);
    const uncertain = item.state !== 'SYNCED' && (!!snapshot || item.attempts > 0 || item.state !== 'LOCAL_PENDING');
    return {
      canDelete: true,
      canRecover: uncertain && ['LOCAL_PENDING', 'DRIVE_UPLOADING', 'SHEET_SYNCING'].includes(item.state),
      reason: uncertain ? '원격 결과 미확인 · 확인 후 로컬 삭제 가능. Google에 파일이 남아 있을 수 있으며 로컬 삭제로 원격 자료는 삭제되지 않습니다.' : item.state === 'SYNCED' ? '로컬 삭제 가능 · Google 원본 유지 · 원격 교체 불가' : '미전송 로컬 자료 · 삭제 후 다시 준비 가능',
    };
  }
  private requirePilotOwner(item: SyncItem, userId: string) {
    if (item.userId !== userId || item.fieldDayId !== 'storage-test-event' || item.exhibitorId !== 'storage-test-company') throw new Error('다른 사용자 또는 행사 자료는 삭제할 수 없습니다.');
  }
  /** Only normalize local interrupted state. A released browser lock does not prove remote completion. */
  async recoverPilotLocal(item: SyncItem, userId: string) {
    this.requirePilotOwner(item, userId);
    if (!navigator.locks) throw new Error('안전한 상태 확인 잠금을 지원하지 않는 브라우저입니다. 원본을 유지합니다.');
    return navigator.locks.request(`gatherly-pilot:${userId}`, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('이 브라우저에서 업로드 중입니다. 상태를 변경하지 않았습니다.');
      await this.transaction<void>('readwrite', (store, done) => {
        const key = contextKey(item, item.id), current = store.get(`queue:${key}`);
        current.onsuccess = () => {
          const row = current.result as SyncItem | undefined;
          if (!row || row.revision !== item.revision || !['LOCAL_PENDING', 'DRIVE_UPLOADING', 'SHEET_SYNCING'].includes(row.state)) { done(); return; }
          const transfer = store.get(`transfer:${key}`);
          transfer.onsuccess = () => {
            if (row.state === 'LOCAL_PENDING' && !transfer.result && !row.attempts) { done(); return; }
            // Preserve the original frozen operation, blob and revision; never invent a new ID.
            if (!transfer.result) store.put(row, `transfer:${key}`);
            store.put({ ...row, state: 'FAILED_RETRYABLE', attempts: Math.max(1, row.attempts) }, `queue:${key}`);
            done();
          };
        };
      });
    });
  }
  /** Only the dedicated pilot UI uses this. No remote API and no legacy database. */
  async deletePilotLocal(item: SyncItem, userId: string) {
    this.requirePilotOwner(item, userId);
    if (!navigator.locks) throw new Error('안전한 삭제 잠금을 지원하지 않는 브라우저입니다. 원본을 유지합니다.');
    const key = contextKey(item, item.id), digest = await deletionDigest(key), owner = await deletionDigest(userId);
    try {
      // The uploader holds this same cross-tab lock until its request and local bookkeeping finish.
      // Waiting never cancels a remote request or assumes a stale-looking state is still active.
      await navigator.locks.request(`gatherly-pilot:${userId}`, { signal: AbortSignal.timeout(30_000) }, async () => {
        const error = await this.transaction<string | undefined>('readwrite', (store, done) => {
          const request = store.get(`queue:${key}`);
          request.onsuccess = () => {
            const current = request.result as SyncItem | undefined;
            if (!current) { done(undefined); return; }
            if (current.revision !== item.revision) { done('자료가 수정되었습니다. 목록을 다시 확인해 주세요.'); return; }
            const transfer = store.get(`transfer:${key}`);
            transfer.onsuccess = () => {
              const reserved = !!transfer.result || current.attempts > 0 || current.state !== 'LOCAL_PENDING';
              // No content, filename, operation ID, file ID, token or clear user ID survives deletion.
              store.put(reserved ? { owner, kind: pilotKind(current), reserved: true } : {}, `local-deleted:${digest}`);
              store.delete(`queue:${key}`); store.delete(`transfer:${key}`); store.delete(`pilot-deleted:${key}`);
              if (current.kind === 'NOTE') { store.delete(`note:${contextKey(current, 'note')}`); store.delete(`draft:${contextKey(current, 'note')}`); }
              done(undefined);
            };
          };
        });
        if (error) throw new Error(error);
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('전송 종료를 확인하지 못해 삭제하지 않았습니다. 진행 중인 전송이 끝난 뒤 다시 삭제해 주세요. 원본은 유지됩니다.');
      throw error;
    }
  }

  async list(userId: string) {
    return this.transaction<SyncItem[]>("readonly", (store, done) => {
      const rows: SyncItem[] = []; const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { done(rows); return; }
        if (String(cursor.key).startsWith("queue:") && cursor.value.userId === userId) rows.push(cursor.value as SyncItem);
        cursor.continue();
      };
    });
  }
}
