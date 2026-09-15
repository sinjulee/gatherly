import { createClientUploadId, type QueuedUpload } from "@/lib/upload-queue";

export type FrozenCaptureContext = { fieldDayId: string; companyId: string; sourceIndexId: string; exhibitionId: string };

export function queueCompanyFiles(files: File[], type: QueuedUpload["type"], context: FrozenCaptureContext): QueuedUpload[] {
  return files.map((file) => ({
    clientUploadId: createClientUploadId(), fieldDayId: context.fieldDayId, companyId: context.companyId,
    sourceIndexId: context.sourceIndexId, exhibitionId: context.exhibitionId, type, file, title: file.name,
    capturedAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
    state: "PENDING", createdAt: new Date().toISOString(),
  }));
}

export function queuedUploadForm(record: QueuedUpload) {
  const form = new FormData();
  form.set("fieldDayId", record.fieldDayId);
  form.set("clientUploadId", record.clientUploadId);
  form.set("type", record.type);
  form.set("title", record.title);
  if (record.capturedAt) form.set("capturedAt", record.capturedAt);
  if (record.companyId) form.set("companyId", record.companyId);
  if (record.sourceIndexId) form.set("sourceIndexId", record.sourceIndexId);
  if (record.exhibitionId) form.set("exhibitionId", record.exhibitionId);
  form.set("file", record.file);
  return form;
}
