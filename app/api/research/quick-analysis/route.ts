import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function workerState() {
  const heartbeatPath = path.resolve(process.cwd(), process.env.STORAGE_ROOT || "storage", "runtime", "quick-analysis-worker.json");
  try {
    const fileStat = await stat(heartbeatPath);
    const data = JSON.parse(await readFile(heartbeatPath, "utf8")) as { pid?: number; updatedAt?: string; codexVersion?: string | null };
    const ageMs = Date.now() - fileStat.mtimeMs;
    return { online: ageMs < 15_000, ageMs, ...data };
  } catch {
    return { online: false, ageMs: null, pid: null, updatedAt: null, codexVersion: null };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldDayId = cleanText(searchParams.get("fieldDayId"), 100);
  if (!fieldDayId) return NextResponse.json({ error: "현장을 선택해 주세요." }, { status: 400 });

  const jobs = await prisma.quickAnalysisJob.findMany({
    where: { fieldDayId },
    orderBy: { queuedAt: "desc" },
    take: 20,
    include: {
      analysisBrief: { select: { id: true, version: true, title: true } },
    },
  });

  return NextResponse.json({ jobs, worker: await workerState() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fieldDayId = cleanText(body.fieldDayId, 100);
    const instruction = cleanText(body.instruction, 5000);
    const requestedBriefId = cleanText(body.analysisBriefId, 100) || null;

    if (!fieldDayId || !instruction) {
      return NextResponse.json({ error: "현장과 빠른 분석 요청 내용을 입력해 주세요." }, { status: 400 });
    }

    const project = await prisma.fieldDay.findFirst({
      where: { id: fieldDayId, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!project) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });

    const active = await prisma.quickAnalysisJob.findFirst({
      where: { fieldDayId, status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { queuedAt: "desc" },
      include: { analysisBrief: { select: { id: true, version: true, title: true } } },
    });
    if (active) return NextResponse.json({ job: active, reused: true, worker: await workerState() });

    const brief = requestedBriefId
      ? await prisma.analysisBrief.findFirst({
          where: { id: requestedBriefId, fieldDayId },
          select: { id: true, version: true, title: true },
        })
      : await prisma.analysisBrief.findFirst({
          where: { fieldDayId },
          orderBy: { version: "desc" },
          select: { id: true, version: true, title: true },
        });

    const title = instruction.length > 64 ? `${instruction.slice(0, 61)}…` : instruction;
    const job = await prisma.quickAnalysisJob.create({
      data: {
        fieldDayId,
        analysisBriefId: brief?.id ?? null,
        title,
        instruction,
        status: "QUEUED",
      },
      include: { analysisBrief: { select: { id: true, version: true, title: true } } },
    });

    return NextResponse.json({ job, reused: false, worker: await workerState() }, { status: 201 });
  } catch (cause) {
    console.error("[quick-analysis] create failed", cause);
    return NextResponse.json({ error: "빠른 분석 작업을 등록하지 못했습니다." }, { status: 500 });
  }
}
