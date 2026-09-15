import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

const databaseUrl = process.env.PHASE3_DATABASE_URL;
if (!databaseUrl?.startsWith("file:")) throw new Error("PHASE3_DATABASE_URL must be an absolute SQLite file URL.");
const databasePath = path.resolve(databaseUrl.slice("file:".length));
const liveDatabasePath = path.resolve(process.cwd(), "prisma/dev.db");
const temporaryRoots = [path.resolve(os.tmpdir()), path.resolve("/private/tmp"), path.resolve("/tmp")];
assert.notEqual(databasePath, liveDatabasePath, "Refusing to run Phase 3 characterization against prisma/dev.db.");
assert(temporaryRoots.some((root) => databasePath.startsWith(`${root}${path.sep}`)), "Phase 3 characterization DB must be temporary.");

process.env.DATABASE_URL = databaseUrl;

const exhibitionIndexes = await import("../app/api/exhibitions/[id]/indexes/route");
const indexItem = await import("../app/api/indexes/[id]/route");
const indexCompanies = await import("../app/api/indexes/[id]/companies/route");
const indexCompany = await import("../app/api/indexes/[id]/companies/[companyId]/route");
const { prisma } = await import("../lib/prisma");

function jsonRequest(pathname: string, method: string, body?: unknown) {
  return new Request(`http://phase3.local${pathname}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function responseJson<T>(response: Response) {
  return await response.json() as T;
}

try {
  const exhibition = await prisma.exhibition.findFirstOrThrow({ where: { nameEn: "ENTECH 2026" } });
  const company = await prisma.company.findFirstOrThrow({ orderBy: { name: "asc" } });
  const companyCountBefore = await prisma.company.count();
  const systemIndex = await prisma.curationIndex.findFirstOrThrow({ where: { exhibitionId: exhibition.id, indexType: "SYSTEM" } });
  const favoriteIndex = await prisma.curationIndex.findFirstOrThrow({ where: { exhibitionId: exhibition.id, name: "나의 관심기업" } });

  const listResponse = await exhibitionIndexes.GET(
    new Request(`http://phase3.local/api/exhibitions/${exhibition.id}/indexes`),
    { params: Promise.resolve({ id: exhibition.id }) },
  );
  assert.equal(listResponse.status, 200);
  assert.equal((await responseJson<{ indexes: unknown[] }>(listResponse)).indexes.length, 8);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const createResponse = await exhibitionIndexes.POST(
    jsonRequest(`/api/exhibitions/${exhibition.id}/indexes`, "POST", {
      name: `Phase 3 개인 Index ${suffix}`,
      description: "Temporary characterization",
      icon: "📂",
      color: "#BDEFD8",
    }),
    { params: Promise.resolve({ id: exhibition.id }) },
  );
  assert.equal(createResponse.status, 201);
  const created = (await responseJson<{ index: { id: string; indexType: string; isSystem: boolean } }>(createResponse)).index;
  assert.equal(created.indexType, "PERSONAL");
  assert.equal(created.isSystem, false);

  const patchResponse = await indexItem.PATCH(
    jsonRequest(`/api/indexes/${created.id}`, "PATCH", { description: "Updated characterization", sortOrder: 999 }),
    { params: Promise.resolve({ id: created.id }) },
  );
  assert.equal(patchResponse.status, 200);

  const systemPatchResponse = await indexItem.PATCH(
    jsonRequest(`/api/indexes/${systemIndex.id}`, "PATCH", { name: "변경 금지" }),
    { params: Promise.resolve({ id: systemIndex.id }) },
  );
  assert.equal(systemPatchResponse.status, 403);
  const systemDeleteResponse = await indexItem.DELETE(
    new Request(`http://phase3.local/api/indexes/${systemIndex.id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id: systemIndex.id }) },
  );
  assert.equal(systemDeleteResponse.status, 403);

  const createMembershipResponse = await indexCompany.POST(
    jsonRequest(`/api/indexes/${created.id}/companies/${company.id}`, "POST", { reason: "직접 저장", priority: 10 }),
    { params: Promise.resolve({ id: created.id, companyId: company.id }) },
  );
  assert.equal(createMembershipResponse.status, 201);
  const idempotentMembershipResponse = await indexCompany.POST(
    jsonRequest(`/api/indexes/${created.id}/companies/${company.id}`, "POST", { reason: "직접 저장", priority: 10 }),
    { params: Promise.resolve({ id: created.id, companyId: company.id }) },
  );
  assert.equal(idempotentMembershipResponse.status, 200);

  const secondIndexMembershipResponse = await indexCompany.POST(
    jsonRequest(`/api/indexes/${favoriteIndex.id}/companies/${company.id}`, "POST", { reason: "다중 Index 확인" }),
    { params: Promise.resolve({ id: favoriteIndex.id, companyId: company.id }) },
  );
  assert.equal(secondIndexMembershipResponse.status, 201);
  assert.equal(await prisma.companyIndex.count({ where: { companyId: company.id, indexId: { in: [created.id, favoriteIndex.id] } } }), 2);

  const companiesResponse = await indexCompanies.GET(
    new Request(`http://phase3.local/api/indexes/${created.id}/companies?limit=20&offset=0`),
    { params: Promise.resolve({ id: created.id }) },
  );
  assert.equal(companiesResponse.status, 200);
  const companiesPayload = await responseJson<{ companies: Array<{ companyId: string }>; pagination: { total: number } }>(companiesResponse);
  assert.equal(companiesPayload.pagination.total, 1);
  assert.equal(companiesPayload.companies[0]?.companyId, company.id);

  const systemMembershipResponse = await indexCompany.POST(
    jsonRequest(`/api/indexes/${systemIndex.id}/companies/${company.id}`, "POST", {}),
    { params: Promise.resolve({ id: systemIndex.id, companyId: company.id }) },
  );
  assert.equal(systemMembershipResponse.status, 403);

  for (const indexId of [created.id, favoriteIndex.id]) {
    const deleteMembershipResponse = await indexCompany.DELETE(
      new Request(`http://phase3.local/api/indexes/${indexId}/companies/${company.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: indexId, companyId: company.id }) },
    );
    assert.equal(deleteMembershipResponse.status, 200);
  }
  const deleteResponse = await indexItem.DELETE(
    new Request(`http://phase3.local/api/indexes/${created.id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id: created.id }) },
  );
  assert.equal(deleteResponse.status, 200);
  assert.equal(await prisma.company.count(), companyCountBefore);
  assert.equal(await prisma.curationIndex.count({ where: { id: created.id } }), 0);

  console.log(JSON.stringify({
    ok: true,
    databasePath,
    checks: [
      "Index list and PERSONAL create/update/delete",
      "SYSTEM index update/delete protection",
      "PERSONAL membership create/idempotent update/delete",
      "SYSTEM membership mutation protection",
      "one Company in multiple indexes",
      "Index deletion preserves Company",
      "Index company response and pagination contract",
    ],
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
