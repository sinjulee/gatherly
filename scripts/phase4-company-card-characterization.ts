import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

const databaseUrl = process.env.PHASE4_DATABASE_URL;
if (!databaseUrl?.startsWith("file:")) throw new Error("PHASE4_DATABASE_URL must be an absolute temporary SQLite file URL.");
const databasePath = path.resolve(databaseUrl.slice("file:".length));
const liveDatabasePath = path.resolve(process.cwd(), "prisma/dev.db");
const temporaryRoots = [path.resolve(os.tmpdir()), path.resolve("/private/tmp"), path.resolve("/tmp")];
assert.notEqual(databasePath, liveDatabasePath, "Refusing to run against prisma/dev.db.");
assert(temporaryRoots.some((root) => databasePath.startsWith(`${root}${path.sep}`)), "Characterization DB must be temporary.");
process.env.DATABASE_URL = databaseUrl;

const { prisma } = await import("../lib/prisma");
const { companyCardPath, getCompanyCardContext, parseResearchItems } = await import("../lib/company-card-context");
const { swipeDirection } = await import("../lib/company-card-navigation");
const membershipAPI = await import("../app/api/indexes/[id]/companies/[companyId]/route");
const indexCompaniesAPI = await import("../app/api/indexes/[id]/companies/route");
const detailAPI = await import("../app/api/exhibitions/[id]/companies/[companyId]/route");

