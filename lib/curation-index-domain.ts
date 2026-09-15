export const CURATION_INDEX_TYPES = ["SYSTEM", "PERSONAL", "DYNAMIC"] as const;

export function requiredIndexText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

export function optionalIndexText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned.length <= maxLength ? cleaned || null : undefined;
}

export function optionalInteger(value: unknown, minimum: number, maximum: number) {
  if (value === undefined || value === null || value === "") return null;
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : undefined;
}

export function optionalHexColor(value: unknown) {
  const color = optionalIndexText(value, 9);
  if (color === null) return null;
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : undefined;
}
