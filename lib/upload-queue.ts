export type QueueState = "PENDING" | "UPLOADING" | "FAILED" | "STORED";
export type QueuedUpload = {
  clientUploadId: string;
  fieldDayId: string;
  type: "IMAGE" | "VIDEO" | "AUDIO";
  file: File;
  title: string;
  capturedAt?: string;
  state: QueueState;
  error?: string;
  createdAt: string;
};

const DATABASE_NAME = "gatherly-upload-queue";
const STORE_NAME = "uploads";

export function createClientUploadId() {
  const webCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();

  if (typeof webCrypto?.getRandomValues === "function") {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  return `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function database() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("이 브라우저에서는 임시 보관을 지원하지 않습니다."));
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "clientUploadId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("임시 보관소를 열 수 없습니다."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = action(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("임시 보관 작업에 실패했습니다."));
    tx.onabort = () => reject(tx.error ?? new Error("임시 보관 작업에 실패했습니다."));
  }).finally(() => db.close());
}

export function saveQueuedUpload(record: QueuedUpload) {
  return transaction("readwrite", (store) => store.put(record));
}

export function removeQueuedUpload(clientUploadId: string) {
  return transaction("readwrite", (store) => store.delete(clientUploadId));
}

export function listQueuedUploads() {
  return transaction<QueuedUpload[]>("readonly", (store) => store.getAll());
}

export async function discardQueuedUpload(clientUploadId: string) {
  await removeQueuedUpload(clientUploadId);
}

export async function requestPersistentStorage() {
  if (typeof navigator === "undefined" || !navigator.storage) return { supported: false, persisted: false, quota: 0, usage: 0 };
  const estimate = await navigator.storage.estimate();
  const persisted = navigator.storage.persist ? await navigator.storage.persist().catch(() => false) : false;
  return { supported: true, persisted, quota: estimate.quota ?? 0, usage: estimate.usage ?? 0 };
}
