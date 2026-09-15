import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const EXHIBITION_NAME_EN = "ENTECH 2026";

type Candidate = Prisma.ExhibitionCompanyGetPayload<{ include: { company: true } }>;
type Evidence = { field: string; value: string; keyword: string };
type IndexDefinition = {
  name: string;
  description: string;
  indexType: "SYSTEM" | "PERSONAL";
  icon: string;
  color: string;
  isSystem: true;
  sortOrder: number;
  rule: null | {
    fields: string[];
    keywords?: string[];
    exact?: { field: string; value: string };
  };
  match: (candidate: Candidate) => Evidence | null;
};

function parseArguments() {
  const args = process.argv.slice(2);
  let databaseUrl = process.env.DATABASE_URL ?? `file:${path.resolve(process.cwd(), "prisma/dev.db")}`;
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--dry-run") dryRun = true;
    else if (args[index] === "--database-url") databaseUrl = args[++index] ?? "";
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  if (!databaseUrl.startsWith("file:")) throw new Error("The curation seed only supports a file: SQLite DATABASE_URL.");
  return { databaseUrl, dryRun };
}

function normalized(value: string | null | undefined) {
  return value?.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim() ?? "";
}

function keywordMatch(value: string, keyword: string) {
  const text = normalized(value);
  const target = normalized(keyword);
  if (/^[a-z]+$/.test(target)) {
    return new RegExp(`(^|[^a-z])${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(text);
  }
  return text.includes(target);
}

function jsonItems(value: string | null) {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value) as { items?: unknown };
    return Array.isArray(parsed.items) ? parsed.items.filter((item): item is string => typeof item === "string").join(" · ") : value;
  } catch {
    return value;
  }
}

function candidateFields(candidate: Candidate) {
  return {
    industry: candidate.industry ?? "",
    category: candidate.category ?? "",
    aiDigital: candidate.company.aiDigital ?? "",
    coreTechnology: candidate.company.coreTechnology ?? "",
    whyInteresting: candidate.whyInteresting ?? "",
    benchmarkPoint: candidate.benchmarkPoint ?? "",
    collaborationOpportunity: candidate.collaborationOpportunity ?? "",
    fieldObservation: candidate.fieldObservation ?? "",
    riskOrUnknown: candidate.riskOrUnknown ?? "",
    rawTags: jsonItems(candidate.rawTagsJson),
  };
}

function matchKeywords(candidate: Candidate, fields: Array<keyof ReturnType<typeof candidateFields>>, keywords: string[]) {
  const values = candidateFields(candidate);
  for (const field of fields) {
    for (const keyword of keywords) {
      if (keywordMatch(values[field], keyword)) return { field, value: values[field], keyword };
    }
  }
  return null;
}

const AI_KEYWORDS = [
  "AI", "인공지능", "디지털 트윈", "디지털트윈", "자동화", "머신러닝", "딥러닝", "예지보전",
  "비전", "데이터", "스마트 관제", "지능형 센서",
];
const DEEP_TECH_KEYWORDS = [
  "양자점", "분광", "나노", "디지털 트윈", "디지털트윈", "합성 데이터", "자율주행", "로봇",
  "CCUS", "탄소포집", "액화수소", "극저온", "초순수", "광학", "수중 통신", "OTAC", "초음파",
];
const BUSINESS_IDEA_KEYWORDS = ["플랫폼", "SaaS", "서비스", "렌탈", "구독", "마켓플레이스", "B2B"];
const COLLABORATION_KEYWORDS = ["협업", "연계", "파트너", "공동", "PoC", "실증", "제휴"];
const FIELD_CHECK_KEYWORDS = ["확인", "검증", "미확인", "불명확", "현장"];

const INDEX_DEFINITIONS: IndexDefinition[] = [
  {
    name: "공공정책",
    description: "정부·공공기관과 지원정책을 빠르게 확인합니다.",
    indexType: "SYSTEM",
    icon: "🏛",
    color: "#BDEFD8",
    isSystem: true,
    sortOrder: 10,
    rule: { fields: ["industry"], exact: { field: "industry", value: "공공정책" } },
    match: (candidate) => candidate.industry === "공공정책"
      ? { field: "industry", value: candidate.industry, keyword: "공공정책" }
      : null,
  },
  {
    name: "AI 활용 기술",
    description: "AI·데이터·자동화·디지털 트윈 기반 기술을 모아 봅니다.",
    indexType: "SYSTEM",
    icon: "🤖",
    color: "#DCEBFF",
    isSystem: true,
    sortOrder: 20,
    rule: { fields: ["industry", "category", "aiDigital", "coreTechnology", "rawTags"], keywords: AI_KEYWORDS },
    match: (candidate) => matchKeywords(candidate, ["industry", "category", "aiDigital", "coreTechnology", "rawTags"], AI_KEYWORDS),
  },
  {
    name: "신기술·딥테크",
    description: "원천기술과 기술적 차별성이 명시된 기업을 확인합니다.",
    indexType: "SYSTEM",
    icon: "🔬",
    color: "#E4D9FF",
    isSystem: true,
    sortOrder: 30,
    rule: { fields: ["category", "coreTechnology", "whyInteresting", "benchmarkPoint", "rawTags"], keywords: DEEP_TECH_KEYWORDS },
    match: (candidate) => matchKeywords(candidate, ["category", "coreTechnology", "whyInteresting", "benchmarkPoint", "rawTags"], DEEP_TECH_KEYWORDS),
  },
  {
    name: "사업 아이디어",
    description: "서비스·플랫폼·수익모델 관점에서 참고할 사례를 모읍니다.",
    indexType: "SYSTEM",
    icon: "💡",
    color: "#FFF1B8",
    isSystem: true,
    sortOrder: 40,
    rule: { fields: ["category", "whyInteresting", "benchmarkPoint", "collaborationOpportunity"], keywords: BUSINESS_IDEA_KEYWORDS },
    match: (candidate) => matchKeywords(candidate, ["category", "whyInteresting", "benchmarkPoint", "collaborationOpportunity"], BUSINESS_IDEA_KEYWORDS),
  },
  {
    name: "협업 후보",
    description: "기존 조사에서 협업·실증·연계 가능성이 명시된 기업입니다.",
    indexType: "SYSTEM",
    icon: "🤝",
    color: "#FFDCCF",
    isSystem: true,
    sortOrder: 50,
    rule: { fields: ["collaborationOpportunity"], keywords: COLLABORATION_KEYWORDS },
    match: (candidate) => matchKeywords(candidate, ["collaborationOpportunity"], COLLABORATION_KEYWORDS),
  },
  {
    name: "현장에서 꼭 확인",
    description: "리스크와 미확인 사항에 현장 확인·검증이 명시된 기업입니다.",
    indexType: "SYSTEM",
    icon: "📌",
    color: "#FFD1D1",
    isSystem: true,
    sortOrder: 60,
    rule: { fields: ["riskOrUnknown"], keywords: FIELD_CHECK_KEYWORDS },
    match: (candidate) => matchKeywords(candidate, ["riskOrUnknown"], FIELD_CHECK_KEYWORDS),
  },
  {
    name: "나의 관심기업",
    description: "직접 저장한 관심기업을 모아 보는 개인 Index입니다.",
    indexType: "PERSONAL",
    icon: "⭐",
    color: "#FFE2A8",
    isSystem: true,
    sortOrder: 70,
    rule: null,
    match: () => null,
  },
  {
    name: "오늘 방문",
    description: "오늘 확인할 기업을 직접 담는 Index입니다. 방문 상태 기능은 후속 Phase에서 연결합니다.",
    indexType: "PERSONAL",
    icon: "🧭",
    color: "#CFEBDD",
    isSystem: true,
    sortOrder: 80,
    rule: null,
    match: () => null,
  },
];

function evidenceReason(evidence: Evidence) {
  const excerpt = evidence.value.replace(/\s+/g, " ").trim();
  const shortened = excerpt.length > 180 ? `${excerpt.slice(0, 177)}...` : excerpt;
  return `${evidence.field}에서 '${evidence.keyword}' 확인: ${shortened}`;
}

function tagName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function collectTags(candidates: Candidate[]) {
  const desired = new Map<string, { name: string; kind: string; companyIds: Set<string> }>();
  const add = (nameValue: string | null, kind: string, companyId: string) => {
    if (!nameValue) return;
    const name = tagName(nameValue);
    if (!name) return;
    const key = `${kind}\u0000${name}`;
    const item = desired.get(key) ?? { name, kind, companyIds: new Set<string>() };
    item.companyIds.add(companyId);
    desired.set(key, item);
  };
  for (const candidate of candidates) {
    add(candidate.industry, "INDUSTRY", candidate.companyId);
    add(candidate.category, "CATEGORY", candidate.companyId);
    for (const item of jsonItems(candidate.rawTagsJson).split(" · ").filter(Boolean)) add(item, "GENERAL", candidate.companyId);
  }
  return [...desired.values()];
}

const options = parseArguments();
process.env.DATABASE_URL = options.databaseUrl;
const prisma = new PrismaClient();

try {
  const exhibitions = await prisma.exhibition.findMany({ where: { nameEn: EXHIBITION_NAME_EN } });
  if (exhibitions.length !== 1) throw new Error(`Expected exactly one ${EXHIBITION_NAME_EN} Exhibition, found ${exhibitions.length}.`);
  const exhibition = exhibitions[0];
  const candidates = await prisma.exhibitionCompany.findMany({
    where: { exhibitionId: exhibition.id },
    include: { company: true },
    orderBy: { externalCompanyId: "asc" },
  });
  if (candidates.length !== 180) throw new Error(`Expected 180 ENTECH participants, found ${candidates.length}.`);

  const existingIndexes = await prisma.curationIndex.findMany({
    where: { exhibitionId: exhibition.id },
    include: { companies: true },
  });
  const existingByName = new Map(existingIndexes.map((index) => [index.name, index]));
  const indexReports = INDEX_DEFINITIONS.map((definition) => {
    const existing = existingByName.get(definition.name);
    const matches = definition.rule
      ? candidates.flatMap((candidate) => {
        const evidence = definition.match(candidate);
        return evidence ? [{ candidate, reason: evidenceReason(evidence) }] : [];
      })
      : [];
    const existingMemberships = new Map(existing?.companies.map((item) => [item.companyId, item]) ?? []);
    const ambiguous = existing && !existing.isSystem ? 1 : 0;
    const metadataChanged = Boolean(existing?.isSystem && (
      existing.description !== definition.description
      || existing.indexType !== definition.indexType
      || existing.icon !== definition.icon
      || existing.color !== definition.color
      || existing.sortOrder !== definition.sortOrder
      || existing.ruleJson !== (definition.rule ? JSON.stringify({ schemaVersion: 1, ...definition.rule }) : null)
    ));
    return {
      definition,
      existing,
      matches,
      matchedCompanies: matches.length,
      newMembership: matches.filter((match) => !existingMemberships.has(match.candidate.companyId)).length,
      existingMembership: matches.filter((match) => existingMemberships.has(match.candidate.companyId)).length,
      updatedMembership: matches.filter((match) => {
        const membership = existingMemberships.get(match.candidate.companyId);
        return membership?.source === "SYSTEM" && membership.reason !== match.reason;
      }).length,
      removed: 0,
      ambiguous,
      indexAction: !existing ? "CREATE" : ambiguous ? "PRESERVE_PERSONAL_CONFLICT" : metadataChanged ? "UPDATE" : "SKIP",
    };
  });

  const desiredTags = collectTags(candidates);
  const existingTags = await prisma.tag.findMany({ include: { companies: true } });
  const existingTagByKey = new Map(existingTags.map((tag) => [`${tag.kind}\u0000${tag.name}`, tag]));
  const tagReport = {
    desiredTags: desiredTags.length,
    newTags: desiredTags.filter((tag) => !existingTagByKey.has(`${tag.kind}\u0000${tag.name}`)).length,
    existingTags: desiredTags.filter((tag) => existingTagByKey.has(`${tag.kind}\u0000${tag.name}`)).length,
    desiredMemberships: desiredTags.reduce((count, tag) => count + tag.companyIds.size, 0),
    newMemberships: desiredTags.reduce((count, tag) => {
      const existing = existingTagByKey.get(`${tag.kind}\u0000${tag.name}`);
      const companyIds = new Set(existing?.companies.map((membership) => membership.companyId) ?? []);
      return count + [...tag.companyIds].filter((companyId) => !companyIds.has(companyId)).length;
    }, 0),
  };

  if (!options.dryRun) {
    const conflicts = indexReports.filter((report) => report.ambiguous > 0 && report.definition.indexType === "SYSTEM");
    if (conflicts.length) throw new Error(`System index name conflicts with personal indexes: ${conflicts.map((item) => item.definition.name).join(", ")}`);

    await prisma.$transaction(async (transaction) => {
      for (const tag of desiredTags) {
        let storedTag = existingTagByKey.get(`${tag.kind}\u0000${tag.name}`);
        if (!storedTag) storedTag = await transaction.tag.create({ data: { name: tag.name, kind: tag.kind }, include: { companies: true } });
        const existingCompanyIds = new Set(storedTag.companies.map((membership) => membership.companyId));
        for (const companyId of tag.companyIds) {
          if (!existingCompanyIds.has(companyId)) {
            await transaction.companyTag.create({ data: { companyId, tagId: storedTag.id, source: "IMPORT", confidence: 1 } });
          }
        }
      }

      for (const report of indexReports) {
        if (report.ambiguous) continue;
        const ruleJson = report.definition.rule ? JSON.stringify({ schemaVersion: 1, ...report.definition.rule }) : null;
        const data = {
          name: report.definition.name,
          description: report.definition.description,
          indexType: report.definition.indexType,
          icon: report.definition.icon,
          color: report.definition.color,
          isSystem: report.definition.isSystem,
          isDynamic: false,
          ruleJson,
          sortOrder: report.definition.sortOrder,
        };
        const storedIndex = report.existing
          ? report.indexAction === "UPDATE"
            ? await transaction.curationIndex.update({ where: { id: report.existing.id }, data })
            : report.existing
          : await transaction.curationIndex.create({ data: { ...data, exhibitionId: exhibition.id } });
        const existingMemberships = new Map(report.existing?.companies.map((item) => [item.companyId, item]) ?? []);
        for (const match of report.matches) {
          const membership = existingMemberships.get(match.candidate.companyId);
          if (!membership) {
            await transaction.companyIndex.create({
              data: { companyId: match.candidate.companyId, indexId: storedIndex.id, reason: match.reason, source: "SYSTEM" },
            });
          } else if (membership.source === "SYSTEM" && membership.reason !== match.reason) {
            await transaction.companyIndex.update({ where: { id: membership.id }, data: { reason: match.reason } });
          }
        }
      }
    }, { timeout: 30_000 });
  }

  const postSeed = options.dryRun ? null : {
    indexes: await prisma.curationIndex.count({ where: { exhibitionId: exhibition.id } }),
    memberships: await prisma.companyIndex.count({ where: { index: { exhibitionId: exhibition.id } } }),
    tags: await prisma.tag.count(),
    companyTags: await prisma.companyTag.count(),
  };

  console.log(JSON.stringify({
    mode: options.dryRun ? "DRY_RUN" : "APPLY",
    exhibition: { id: exhibition.id, name: exhibition.name, nameEn: exhibition.nameEn },
    participants: candidates.length,
    indexes: indexReports.map((report) => ({
      name: report.definition.name,
      type: report.definition.indexType,
      indexAction: report.indexAction,
      matchedCompanies: report.matchedCompanies,
      newMembership: report.newMembership,
      existingMembership: report.existingMembership,
      updatedMembership: report.updatedMembership,
      removed: report.removed,
      ambiguous: report.ambiguous,
      rule: report.definition.rule,
    })),
    tags: tagReport,
    postSeed,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
