/** Synthetic fixture format, NOT a parser verified against k-eco's live HTML. */
export type DirectoryRow = { externalId: string; nameKo: string; nameEn: string | null; brandKo: string | null; brandEn: string | null; booth: string | null; category: string | null; items: string | null; descriptionKo: string | null; descriptionEn: string | null; address: string | null; website: string | null; sns: string | null; program: string | null; logoUrl: string | null };
export type StagedExhibitor = DirectoryRow & { sourceId: string; sourceUrl: string; retrievedAt: string; status: "REVIEW" | "INVALID"; warnings: string[]; synthetic: true };
export interface DirectoryParser { parse(input: string, sourceId: string, retrievedAt: string): StagedExhibitor[] }
const text = (value: string) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
export function safeSourceUrl(value: string) { try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "fixture.invalid" && !url.username && !url.password; } catch { return false; } }
export class FixtureDirectoryParser implements DirectoryParser {
  parse(input: string, sourceId: string, retrievedAt: string) {
    if (!sourceId || !Number.isFinite(Date.parse(retrievedAt))) throw new Error("INVALID_SOURCE");
    const seen = new Set<string>();
    return [...input.matchAll(/<article data-id="([^"]*)" data-url="([^"]*)">([\s\S]*?)<\/article>/g)].map(match => {
      const fields = new Map([...match[3].matchAll(/<dd data-field="([^"]+)">([^<]*)<\/dd>/g)].map(field => [field[1], text(field[2])]));
      const get = (name: string) => fields.get(name) || null;
      const externalId = text(match[1]); const sourceUrl = text(match[2]); const warnings: string[] = [];
      if (!externalId || !get("nameKo")) warnings.push("REQUIRED_FIELD");
      if (!safeSourceUrl(sourceUrl)) warnings.push("SOURCE_URL");
      if (seen.has(externalId)) warnings.push("DUPLICATE_SOURCE_ID");
      seen.add(externalId);
      const booth = get("booth"); if (!booth || !/^TEST-[0-9]+$/.test(booth)) warnings.push("BOOTH_REVIEW");
      if (!get("descriptionKo")) warnings.push("MISSING_DESCRIPTION");
      warnings.push("RIGHTS_UNVERIFIED", "SYNTHETIC_FIXTURE");
      return { externalId, nameKo: get("nameKo") ?? "", nameEn: get("nameEn"), brandKo: get("brandKo"), brandEn: get("brandEn"), booth, category: get("category"), items: get("items"), descriptionKo: get("descriptionKo"), descriptionEn: get("descriptionEn"), address: get("address"), website: get("website"), sns: get("sns"), program: get("program"), logoUrl: get("logoUrl"), sourceId, sourceUrl, retrievedAt, synthetic: true as const, status: warnings.some(w => ["REQUIRED_FIELD", "SOURCE_URL", "DUPLICATE_SOURCE_ID"].includes(w)) ? "INVALID" as const : "REVIEW" as const, warnings };
    });
  }
}
/** CSV/Excel adapters normalize to this same staging contract; no publishing port in Phase 1. */
export interface TabularDirectoryAdapter { parseRows(rows: Record<string, string>[]): DirectoryRow[] }
