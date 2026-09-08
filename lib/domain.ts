export const FIELD_DAY_STATUSES = ["ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export const MATERIAL_TYPES = ["IMAGE", "VIDEO", "AUDIO", "TEXT"] as const;
export const UPLOAD_STATUSES = ["PENDING", "UPLOADING", "STORED", "FAILED"] as const;

export type FieldDayStatus = (typeof FIELD_DAY_STATUSES)[number];
export type MaterialType = (typeof MATERIAL_TYPES)[number];
export type UploadStatus = (typeof UPLOAD_STATUSES)[number];

export function isFieldDayStatus(value: unknown): value is FieldDayStatus {
  return typeof value === "string" && FIELD_DAY_STATUSES.includes(value as FieldDayStatus);
}

export function isMaterialType(value: unknown): value is MaterialType {
  return typeof value === "string" && MATERIAL_TYPES.includes(value as MaterialType);
}

export function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length <= maxLength ? cleaned : null;
}

export function parseOptionalDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}
