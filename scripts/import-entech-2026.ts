import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const TARGET_SHEET = "리서치 DB (전체 180개사)";
const TARGET_ROW_COUNT = 180;
const EXHIBITION = {
  name: "2026 기후산업국제박람회",
  nameEn: "ENTECH 2026",
  venue: "BEXCO",
  status: "UPCOMING",
} as const;

const HEADERS = [
  "company_id",
  "company_name",
  "company_name_en",
  "booth",
  "country",
  "location",
  "founded",
  "website",
  "company_summary",
  "industry",
  "category",
  "business_type",
  "company_size",
  "main_products",
  "flagship_product",
  "product_summary",
  "target_customer",
  "customer_examples",
  "business_model",
  "core_technology",
  "ai_digital",
  "competitive_advantage",
  "competitors",
  "domestic_market",
  "global_market",
  "growth_signals",
  "funding",
  "revenue",
  "certifications",
  "recent_news",
  "recent_news_date",
  "exhibition_focus",
  "why_interesting",
  "benchmark_point",
  "collaboration_opportunity",
  "field_observation",
  "questions",
  "risk_or_unknown",
  "tags",
  "source",
  "last_checked",
  "innovation_score",
  "market_score",
  "differentiation_score",
  "collaboration_score",
  "research_value_score",
  "priority_score",
  "visit_grade",
] as const;

const SCORE_HEADERS = [
  "innovation_score",
  "market_score",
  "differentiation_score",
  "collaboration_score",
  "research_value_score",
  "priority_score",
  "visit_grade",
] as const;

type Header = (typeof HEADERS)[number];
type RawRow = Record<Header, string | null> & { rowNumber: number };

type CompanyData = Omit<Prisma.CompanyUncheckedCreateInput, "id" | "createdAt" | "updatedAt">;
type ParticipationData = Omit<
  Prisma.ExhibitionCompanyUncheckedCreateInput,
  "id" | "exhibitionId" | "companyId" | "createdAt" | "updatedAt"
>;

type NormalizedRow = {
  rowNumber: number;
  companyId: string | null;
  company: CompanyData;
  participation: ParticipationData;
  warnings: string[];
  errors: string[];
};

type ExistingLink = Prisma.ExhibitionCompanyGetPayload<{ include: { company: true } }>;
type PlanAction = "NEW" | "CREATE_LINK" | "UPDATE" | "SKIP" | "CONFLICT" | "INVALID";
type ImportPlan = {
  row: NormalizedRow;
  action: PlanAction;
  matchReason: "EXTERNAL_ID" | "WEBSITE_DOMAIN" | null;
  existingCompanyId: string | null;
  existingLinkId: string | null;
  conflictReason: string | null;
};

const NULL_VALUES = new Set(["", "-", "n/a", "정보 확인 필요", "확인 필요"]);
const COMPANY_FIELDS = [
  "externalId",
  "name",
  "nameEn",
  "country",
  "location",
  "founded",
  "website",
  "websiteDomain",
  "companySummary",
  "businessType",
  "companySize",
  "mainProductsJson",
  "flagshipProduct",
  "productSummary",
  "targetCustomerJson",
  "customerExamplesJson",
  "businessModel",
  "coreTechnology",
  "aiDigital",
  "competitiveAdvantage",
  "competitorsJson",
  "domesticMarket",
  "globalMarket",
  "growthSignals",
  "funding",
  "revenue",
  "certificationsJson",
  "recentNews",
  "recentNewsDate",
  "source",
  "lastChecked",
] as const;
const PARTICIPATION_FIELDS = [
  "externalCompanyId",
  "booth",
  "industry",
  "category",
  "exhibitionFocus",
  "whyInteresting",
  "benchmarkPoint",
  "collaborationOpportunity",
  "fieldObservation",
  "questionsJson",
  "riskOrUnknown",
  "rawTagsJson",
  "source",
  "lastChecked",
] as const;

