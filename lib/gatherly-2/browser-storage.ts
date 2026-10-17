import { contextKey, type Context, type Note, type SyncItem, type LocalSyncQueue } from "./contracts";
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
  put(item: SyncItem) { return this.transaction<void>("readwrite", store => { store.put(item, `queue:${contextKey(item, item.id)}`); }); }
  async transfer(item: SyncItem) {
    const key = `transfer:${contextKey(item, item.id)}`;
    return this.transaction<SyncItem>("readwrite", (store, done) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result) { done(request.result as SyncItem); return; }
        const current = store.get(`queue:${contextKey(item, item.id)}`);
        current.onsuccess = () => { const snapshot = current.result as SyncItem; store.put(snapshot, key); done(snapshot); };
      };
    });
  }
  async finishTransfer(item: SyncItem) {
    return this.transaction<void>("readwrite", store => {
      const key = contextKey(item, item.id), current = store.get(`queue:${key}`);
      current.onsuccess = () => {
        // Never let an old upload replace a newer local edit.
        if (current.result?.revision === item.revision) store.put(item, `queue:${key}`);
        if (item.state === "SYNCED") store.delete(`transfer:${key}`);
        else store.put(item, `transfer:${key}`);
      };
    });
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
