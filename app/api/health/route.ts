import { access, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorageRoot } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthPart = "ok" | "unavailable";

/** Local monitoring endpoint: deliberately contains no paths, errors, counts, or stack traces. */
export async function GET() {
  const startedAt = performance.now();
  let database: HealthPart = "ok";
  let storage: HealthPart = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unavailable";
  }

  try {
    const storageRoot = getStorageRoot();
    const uploads = `${storageRoot}/uploads`;
    const details = await stat(uploads);
    if (!details.isDirectory()) throw new Error("not a directory");
    await access(uploads);
  } catch {
    storage = "unavailable";
  }

  const status = database === "ok" && storage === "ok" ? "ok" : "degraded";
  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      database,
      storage,
      responseTimeMs: Math.round(performance.now() - startedAt),
      runtime: "nodejs",
    },
    { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