function parseArguments() {
  const args = process.argv.slice(2);
  let sourcePath = process.env.ENTECH_XLSX_PATH ?? null;
  let databaseUrl = process.env.DATABASE_URL ?? `file:${path.resolve(process.cwd(), "prisma/dev.db")}`;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") dryRun = true;
    else if (argument === "--file") sourcePath = args[++index] ?? null;
    else if (argument === "--database-url") databaseUrl = args[++index] ?? "";
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!sourcePath) {
    throw new Error("Excel source is required. Pass --file <path> or set ENTECH_XLSX_PATH.");
  }
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Phase 2 importer only supports a file: SQLite DATABASE_URL.");
  }

  return {
    sourcePath: path.resolve(sourcePath),
    databaseUrl,
    dryRun,
  };
}

function unzipText(sourcePath: string, entry: string) {
  return execFileSync("unzip", ["-p", sourcePath, entry], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function decodeXml(value: string) {
  return value.replace(/&#x([0-9a-f]+);|&#([0-9]+);|&(amp|lt|gt|quot|apos);/gi, (match, hex, decimal, named) => {
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[named.toLowerCase()] ?? match;
  });
}

function parseAttributes(fragment: string) {
  const attributes: Record<string, string> = {};
  for (const match of fragment.matchAll(/([\w:-]+)=(?:"([^"]*)"|'([^']*)')/g)) {
    attributes[match[1]] = decodeXml(match[2] ?? match[3] ?? "");
  }
  return attributes;
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/)?.[0];
  if (!letters) throw new Error(`Invalid cell reference: ${reference}`);
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
}

function textNodes(xml: string) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
}

function readWorkbook(sourcePath: string) {
  const entries = new Set(execFileSync("unzip", ["-Z1", sourcePath], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean));
  for (const requiredEntry of ["xl/workbook.xml", "xl/_rels/workbook.xml.rels"]) {
    if (!entries.has(requiredEntry)) throw new Error(`Invalid XLSX: missing ${requiredEntry}`);
  }

  const workbookXml = unzipText(sourcePath, "xl/workbook.xml");
  const sheetTags = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/g)].map((match) => parseAttributes(match[1]));
  const targetSheet = sheetTags.find((sheet) => sheet.name === TARGET_SHEET);
  if (!targetSheet?.["r:id"]) throw new Error(`Sheet not found: ${TARGET_SHEET}`);

  const relationshipsXml = unzipText(sourcePath, "xl/_rels/workbook.xml.rels");
  const relationshipTags = [...relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].map((match) => parseAttributes(match[1]));
  const relationship = relationshipTags.find((item) => item.Id === targetSheet["r:id"]);
  if (!relationship?.Target) throw new Error(`Worksheet relationship not found: ${targetSheet["r:id"]}`);

  const worksheetEntry = relationship.Target.startsWith("/")
    ? relationship.Target.slice(1)
    : path.posix.normalize(path.posix.join("xl", relationship.Target));
  if (!worksheetEntry.startsWith("xl/worksheets/") || !entries.has(worksheetEntry)) {
    throw new Error(`Unsafe or missing worksheet entry: ${worksheetEntry}`);
  }

  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? [...unzipText(sourcePath, "xl/sharedStrings.xml").matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => textNodes(match[1]))
    : [];
  const worksheetXml = unzipText(sourcePath, worksheetEntry);
  const rows: Array<{ rowNumber: number; cells: string[] }> = [];

  for (const rowMatch of worksheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttributes = parseAttributes(rowMatch[1]);
    const rowNumber = Number.parseInt(rowAttributes.r, 10);
    if (!Number.isInteger(rowNumber)) throw new Error("Worksheet row is missing a numeric r attribute.");
    const cells: string[] = [];

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const cellAttributes = parseAttributes(cellMatch[1]);
      if (!cellAttributes.r) throw new Error(`Cell in row ${rowNumber} is missing a reference.`);
      const body = cellMatch[2] ?? "";
      const valueMatch = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/);
      let value = "";
      if (cellAttributes.t === "inlineStr") value = textNodes(body);
      else if (cellAttributes.t === "s") {
        const sharedIndex = Number.parseInt(decodeXml(valueMatch?.[1] ?? ""), 10);
        value = sharedStrings[sharedIndex] ?? "";
      } else value = decodeXml(valueMatch?.[1] ?? "");
      cells[columnIndex(cellAttributes.r)] = value;
    }
    rows.push({ rowNumber, cells });
  }

  const headerRow = rows.find((row) => row.cells.includes("company_id") && row.cells.includes("company_name"));
  if (!headerRow) throw new Error("Header row was not found.");
  const actualHeaders = headerRow.cells.slice(0, HEADERS.length);
  if (actualHeaders.length !== HEADERS.length || actualHeaders.some((header, index) => header !== HEADERS[index])) {
    throw new Error(`Header mismatch at row ${headerRow.rowNumber}: ${JSON.stringify(actualHeaders)}`);
  }

  const rawRows = rows
    .filter((row) => row.rowNumber > headerRow.rowNumber)
    .filter((row) => row.cells.some((cell) => cell?.trim()))
    .map((row) => {
      const result = { rowNumber: row.rowNumber } as RawRow;
      HEADERS.forEach((header, index) => {
        result[header] = row.cells[index] ?? null;
      });
      return result;
    });

  return { headerRow: headerRow.rowNumber, rows: rawRows };
}

