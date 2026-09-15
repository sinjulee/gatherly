import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const databaseUrl = process.env.PHASE5_DATABASE_URL;
const storageRoot = process.env.PHASE5_STORAGE_ROOT;
if (!databaseUrl?.startsWith("file:") || !storageRoot) throw new Error("Temporary PHASE5_DATABASE_URL and PHASE5_STORAGE_ROOT are required.");
const databasePath = path.resolve(databaseUrl.slice(5));
const resolvedStorage = path.resolve(storageRoot);
const roots = [path.resolve(os.tmpdir()), path.resolve("/private/tmp"), path.resolve("/tmp")];
for (const target of [databasePath, resolvedStorage]) assert(roots.some((root) => target.startsWith(root + path.sep)), "Phase 5 test targets must be temporary.");
assert.notEqual(databasePath, path.resolve("prisma/dev.db"), "Never characterize against the live dev DB.");
await mkdir(resolvedStorage, { recursive: true });
process.env.DATABASE_URL = databaseUrl;
process.env.STORAGE_ROOT = resolvedStorage;

const { prisma } = await import("../lib/prisma");
const materials = await import("../app/api/materials/route");
const upload = await import("../app/api/materials/upload/route");
const { queueCompanyFiles, queuedUploadForm } = await import("../lib/company-capture-queue");

