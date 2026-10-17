import test from "node:test";
import assert from "node:assert/strict";
import { MockCatalog, MockDrive, MockSheets, MockQueue, MockReports } from "../lib/gatherly-2/mock-storage";
import { SyncWorker } from "../lib/gatherly-2/sync";
import { demoExhibitors } from "../lib/gatherly-2/map";
import type { SyncItem } from "../lib/gatherly-2/contracts";
const item = (kind: "NOTE" | "MEDIA" = "MEDIA"): SyncItem => ({ id: "asset", userId: "a", fieldDayId: "day", exhibitorId: "company", title: "test", kind, blob: kind === "MEDIA" ? new Blob(["synthetic"]) : undefined, text: "note", revision: 1, attempts: 0, nextAttemptAt: 0, state: "LOCAL_PENDING" });
test("catalog hides drafts and other exhibitions", async () => {
  const catalog = new MockCatalog([...demoExhibitors, { ...demoExhibitors[0], review: "PUBLISHED" }]);
  assert.equal((await catalog.list("test-esg")).length, 1); assert.equal((await catalog.list("other")).length, 0);
});
test("Drive succeeded/Sheets failed: resume without duplicate upload, including stale snapshot", async () => {
  const queue = new MockQueue(), drive = new MockDrive("a"), sheets = new MockSheets("a");
  const worker = new SyncWorker(queue, drive, sheets, () => 100); sheets.failNext = "RETRY";
  const first = await worker.run(item()); assert.equal(first.state, "FAILED_RETRYABLE"); assert.ok(first.driveFileId);
  assert.equal((await worker.run(item())).state, "FAILED_RETRYABLE"); // backoff
  assert.equal((await worker.run(item(), true)).state, "SYNCED");
  assert.equal(drive.uploads, 1); assert.equal((await sheets.list("a")).length, 1); assert.ok((await queue.list("a"))[0].blob);
});
test("concurrent retries coalesce; queue isolates users; note skips Drive", async () => {
  const queue = new MockQueue(), drive = new MockDrive("a"), sheets = new MockSheets("a"), worker = new SyncWorker(queue, drive, sheets);
  const results = await Promise.all(Array.from({ length: 8 }, () => worker.run(item("NOTE"))));
  assert.ok(results.every(row => row.state === "SYNCED")); assert.equal(drive.uploads, 0);
  assert.equal((await queue.list("b")).length, 0); await assert.rejects(sheets.list("b"));
  await assert.rejects(drive.upload({ ...item(), userId: "b" }, "x", new Blob(["x"])));
});
test("Sheet optimistic revision conflicts; duplicate mutation with different body rejected", async () => {
  const sheets = new MockSheets("a");
  const record = { userId: "a", fieldDayId: "day", exhibitorId: "company", id: "n", title: "note", revision: 1, text: "first" };
  await sheets.upsert(record, "1"); await sheets.upsert(record, "1");
  await assert.rejects(sheets.upsert({ ...record, text: "changed" }, "1"), /CONFLICT/);
  await assert.rejects(sheets.upsert({ ...record, text: "changed" }, "2"), /CONFLICT/);
  await sheets.upsert({ ...record, text: "second", revision: 2 }, "2"); assert.equal((await sheets.list("a"))[0].text, "second");
});
test("reauth blocks auto retries; interrupted upload recovers with same identity", async () => {
  const queue = new MockQueue(), drive = new MockDrive("a"), sheets = new MockSheets("a"), worker = new SyncWorker(queue, drive, sheets);
  sheets.failNext = "REAUTH"; assert.equal((await worker.run(item())).state, "BLOCKED_REAUTH");
  assert.equal((await worker.run(item())).state, "BLOCKED_REAUTH"); assert.equal((await worker.run(item(), true)).state, "SYNCED");
  const next = { ...item(), id: "interrupted", state: "DRIVE_UPLOADING" as const }; await queue.put(next);
  await drive.upload(next, next.id, next.blob!); assert.equal((await worker.run(next)).state, "SYNCED"); assert.equal(drive.uploads, 2);
});
test("permanent conflict stops retries and transient retries are bounded", async () => {
  const queue = new MockQueue(), drive = new MockDrive("a"), sheets = new MockSheets("a"), worker = new SyncWorker(queue, drive, sheets);
  for (let i = 0; i < 5; i++) { sheets.failNext = "RETRY"; await worker.run(item(), true); }
  assert.equal((await queue.list("a"))[0].state, "FAILED_FINAL"); assert.equal(drive.uploads, 1);
  const next = { ...item("NOTE"), id: "conflict" }; sheets.failNext = "CONFLICT";
  assert.equal((await worker.run(next)).state, "CONFLICT"); assert.equal((await worker.run(next, true)).state, "CONFLICT");
});
test("report mock protects owner and idempotency without entitlement restricting old reads", async () => {
  const reports = new MockReports(); const first = await reports.save("a", "request", "body");
  assert.deepEqual(await reports.save("a", "request", "body"), first);
  await assert.rejects(reports.save("a", "request", "changed"), /CONFLICT/); await assert.rejects(reports.read("b", first.documentId));
  assert.equal(await reports.read("a", first.documentId), "body");
});