function nullable(value: string | null) {
  if (value === null) return null;
  const trimmed = value.trim();
  return NULL_VALUES.has(trimmed.toLocaleLowerCase("ko-KR")) ? null : trimmed;
}

function normalizedIdentity(value: string | null) {
  return nullable(value)?.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ") ?? null;
}

function normalizedCountry(value: string | null) {
  return nullable(value)?.normalize("NFKC").replace(/\s+/g, " ") ?? null;
}

function parseInteger(value: string | null, field: string, warnings: string[]) {
  const normalized = nullable(value);
  if (normalized === null) return null;
  const number = Number(normalized.replace(/,/g, ""));
  if (!Number.isInteger(number)) {
    warnings.push(`${field}: invalid integer '${normalized}'`);
    return null;
  }
  return number;
}

function parseDate(value: string | null, field: string, warnings: string[]) {
  const normalized = nullable(value);
  if (normalized === null) return null;
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const serial = Number(normalized);
    if (serial > 0 && serial < 1_000_000) return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  }
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? Date.parse(`${normalized}T00:00:00.000Z`)
    : Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    warnings.push(`${field}: invalid date '${normalized}'`);
    return null;
  }
  return new Date(timestamp);
}

function normalizeWebsite(value: string | null, warnings: string[]) {
  const normalized = nullable(value);
  if (normalized === null) return { website: null, websiteDomain: null };
  try {
    if (/\s|[,;|]/.test(normalized)) throw new Error("multiple or whitespace-delimited URL");
    const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      throw new Error("unsupported URL");
    }
    const domain = url.hostname.toLocaleLowerCase("en-US").replace(/^www\./, "").replace(/\.$/, "");
    if (!domain) throw new Error("empty domain");
    url.hostname = domain;
    url.hash = "";
    const website = url.pathname === "/" && !url.search ? `${url.protocol}//${url.host}` : url.toString();
    return { website, websiteDomain: domain };
  } catch {
    warnings.push(`website: invalid URL '${normalized}'`);
    return { website: normalized, websiteDomain: null };
  }
}

function stripListPrefix(value: string) {
  return value.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, "").trim();
}

function arrayJson(value: string | null, splitComma = false) {
  const normalized = nullable(value);
  if (normalized === null) return null;
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      const items = parsed.map(stripListPrefix).filter(Boolean);
      return items.length ? JSON.stringify({ schemaVersion: 1, items }) : null;
    }
  } catch {
    // Non-JSON source values are normalized below.
  }
  const delimiter = splitComma ? /\r?\n|[;|,]|\s*•\s*/ : /\r?\n|[;|]|\s*•\s*/;
  const items = normalized.split(delimiter).map(stripListPrefix).filter(Boolean);
  return items.length ? JSON.stringify({ schemaVersion: 1, items }) : null;
}

