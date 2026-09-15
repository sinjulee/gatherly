import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const databaseUrl = process.env.PHASE0_DATABASE_URL;
const storageRoot = process.env.PHASE0_STORAGE_ROOT;

if (!databaseUrl?.startsWith("file:")) throw new Error("PHASE0_DATABASE_URL must be an absolute SQLite file URL.");
if (!storageRoot) throw new Error("PHASE0_STORAGE_ROOT is required.");

const databasePath = path.resolve(databaseUrl.slice("file:".length));
const resolvedStorageRoot = path.resolve(storageRoot);
const temporaryRoots = [path.resolve(os.tmpdir()), path.resolve("/private/tmp"), path.resolve("/tmp")];
const liveDatabasePath = path.resolve(process.cwd(), "prisma/dev.db");

function isUnderTemporaryRoot(target: string) {
  return temporaryRoots.some((root) => target.startsWith(root + path.sep));
}

assert.notEqual(databasePath, liveDatabasePath, "Refusing to run characterization tests against prisma/dev.db.");
assert(isUnderTemporaryRoot(databasePath), "The characterization database must be under an approved temporary directory.");
assert(isUnderTemporaryRoot(resolvedStorageRoot), "The characterization storage root must be under an approved temporary directory.");

process.env.DATABASE_URL = databaseUrl;
process.env.STORAGE_ROOT = resolvedStorageRoot;

const fieldDaysCollection = await import("../app/api/field-days/route");
const fieldDayItem = await import("../app/api/field-days/[id]/route");
const materialsCollection = await import("../app/api/materials/route");
const materialUpload = await import("../app/api/materials/upload/route");
const materialItem = await import("../app/api/materials/[id]/route");
const materialFile = await import("../app/api/materials/[id]/file/route");
const { prisma } = await import("../lib/prisma");