function request(pathname: string, method: string, body?: unknown) {
  return new Request(`http://phase4.local${pathname}`, {
    method, headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

try {
  const exhibition = await prisma.exhibition.findFirstOrThrow({ where: { nameEn: "ENTECH 2026" } });
  const index = await prisma.curationIndex.findFirstOrThrow({ where: { exhibitionId: exhibition.id, name: "AI 활용 기술" } });
  const favoriteIndex = await prisma.curationIndex.findFirstOrThrow({ where: { exhibitionId: exhibition.id, name: "나의 관심기업" } });
  const todayIndex = await prisma.curationIndex.findFirstOrThrow({ where: { exhibitionId: exhibition.id, name: "오늘 방문" } });
  const systemMembershipBefore = await prisma.companyIndex.count({ where: { indexId: index.id } });
  const companyCountBefore = await prisma.company.count();
  const participationCountBefore = await prisma.exhibitionCompany.count();

  const list = await indexCompaniesAPI.GET(request(`/api/indexes/${index.id}/companies`, "GET"), { params: Promise.resolve({ id: index.id }) });
  assert.equal(list.status, 200);
  const listPayload = await list.json() as { companies: Array<{ companyId: string }>; pagination: { total: number } };
  assert.equal(listPayload.pagination.total, 63);
  const ordered = listPayload.companies.map((item) => item.companyId);
  const first = await getCompanyCardContext(exhibition.id, index.id, ordered[0]);
  const middle = await getCompanyCardContext(exhibition.id, index.id, ordered[2]);
  const last = await getCompanyCardContext(exhibition.id, index.id, ordered.at(-1)!);
  assert(first && middle && last);
  assert.equal(first.position, 1);
  assert.equal(first.previousCompanyId, null);
  assert.equal(first.nextCompanyId, ordered[1]);
  assert.equal(middle.position, 3);
  assert.equal(middle.previousCompanyId, ordered[1]);
  assert.equal(middle.nextCompanyId, ordered[3]);
  assert.equal(last.position, 63);
  assert.equal(last.nextCompanyId, null);
  assert.equal(last.previousCompanyId, ordered.at(-2));
  assert.equal(companyCardPath(exhibition.id, index.id, first.company.id), `/exhibitions/${exhibition.id}/indexes/${index.id}/companies/${first.company.id}`);
  assert.equal(swipeDirection({ x: 140, y: 100 }, { x: 65, y: 115 }), "NEXT");
  assert.equal(swipeDirection({ x: 65, y: 100 }, { x: 140, y: 115 }), "PREVIOUS");
  assert.equal(swipeDirection({ x: 140, y: 100 }, { x: 105, y: 101 }), null);
  assert.equal(swipeDirection({ x: 140, y: 100 }, { x: 65, y: 215 }), null);

  const beforeCompany = await prisma.company.findUniqueOrThrow({ where: { id: first.company.id } });
  const sourceQuestions = await prisma.exhibitionCompany.findUniqueOrThrow({ where: { exhibitionId_companyId: { exhibitionId: exhibition.id, companyId: first.company.id } } });
  assert.deepEqual(parseResearchItems('{"schemaVersion":1,"items":["첫 질문", "두 번째 질문"]}'), ["첫 질문", "두 번째 질문"]);
  assert.deepEqual(parseResearchItems("단일 질문"), ["단일 질문"]);
  const detail = await detailAPI.GET(request(`/api/exhibitions/${exhibition.id}/companies/${first.company.id}`, "GET"), { params: Promise.resolve({ id: exhibition.id, companyId: first.company.id }) });
  assert.equal(detail.status, 200);
  const detailPayload = await detail.json() as { company: { id: string }; exhibitionCompany: { booth: string | null; questions: string[] } };
  assert.equal(detailPayload.company.id, first.company.id);
  assert.equal(detailPayload.exhibitionCompany.booth, first.participation.booth);
  assert.deepEqual(detailPayload.exhibitionCompany.questions, parseResearchItems(sourceQuestions.questionsJson));

  assert.equal(await getCompanyCardContext(exhibition.id, "bad-index", first.company.id), null);
  assert.equal(await getCompanyCardContext(exhibition.id, index.id, "bad-company"), null);
  assert.equal(await getCompanyCardContext("different-exhibition", index.id, first.company.id), null);
  const outside = await prisma.exhibitionCompany.findFirstOrThrow({ where: { exhibitionId: exhibition.id, companyId: { notIn: ordered } }, select: { companyId: true } });
  assert.equal(await getCompanyCardContext(exhibition.id, index.id, outside.companyId), null);
  const denied = await detailAPI.GET(request(`/api/exhibitions/different-exhibition/companies/${first.company.id}`, "GET"), { params: Promise.resolve({ id: "different-exhibition", companyId: first.company.id }) });
  assert.equal(denied.status, 404);

  for (const personal of [favoriteIndex, todayIndex]) {
    assert.equal(await prisma.companyIndex.count({ where: { companyId: first.company.id, indexId: personal.id } }), 0);
    const pathname: string = `/api/indexes/${personal.id}/companies/${first.company.id}`;
    const params: { params: Promise<{ id: string; companyId: string }> } = { params: Promise.resolve({ id: personal.id, companyId: first.company.id }) };
    const added = await membershipAPI.POST(request(pathname, "POST", { reason: "Phase 4 characterization" }), params);
    assert.equal(added.status, 201);
    assert.equal((await membershipAPI.POST(request(pathname, "POST", { reason: "Phase 4 characterization" }), params)).status, 200);
    assert.equal(await prisma.companyIndex.count({ where: { companyId: first.company.id, indexId: personal.id } }), 1);
    const refreshed = await getCompanyCardContext(exhibition.id, index.id, first.company.id);
    assert(refreshed?.indexes.some((item) => item.id === personal.id));
    assert(await getCompanyCardContext(exhibition.id, personal.id, first.company.id));
  }
  assert.equal((await membershipAPI.POST(request(`/api/indexes/${index.id}/companies/${first.company.id}`, "POST", {}), { params: Promise.resolve({ id: index.id, companyId: first.company.id }) })).status, 403);
  assert.equal((await membershipAPI.DELETE(request(`/api/indexes/${index.id}/companies/${first.company.id}`, "DELETE"), { params: Promise.resolve({ id: index.id, companyId: first.company.id }) })).status, 403);
  for (const personal of [favoriteIndex, todayIndex]) {
    assert.equal((await membershipAPI.DELETE(request(`/api/indexes/${personal.id}/companies/${first.company.id}`, "DELETE"), { params: Promise.resolve({ id: personal.id, companyId: first.company.id }) })).status, 200);
    assert.equal(await getCompanyCardContext(exhibition.id, personal.id, first.company.id), null);
  }
  assert.equal(await prisma.companyIndex.count({ where: { companyId: first.company.id, indexId: { in: [favoriteIndex.id, todayIndex.id] } } }), 0);
  assert.equal(await prisma.companyIndex.count({ where: { indexId: index.id } }), systemMembershipBefore);
  assert.equal(await prisma.company.count(), companyCountBefore);
  assert.equal(await prisma.exhibitionCompany.count(), participationCountBefore);
  assert.deepEqual(await prisma.company.findUniqueOrThrow({ where: { id: first.company.id } }), beforeCompany);

  console.log(JSON.stringify({ ok: true, databasePath, checks: [
    "Index Company API ordering equals Full Card ordering",
    "first/middle/last Previous/Next and refresh positioning",
    "touch swipe threshold, direction and vertical scrolling guard",
    "Index-context path and invalid exhibition/index/company/membership denial",
    "research detail lazy API fields and wrong-exhibition 404",
    "Favorite/Today membership toggle and idempotency",
    "SYSTEM membership immutable and original Company/ExhibitionCompany preserved",
  ] }, null, 2));
} finally {
  await prisma.$disconnect();
}