function normalizeRow(raw: RawRow): NormalizedRow {
  const warnings: string[] = [];
  const errors: string[] = [];
  const companyId = nullable(raw.company_id);
  const name = nullable(raw.company_name);
  if (!companyId) errors.push("company_id is required");
  if (!name) errors.push("company_name is required");
  const website = normalizeWebsite(raw.website, warnings);

  return {
    rowNumber: raw.rowNumber,
    companyId,
    company: {
      externalId: null,
      name: name ?? "",
      nameEn: nullable(raw.company_name_en),
      country: normalizedCountry(raw.country),
      location: nullable(raw.location),
      founded: parseInteger(raw.founded, "founded", warnings),
      website: website.website,
      websiteDomain: website.websiteDomain,
      companySummary: nullable(raw.company_summary),
      businessType: nullable(raw.business_type),
      companySize: nullable(raw.company_size),
      mainProductsJson: arrayJson(raw.main_products),
      flagshipProduct: nullable(raw.flagship_product),
      productSummary: nullable(raw.product_summary),
      targetCustomerJson: arrayJson(raw.target_customer),
      customerExamplesJson: arrayJson(raw.customer_examples),
      businessModel: nullable(raw.business_model),
      coreTechnology: nullable(raw.core_technology),
      aiDigital: nullable(raw.ai_digital),
      competitiveAdvantage: nullable(raw.competitive_advantage),
      competitorsJson: arrayJson(raw.competitors),
      domesticMarket: nullable(raw.domestic_market),
      globalMarket: nullable(raw.global_market),
      growthSignals: nullable(raw.growth_signals),
      funding: nullable(raw.funding),
      revenue: nullable(raw.revenue),
      certificationsJson: arrayJson(raw.certifications),
      recentNews: nullable(raw.recent_news),
      recentNewsDate: parseDate(raw.recent_news_date, "recent_news_date", warnings),
      source: nullable(raw.source),
      lastChecked: parseDate(raw.last_checked, "last_checked", warnings),
    },
    participation: {
      externalCompanyId: companyId,
      booth: nullable(raw.booth),
      industry: nullable(raw.industry),
      category: nullable(raw.category),
      exhibitionFocus: nullable(raw.exhibition_focus),
      whyInteresting: nullable(raw.why_interesting),
      benchmarkPoint: nullable(raw.benchmark_point),
      collaborationOpportunity: nullable(raw.collaboration_opportunity),
      fieldObservation: nullable(raw.field_observation),
      questionsJson: arrayJson(raw.questions),
      riskOrUnknown: nullable(raw.risk_or_unknown),
      rawTagsJson: arrayJson(raw.tags, true),
      source: nullable(raw.source),
      lastChecked: parseDate(raw.last_checked, "last_checked", warnings),
    },
    warnings,
    errors,
  };
}