const suffix = Date.now() + "-" + Math.random().toString(36).slice(2);
type Stored = { id: string; type: string; fieldDayId: string | null; companyId: string | null; sourceIndexId: string | null; uploadStatus: string };
function json(body: unknown) {
  return new Request("http://phase5.local/api/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function fileRequest(fieldDayId: string, clientUploadId: string, type: "IMAGE" | "VIDEO" | "AUDIO", file: File, context: Record<string, string> = {}) {
  const form = new FormData();
  form.set("fieldDayId", fieldDayId); form.set("clientUploadId", clientUploadId); form.set("type", type); form.set("file", file);
  for (const [key, value] of Object.entries(context)) form.set(key, value);
  return new Request("http://phase5.local/api/materials/upload", { method: "POST", body: form });
}
async function stored(response: Response, status = 201) {
  assert.equal(response.status, status, JSON.stringify(await response.clone().json()));
  const payload = await response.json() as { material: Stored; idempotent?: boolean };
  assert.equal(payload.material.uploadStatus, "STORED");
  return payload;
}

const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "capture.png", { type: "image/png" });
const mp4 = new File([new Uint8Array([0, 0, 0, 1])], "capture.mp4", { type: "video/mp4" });
const mp3 = new File([new Uint8Array([73, 68, 51, 3])], "capture.mp3", { type: "audio/mpeg" });
try {
  const exhibition = await prisma.exhibition.findFirstOrThrow({ where: { nameEn: "ENTECH 2026" } });
  const index = await prisma.curationIndex.findFirstOrThrow({ where: { exhibitionId: exhibition.id, name: "AI 활용 기술" } });
  const member = await prisma.companyIndex.findFirstOrThrow({ where: { indexId: index.id }, select: { companyId: true } });
  const outsider = await prisma.exhibitionCompany.findFirstOrThrow({ where: { exhibitionId: exhibition.id, companyId: { not: member.companyId } }, select: { companyId: true } });
  const unlisted = await prisma.exhibitionCompany.findFirstOrThrow({ where: { exhibitionId: exhibition.id, companyId: { notIn: (await prisma.companyIndex.findMany({ where: { indexId: index.id }, select: { companyId: true } })).map((row) => row.companyId) } }, select: { companyId: true } });
  assert.notEqual(outsider.companyId, member.companyId);
  const fieldDay = await prisma.fieldDay.create({ data: { title: "Phase5 linked " + suffix, exhibitionId: exhibition.id, status: "ACTIVE" } });
  const legacyDay = await prisma.fieldDay.create({ data: { title: "Phase5 legacy " + suffix, status: "ACTIVE" } });
  const context = { companyId: member.companyId, sourceIndexId: index.id, exhibitionId: exhibition.id };

  // All four legacy API payloads remain valid without company/index context.
  for (const [type, file] of [["IMAGE", png], ["VIDEO", mp4], ["AUDIO", mp3]] as const) {
    const result = await stored(await upload.POST(fileRequest(legacyDay.id, "legacy-" + type + "-" + suffix, type, file)));
    assert.equal(result.material.companyId, null); assert.equal(result.material.sourceIndexId, null);
  }
  const legacyText = await stored(await materials.POST(json({ fieldDayId: legacyDay.id, content: "legacy memo", clientUploadId: "legacy-text-" + suffix })));
  assert.equal(legacyText.material.companyId, null);

  // Company context is written with the initial Material record, not a later PATCH.
  const captured: Stored[] = [];
  for (const [type, file] of [["IMAGE", png], ["VIDEO", mp4], ["AUDIO", mp3]] as const) {
    const id = "context-" + type + "-" + suffix;
    const first = await stored(await upload.POST(fileRequest(fieldDay.id, id, type, file, context)));
    assert.equal(first.material.companyId, member.companyId); assert.equal(first.material.sourceIndexId, index.id);
    captured.push(first.material);
    const again = await stored(await upload.POST(fileRequest(fieldDay.id, id, type, file, context)), 200);
    assert.equal(again.material.id, first.material.id); assert.equal(again.idempotent, true);
    assert.equal((await upload.POST(fileRequest(fieldDay.id, id, type, file, { ...context, companyId: unlisted.companyId }))).status, 409);
    assert.equal((await upload.POST(fileRequest(fieldDay.id, id, type, file, { ...context, sourceIndexId: "different-index" }))).status, 409);
  }
  const textPayload = { fieldDayId: fieldDay.id, type: "TEXT", title: "Field memo", content: "Observed evidence", clientUploadId: "context-TEXT-" + suffix, ...context };
  const text = await stored(await materials.POST(json(textPayload)));
  assert.equal(text.material.companyId, member.companyId); assert.equal(text.material.sourceIndexId, index.id);
  assert.equal((await stored(await materials.POST(json(textPayload)), 200)).material.id, text.material.id);
  assert.equal((await materials.POST(json({ ...textPayload, companyId: unlisted.companyId }))).status, 409);
  assert.equal((await materials.POST(json({ ...textPayload, sourceIndexId: "different-index" }))).status, 409);

  const otherExhibition = await prisma.exhibition.create({ data: { name: "Other exhibition " + suffix } });
  const otherIndex = await prisma.curationIndex.create({ data: { exhibitionId: otherExhibition.id, name: "Other index " + suffix, indexType: "PERSONAL" } });
  const otherDay = await prisma.fieldDay.create({ data: { title: "Other day " + suffix, exhibitionId: otherExhibition.id } });
  assert.equal((await upload.POST(fileRequest(fieldDay.id, "wrong-index-" + suffix, "IMAGE", png, { ...context, sourceIndexId: otherIndex.id }))).status, 409);
  assert.equal((await upload.POST(fileRequest(fieldDay.id, "no-membership-" + suffix, "IMAGE", png, { ...context, companyId: unlisted.companyId }))).status, 422);
  assert.equal((await upload.POST(fileRequest(otherDay.id, "wrong-day-" + suffix, "IMAGE", png, context))).status, 409);
  assert.equal((await upload.POST(fileRequest(fieldDay.id, "missing-company-" + suffix, "IMAGE", png, { ...context, companyId: "deleted-company" }))).status, 422);
  assert.equal((await upload.POST(fileRequest(fieldDay.id, "missing-index-" + suffix, "IMAGE", png, { ...context, sourceIndexId: "deleted-index" }))).status, 422);
  assert.equal((await materials.POST(json({ ...textPayload, clientUploadId: "invalid-context-" + suffix, companyId: 123 }))).status, 400);
  const malformedForm = new FormData();
  malformedForm.set("fieldDayId", fieldDay.id); malformedForm.set("clientUploadId", "malformed-" + suffix);
  malformedForm.set("type", "IMAGE"); malformedForm.set("file", png); malformedForm.set("companyId", "x".repeat(101));
  assert.equal((await upload.POST(new Request("http://phase5.local/api/materials/upload", { method: "POST", body: malformedForm }))).status, 400);

  const frozen = queueCompanyFiles([png, png, png], "IMAGE", { fieldDayId: fieldDay.id, ...context });
  assert.equal(frozen.length, 3);
  assert.equal(new Set(frozen.map((row) => row.clientUploadId)).size, 3);
  for (const row of frozen) {
    assert.equal(row.companyId, member.companyId); assert.equal(row.sourceIndexId, index.id); assert.equal(row.exhibitionId, exhibition.id);
    const retry = queuedUploadForm({ ...row, state: "FAILED" });
    assert.equal(retry.get("companyId"), member.companyId); assert.equal(retry.get("sourceIndexId"), index.id);
    const result = await stored(await upload.POST(new Request("http://phase5.local/api/materials/upload", { method: "POST", body: retry })));
    captured.push(result.material);
  }
  const listed = await materials.GET(new Request("http://phase5.local/api/materials?companyId=" + member.companyId));
  assert.equal(listed.status, 200);
  const companyMaterials = (await listed.json() as { materials: Stored[] }).materials;
  for (const item of [...captured, text.material]) assert(companyMaterials.some((row) => row.id === item.id));

  // OnDelete: SetNull keeps evidence rows after a Personal Index or Company is hard-deleted.
  const personal = await prisma.curationIndex.create({ data: { exhibitionId: exhibition.id, name: "Phase5 personal " + suffix, indexType: "PERSONAL" } });
  await prisma.companyIndex.create({ data: { companyId: member.companyId, indexId: personal.id, source: "USER" } });
  const personalMaterial = (await stored(await materials.POST(json({ ...textPayload, clientUploadId: "personal-" + suffix, sourceIndexId: personal.id })))).material;
  await prisma.curationIndex.delete({ where: { id: personal.id } });
  const afterIndexDelete = await prisma.material.findUniqueOrThrow({ where: { id: personalMaterial.id } });
  assert.equal(afterIndexDelete.companyId, member.companyId); assert.equal(afterIndexDelete.sourceIndexId, null);

  const temporaryCompany = await prisma.company.create({ data: { name: "Phase5 temporary company " + suffix } });
  await prisma.exhibitionCompany.create({ data: { exhibitionId: exhibition.id, companyId: temporaryCompany.id } });
  const companyMaterial = (await stored(await materials.POST(json({ fieldDayId: fieldDay.id, type: "TEXT", content: "Preserve evidence", clientUploadId: "delete-company-" + suffix, companyId: temporaryCompany.id, exhibitionId: exhibition.id })))).material;
  await prisma.company.delete({ where: { id: temporaryCompany.id } });
  const afterCompanyDelete = await prisma.material.findUniqueOrThrow({ where: { id: companyMaterial.id } });
  assert.equal(afterCompanyDelete.companyId, null); assert.equal(afterCompanyDelete.id, companyMaterial.id);

  console.log(JSON.stringify({ ok: true, databasePath, storageRoot: resolvedStorage, checks: [
    "legacy context-free IMAGE/VIDEO/AUDIO/TEXT",
    "Company IMAGE/VIDEO/AUDIO/TEXT with same-transaction context",
    "source Index, exhibition, membership and FieldDay validation",
    "three-photo queue context freeze and retry FormData",
    "clientUploadId same-context idempotency and changed-context 409",
    "company-filtered Material GET and Index/Company SetNull evidence preservation",
  ] }, null, 2));
} finally { await prisma.$disconnect(); }