function jsonRequest(pathname: string, method: string, body: unknown) {
  return new Request(`http://phase0.local${pathname}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function responseJson<T>(response: Response) {
  return await response.json() as T;
}

type FieldDayRecord = { id: string; title: string; status: string };
type MaterialRecord = {
  id: string;
  type: string;
  content: string | null;
  uploadStatus: string;
  fieldDayId: string | null;
  companyId?: string;
  sourceIndexId?: string;
};

const testSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fieldDayTitle = `Phase 0 characterization ${testSuffix}`;

try {
  const createFieldDayResponse = await fieldDaysCollection.POST(jsonRequest("/api/field-days", "POST", {
    title: fieldDayTitle,
    description: "Temporary copy only",
    location: "Phase 0",
    fieldDate: "2026-09-15T00:00:00.000Z",
    status: "ACTIVE",
  }));
  assert.equal(createFieldDayResponse.status, 201);
  const createdFieldDay = (await responseJson<{ project: FieldDayRecord }>(createFieldDayResponse)).project;
  assert.equal(createdFieldDay.title, fieldDayTitle);

  const listFieldDaysResponse = await fieldDaysCollection.GET();
  assert.equal(listFieldDaysResponse.status, 200);
  const listedFieldDays = (await responseJson<{ projects: FieldDayRecord[] }>(listFieldDaysResponse)).projects;
  assert(listedFieldDays.some((fieldDay: { id: string }) => fieldDay.id === createdFieldDay.id));

  const updateFieldDayResponse = await fieldDayItem.PATCH(
    jsonRequest(`/api/field-days/${createdFieldDay.id}`, "PATCH", {
      title: `${fieldDayTitle} updated`,
      description: "Temporary copy updated",
      location: "Phase 0 copy",
      fieldDate: "2026-09-16T00:00:00.000Z",
      status: "COMPLETED",
    }),
    { params: Promise.resolve({ id: createdFieldDay.id }) },
  );
  assert.equal(updateFieldDayResponse.status, 200);
  assert.equal((await responseJson<{ project: FieldDayRecord }>(updateFieldDayResponse)).project.status, "COMPLETED");

  const textClientUploadId = `phase0-text-${testSuffix}`;
  const textPayload = {
    fieldDayId: createdFieldDay.id,
    title: "Phase 0 text",
    content: "Existing context-free TEXT request",
    clientUploadId: textClientUploadId,
  };
  const createTextResponse = await materialsCollection.POST(jsonRequest("/api/materials", "POST", textPayload));
  assert.equal(createTextResponse.status, 201);
  const textMaterial = (await responseJson<{ material: MaterialRecord }>(createTextResponse)).material;
  assert.equal(textMaterial.type, "TEXT");
  assert.equal(textMaterial.uploadStatus, "STORED");

  const idempotentTextResponse = await materialsCollection.POST(jsonRequest("/api/materials", "POST", textPayload));
  assert.equal(idempotentTextResponse.status, 200);
  const idempotentText = await responseJson<{ idempotent: boolean; material: MaterialRecord }>(idempotentTextResponse);
  assert.equal(idempotentText.idempotent, true);
  assert.equal(idempotentText.material.id, textMaterial.id);

  const updateTextResponse = await materialItem.PATCH(
    jsonRequest(`/api/materials/${textMaterial.id}`, "PATCH", { title: "Phase 0 text updated", content: "Updated text" }),
    { params: Promise.resolve({ id: textMaterial.id }) },
  );
  assert.equal(updateTextResponse.status, 200);
  assert.equal((await responseJson<{ material: MaterialRecord }>(updateTextResponse)).material.content, "Updated text");

  const uploadClientUploadId = `phase0-image-${testSuffix}`;
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function uploadRequest() {
    const form = new FormData();
    form.set("fieldDayId", createdFieldDay.id);
    form.set("clientUploadId", uploadClientUploadId);
    form.set("type", "IMAGE");
    form.set("title", "Phase 0 image");
    form.set("capturedAt", "2026-09-15T00:00:00.000Z");
    form.set("file", new File([pngBytes], "phase0.png", { type: "image/png" }));
    return new Request("http://phase0.local/api/materials/upload", { method: "POST", body: form });
  }

  const uploadResponse = await materialUpload.POST(uploadRequest());
  assert.equal(uploadResponse.status, 201);
  const imageMaterial = (await responseJson<{ material: MaterialRecord }>(uploadResponse)).material;
  assert.equal(imageMaterial.type, "IMAGE");
  assert.equal(imageMaterial.uploadStatus, "STORED");
  assert.equal(imageMaterial.fieldDayId, createdFieldDay.id);
  assert.equal(imageMaterial.companyId, null);
  assert.equal(imageMaterial.sourceIndexId, null);

  const idempotentUploadResponse = await materialUpload.POST(uploadRequest());
  assert.equal(idempotentUploadResponse.status, 200);
  const idempotentUpload = await responseJson<{ idempotent: boolean; material: MaterialRecord }>(idempotentUploadResponse);
  assert.equal(idempotentUpload.idempotent, true);
  assert.equal(idempotentUpload.material.id, imageMaterial.id);

  const fileResponse = await materialFile.GET(
    new Request(`http://phase0.local/api/materials/${imageMaterial.id}/file`),
    { params: Promise.resolve({ id: imageMaterial.id }) },
  );
  assert.equal(fileResponse.status, 200);
  assert.equal(fileResponse.headers.get("content-type"), "image/png");
  assert.equal((await fileResponse.arrayBuffer()).byteLength, pngBytes.byteLength);

  const rangeResponse = await materialFile.GET(
    new Request(`http://phase0.local/api/materials/${imageMaterial.id}/file`, { headers: { Range: "bytes=0-3" } }),
    { params: Promise.resolve({ id: imageMaterial.id }) },
  );
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeResponse.headers.get("content-range"), `bytes 0-3/${pngBytes.byteLength}`);
  assert.equal((await rangeResponse.arrayBuffer()).byteLength, 4);

  const filteredMaterialsResponse = await materialsCollection.GET(
    new Request(`http://phase0.local/api/materials?fieldDayId=${createdFieldDay.id}&type=IMAGE`),
  );
  assert.equal(filteredMaterialsResponse.status, 200);
  const filteredMaterials = (await responseJson<{ materials: MaterialRecord[] }>(filteredMaterialsResponse)).materials;
  assert(filteredMaterials.some((material: { id: string }) => material.id === imageMaterial.id));

  for (const materialId of [textMaterial.id, imageMaterial.id]) {
    const deleteResponse = await materialItem.DELETE(
      new Request(`http://phase0.local/api/materials/${materialId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: materialId }) },
    );
    assert.equal(deleteResponse.status, 200);
    const deletedMaterial = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });
    assert(deletedMaterial.deletedAt instanceof Date);
  }

  const deleteFieldDayResponse = await fieldDayItem.DELETE(
    new Request(`http://phase0.local/api/field-days/${createdFieldDay.id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id: createdFieldDay.id }) },
  );
  assert.equal(deleteFieldDayResponse.status, 200);
  const deletedFieldDay = await prisma.fieldDay.findUniqueOrThrow({ where: { id: createdFieldDay.id } });
  assert.equal(deletedFieldDay.status, "ARCHIVED");
  assert(deletedFieldDay.deletedAt instanceof Date);

  const queueSource = await readFile(path.resolve(process.cwd(), "lib/upload-queue.ts"), "utf8");
  for (const contractFragment of [
    'export type QueueState = "PENDING" | "UPLOADING" | "FAILED" | "STORED"',
    "clientUploadId: string",
    "fieldDayId: string",
    'type: "IMAGE" | "VIDEO" | "AUDIO"',
    "file: File",
    "title: string",
    "capturedAt?: string",
    "state: QueueState",
    "error?: string",
    "createdAt: string",
    'const DATABASE_NAME = "gatherly-upload-queue"',
    'const STORE_NAME = "uploads"',
    "indexedDB.open(DATABASE_NAME, 1)",
    'keyPath: "clientUploadId"',
  ]) assert(queueSource.includes(contractFragment), `IndexedDB contract changed: ${contractFragment}`);
  for (const optionalField of ["companyId?: string", "sourceIndexId?: string", "exhibitionId?: string"]) {
    assert(queueSource.includes(optionalField), `Phase 5 optional queue contract missing: ${optionalField}`);
  }

  const inboxSource = await readFile(path.resolve(process.cwd(), "components/inbox-workspace.tsx"), "utf8");
  assert(inboxSource.includes("Math.min(2, jobs.length)"), "Upload concurrency contract changed.");
  assert(inboxSource.includes('capture="environment"'), "Camera capture contract changed.");
  assert(inboxSource.includes("multiple"), "Multiple-file input contract changed.");
  assert(inboxSource.includes('data.material?.uploadStatus !== "STORED"'), "STORED acknowledgement contract changed.");
  assert(inboxSource.includes("await removeQueuedUpload(record.clientUploadId)"), "Queue removal contract changed.");

  console.log(JSON.stringify({
    ok: true,
    databasePath,
    storageRoot: resolvedStorageRoot,
    checks: [
      "FieldDay list/create/update/soft-delete",
      "TEXT create/update/soft-delete/idempotency",
      "context-free IMAGE upload/soft-delete/idempotency",
      "file preview and Range response",
      "Material fieldDay/type filtering",
      "IndexedDB v1 serialization source contract",
      "camera/multiple/concurrency-2/STORED queue-removal source contract",
    ],
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