function comparable(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

function hasChanges(existing: Record<string, unknown>, desired: Record<string, unknown>, fields: readonly string[]) {
  return fields.some((field) => comparable(existing[field]) !== comparable(desired[field]));
}

function addToMap<T>(map: Map<string, T[]>, key: string | null, item: T) {
  if (!key) return;
  const items = map.get(key) ?? [];
  items.push(item);
  map.set(key, items);
}

function nameCountryKey(name: string | null, country: string | null) {
  const normalizedName = normalizedIdentity(name);
  const normalizedCountryValue = normalizedIdentity(country);
  return normalizedName && normalizedCountryValue ? `${normalizedName}\u0000${normalizedCountryValue}` : null;
}

function distribution(rows: NormalizedRow[], selector: (row: NormalizedRow) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = selector(row) ?? "(null)";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ko")));
}

async function buildPlan(prisma: PrismaClient, rows: NormalizedRow[]) {
  const exhibitions = await prisma.exhibition.findMany({ where: { nameEn: EXHIBITION.nameEn } });
  if (exhibitions.length > 1) throw new Error(`Multiple ${EXHIBITION.nameEn} Exhibition records exist.`);
  const exhibition = exhibitions[0] ?? null;
  const existingLinks = exhibition
    ? await prisma.exhibitionCompany.findMany({ where: { exhibitionId: exhibition.id }, include: { company: true } })
    : [];
  const companies = await prisma.company.findMany();

  const linksByExternalId = new Map<string, ExistingLink[]>();
  const linksByCompanyId = new Map<string, ExistingLink[]>();
  for (const link of existingLinks) {
    addToMap(linksByExternalId, link.externalCompanyId, link);
    addToMap(linksByCompanyId, link.companyId, link);
  }
  const companiesByDomain = new Map<string, typeof companies>();
  const companiesByNameCountry = new Map<string, typeof companies>();
  const companiesByNameEnCountry = new Map<string, typeof companies>();
  for (const company of companies) {
    addToMap(companiesByDomain, company.websiteDomain, company);
    addToMap(companiesByNameCountry, nameCountryKey(company.name, company.country), company);
    addToMap(companiesByNameEnCountry, nameCountryKey(company.nameEn, company.country), company);
  }

  const rowsById = new Map<string, NormalizedRow[]>();
  const rowsByDomain = new Map<string, NormalizedRow[]>();
  const rowsByNameCountry = new Map<string, NormalizedRow[]>();
  const rowsByNameEnCountry = new Map<string, NormalizedRow[]>();
  for (const row of rows) {
    addToMap(rowsById, row.companyId, row);
    addToMap(rowsByDomain, row.company.websiteDomain as string | null, row);
    addToMap(rowsByNameCountry, nameCountryKey(row.company.name, row.company.country as string | null), row);
    addToMap(rowsByNameEnCountry, nameCountryKey(row.company.nameEn as string | null, row.company.country as string | null), row);
  }

  for (const [companyId, matches] of rowsById) {
    if (matches.length > 1) matches.forEach((row) => row.errors.push(`duplicate company_id '${companyId}'`));
  }
  for (const [domain, matches] of rowsByDomain) {
    if (matches.length > 1) {
      matches.forEach((row) => row.warnings.push(
        `websiteDomain: shared by ${matches.length} source participants ('${domain}'); kept separate within the same exhibition`,
      ));
    }
  }

  const sourceIds = new Set(rows.map((row) => row.companyId).filter((value): value is string => Boolean(value)));
  const unexpectedExistingLinks = existingLinks.filter((link) => !link.externalCompanyId || !sourceIds.has(link.externalCompanyId));
  if (unexpectedExistingLinks.length) {
    throw new Error(`${unexpectedExistingLinks.length} existing ENTECH participation records are absent from the source file.`);
  }

  const plans: ImportPlan[] = rows.map((row) => {
    if (row.errors.length) {
      return { row, action: "INVALID", matchReason: null, existingCompanyId: null, existingLinkId: null, conflictReason: row.errors.join("; ") };
    }

    const sourceNameMatches = rowsByNameCountry.get(nameCountryKey(row.company.name, row.company.country as string | null) ?? "") ?? [];
    const sourceNameEnMatches = rowsByNameEnCountry.get(nameCountryKey(row.company.nameEn as string | null, row.company.country as string | null) ?? "") ?? [];
    if (sourceNameMatches.length > 1 || sourceNameEnMatches.length > 1) {
      return { row, action: "CONFLICT", matchReason: null, existingCompanyId: null, existingLinkId: null, conflictReason: "name + country duplicate candidate in source" };
    }

    const externalMatches = linksByExternalId.get(row.companyId!) ?? [];
    if (externalMatches.length > 1) {
      return { row, action: "CONFLICT", matchReason: null, existingCompanyId: null, existingLinkId: null, conflictReason: "multiple existing participation records share externalCompanyId" };
    }
    if (externalMatches.length === 1) {
      const link = externalMatches[0];
      const changed = hasChanges(link.company as unknown as Record<string, unknown>, row.company as Record<string, unknown>, COMPANY_FIELDS)
        || hasChanges(link as unknown as Record<string, unknown>, row.participation as Record<string, unknown>, PARTICIPATION_FIELDS);
      return {
        row,
        action: changed ? "UPDATE" : "SKIP",
        matchReason: "EXTERNAL_ID",
        existingCompanyId: link.companyId,
        existingLinkId: link.id,
        conflictReason: null,
      };
    }

    const domainMatches = row.company.websiteDomain ? companiesByDomain.get(row.company.websiteDomain as string) ?? [] : [];
    if (domainMatches.length > 1) {
      return { row, action: "CONFLICT", matchReason: null, existingCompanyId: null, existingLinkId: null, conflictReason: "multiple companies share canonical website domain" };
    }
    if (domainMatches.length === 1) {
      const company = domainMatches[0];
      if ((linksByCompanyId.get(company.id) ?? []).length) {
        return { row, action: "CONFLICT", matchReason: "WEBSITE_DOMAIN", existingCompanyId: company.id, existingLinkId: null, conflictReason: "matched company already participates in this exhibition under another external ID" };
      }
      return { row, action: "CREATE_LINK", matchReason: "WEBSITE_DOMAIN", existingCompanyId: company.id, existingLinkId: null, conflictReason: null };
    }

    const existingNameMatches = companiesByNameCountry.get(nameCountryKey(row.company.name, row.company.country as string | null) ?? "") ?? [];
    const existingNameEnMatches = companiesByNameEnCountry.get(nameCountryKey(row.company.nameEn as string | null, row.company.country as string | null) ?? "") ?? [];
    if (existingNameMatches.length || existingNameEnMatches.length) {
      return { row, action: "CONFLICT", matchReason: null, existingCompanyId: null, existingLinkId: null, conflictReason: "name + country match requires manual review" };
    }

    return { row, action: "NEW", matchReason: null, existingCompanyId: null, existingLinkId: null, conflictReason: null };
  });

  return { exhibition, plans };
}

async function applyPlan(
  prisma: PrismaClient,
  plans: ImportPlan[],
  existingExhibition: Prisma.ExhibitionGetPayload<Record<string, never>> | null,
) {
  return prisma.$transaction(async (transaction) => {
    const exhibitionNeedsUpdate = existingExhibition && hasChanges(
      existingExhibition as unknown as Record<string, unknown>,
      EXHIBITION,
      ["name", "nameEn", "venue", "status"],
    );
    const exhibition = existingExhibition
      ? exhibitionNeedsUpdate
        ? await transaction.exhibition.update({ where: { id: existingExhibition.id }, data: EXHIBITION })
        : existingExhibition
      : await transaction.exhibition.create({ data: EXHIBITION });

    for (const plan of plans) {
      if (plan.action === "SKIP") continue;
      if (plan.action === "NEW") {
        const company = await transaction.company.create({ data: plan.row.company });
        await transaction.exhibitionCompany.create({
          data: { ...plan.row.participation, exhibitionId: exhibition.id, companyId: company.id },
        });
        continue;
      }
      if (plan.action === "CREATE_LINK") {
        await transaction.company.update({ where: { id: plan.existingCompanyId! }, data: plan.row.company });
        await transaction.exhibitionCompany.create({
          data: { ...plan.row.participation, exhibitionId: exhibition.id, companyId: plan.existingCompanyId! },
        });
        continue;
      }
      if (plan.action === "UPDATE") {
        await transaction.company.update({ where: { id: plan.existingCompanyId! }, data: plan.row.company });
        await transaction.exhibitionCompany.update({ where: { id: plan.existingLinkId! }, data: plan.row.participation });
        continue;
      }
      throw new Error(`Blocked plan action reached transaction: ${plan.action}`);
    }

    const participationCount = await transaction.exhibitionCompany.count({ where: { exhibitionId: exhibition.id } });
    if (participationCount !== TARGET_ROW_COUNT) {
      throw new Error(`Transaction verification failed: expected ${TARGET_ROW_COUNT} participation rows, found ${participationCount}.`);
    }
    return exhibition;
  }, { timeout: 30_000 });
}

const options = parseArguments();
const sourceBytes = readFileSync(options.sourcePath);
const fileSha256 = createHash("sha256").update(sourceBytes).digest("hex");
const workbook = readWorkbook(options.sourcePath);
const normalizedRows = workbook.rows.map(normalizeRow);

if (normalizedRows.length !== TARGET_ROW_COUNT) {
  throw new Error(`Import blocked: expected ${TARGET_ROW_COUNT} rows, found ${normalizedRows.length}.`);
}

process.env.DATABASE_URL = options.databaseUrl;
const prisma = new PrismaClient();

try {
  const { exhibition, plans } = await buildPlan(prisma, normalizedRows);
  const counts = {
    total: normalizedRows.length,
    valid: normalizedRows.filter((row) => row.errors.length === 0).length,
    warningRows: normalizedRows.filter((row) => row.warnings.length > 0).length,
    warningCount: normalizedRows.reduce((total, row) => total + row.warnings.length, 0),
    invalid: plans.filter((plan) => plan.action === "INVALID").length,
    newCompany: plans.filter((plan) => plan.action === "NEW").length,
    matched: plans.filter((plan) => plan.matchReason !== null).length,
    conflict: plans.filter((plan) => plan.action === "CONFLICT").length,
    newExhibitionCompany: plans.filter((plan) => plan.action === "NEW" || plan.action === "CREATE_LINK").length,
    updateExistingExhibitionCompany: plans.filter((plan) => plan.action === "UPDATE").length,
    skip: plans.filter((plan) => plan.action === "SKIP").length,
  };

  const blocked = counts.invalid > 0 || counts.conflict > 0;
  if (!options.dryRun && blocked) {
    throw new Error(`Import blocked: invalid=${counts.invalid}, conflict=${counts.conflict}. Run --dry-run and resolve all blockers.`);
  }

  const appliedExhibition = options.dryRun
    ? exhibition
    : await applyPlan(prisma, plans, exhibition);

  const postImport = options.dryRun ? null : {
    exhibition: await prisma.exhibition.count(),
    company: await prisma.company.count(),
    exhibitionCompany: await prisma.exhibitionCompany.count(),
    targetExhibitionCompany: await prisma.exhibitionCompany.count({ where: { exhibitionId: appliedExhibition!.id } }),
  };

  const ignoredScores = Object.fromEntries(SCORE_HEADERS.map((header) => [
    header,
    workbook.rows.filter((row) => nullable(row[header]) !== null).length,
  ]));
  const warnings = normalizedRows.flatMap((row) => row.warnings.map((warning) => ({ row: row.rowNumber, companyId: row.companyId, warning })));
  const conflicts = plans
    .filter((plan) => plan.action === "CONFLICT" || plan.action === "INVALID")
    .map((plan) => ({ row: plan.row.rowNumber, companyId: plan.row.companyId, companyName: plan.row.company.name, reason: plan.conflictReason }));

  console.log(JSON.stringify({
    mode: options.dryRun ? "DRY_RUN" : "APPLY",
    source: options.sourcePath,
    sourceSha256: fileSha256,
    sheet: TARGET_SHEET,
    headerRow: workbook.headerRow,
    counts,
    exhibition: {
      action: exhibition ? "MATCH" : "CREATE",
      id: appliedExhibition?.id ?? null,
      ...EXHIBITION,
      startDate: null,
      endDate: null,
    },
    normalization: {
      nullValues: [...NULL_VALUES],
      jsonShape: { schemaVersion: 1, items: ["..."] },
      companyExternalIdCopied: false,
      ignoredScores,
    },
    distributions: {
      industry: distribution(normalizedRows, (row) => row.participation.industry as string | null),
      category: distribution(normalizedRows, (row) => row.participation.category as string | null),
      country: distribution(normalizedRows, (row) => row.company.country as string | null),
    },
    warnings,
    conflicts,
    postImport,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
