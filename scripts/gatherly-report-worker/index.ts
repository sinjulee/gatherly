import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const POLL_MS = Number(process.env.GATHERLY_REPORT_POLL_MS || 5000);
const WORKSPACE_ROOT = process.env.GATHERLY_REPORT_WORKSPACE || path.join(process.cwd(), "report-workspace");
let stopping = false;

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["analysisObjective", "keyQuestions", "researchRequirements", "proposedSections", "expectedEvidence", "risks"],
  properties: {
    analysisObjective: { type: "string" },
    keyQuestions: { type: "array", items: { type: "string" } },
    researchRequirements: { type: "array", items: { type: "string" } },
    proposedSections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "purpose"],
        properties: { title: { type: "string" }, purpose: { type: "string" } },
      },
    },
    expectedEvidence: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
  },
};

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function classifyCodexError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("usage") || lower.includes("limit") || lower.includes("quota")) return "CODEX_USAGE_LIMIT";
  if (lower.includes("login") || lower.includes("auth") || lower.includes("unauthorized")) return "CODEX_AUTH_REQUIRED";
  return "CODEX_EXEC_FAILED";
}

async function runCodexPlan(workspace: string, prompt: string) {
  const schemaPath = path.join(workspace, "analysis-plan.schema.json");
  const outputPath = path.join(workspace, "analysis-plan.output.json");
  await writeFile(schemaPath, JSON.stringify(planSchema, null, 2), "utf8");

  const args = [
    "exec",
    "--json",
    "--sandbox", "read-only",
    "--skip-git-repo-check",
    "--output-schema", schemaPath,
    "--output-last-message", outputPath,
    "-",
  ];

  const result = await new Promise<{ code: number; stderr: string }>((resolve, reject) => {
    const child = spawn("codex", args, { cwd: workspace, stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    child.stdin.end(prompt);
  });

  if (result.code !== 0) throw new Error(result.stderr || `codex exited with ${result.code}`);
  const raw = await readFile(outputPath, "utf8");
  return JSON.parse(raw) as {
    analysisObjective: string;
    keyQuestions: string[];
    researchRequirements: string[];
    proposedSections: { title: string; purpose: string }[];
    expectedEvidence: string[];
    risks: string[];
  };
}

async function handleGeneratePlan(jobId: string, reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      fieldDay: true,
      materials: { where: { selected: true }, include: { material: true } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!report) throw new Error("REPORT_NOT_FOUND");

  const workspace = path.join(WORKSPACE_ROOT, report.id);
  await mkdir(workspace, { recursive: true });

  const brief = {
    reportId: report.id,
    title: report.title,
    fieldDay: report.fieldDay ? {
      title: report.fieldDay.title,
      location: report.fieldDay.location,
      fieldDate: report.fieldDay.fieldDate,
      description: report.fieldDay.description,
    } : null,
    templateType: report.templateType,
    analysisDirection: report.analysisDirection,
    purpose: report.purpose,
    audience: report.audience,
    scope: report.scope ? JSON.parse(report.scope) : null,
    userQuestions: report.questions.map((item) => item.question),
    materials: report.materials.map(({ material }) => ({
      id: material.id,
      type: material.type,
      title: material.title,
      description: material.description,
      content: material.content,
      capturedAt: material.capturedAt,
    })),
  };
  await writeFile(path.join(workspace, "brief.json"), JSON.stringify(brief, null, 2), "utf8");

  const prompt = `You are the planning stage of Gatherly, an evidence-based field research reporting system.\n\nRead the complete research brief below and design an analysis plan. Do NOT write the final report. Do NOT invent evidence. The user's analysis direction must control the report structure. Distinguish what can be answered from field materials from what requires trustworthy external research. Prefer government, public statistics, academic, industry association, official company and reputable research sources when planning external research.\n\nReturn only data matching the supplied JSON schema.\n\nRESEARCH BRIEF:\n${JSON.stringify(brief, null, 2)}`;

  await prisma.report.update({ where: { id: report.id }, data: { status: "PLAN_GENERATING" } });
  await prisma.reportJob.update({ where: { id: jobId }, data: { stage: "CODEX_PLAN", progress: 20, workspacePath: workspace } });

  const plan = await runCodexPlan(workspace, prompt);
  await writeFile(path.join(workspace, "analysis-plan.json"), JSON.stringify(plan, null, 2), "utf8");

  await prisma.$transaction([
    prisma.reportAnalysisPlan.upsert({
      where: { reportId: report.id },
      create: {
        reportId: report.id,
        objective: plan.analysisObjective,
        keyQuestions: JSON.stringify(plan.keyQuestions),
        researchRequirements: JSON.stringify(plan.researchRequirements),
        proposedSections: JSON.stringify(plan.proposedSections),
        expectedEvidence: JSON.stringify(plan.expectedEvidence),
        risks: JSON.stringify(plan.risks),
      },
      update: {
        objective: plan.analysisObjective,
        keyQuestions: JSON.stringify(plan.keyQuestions),
        researchRequirements: JSON.stringify(plan.researchRequirements),
        proposedSections: JSON.stringify(plan.proposedSections),
        expectedEvidence: JSON.stringify(plan.expectedEvidence),
        risks: JSON.stringify(plan.risks),
        userApproved: false,
        approvedAt: null,
      },
    }),
    prisma.report.update({ where: { id: report.id }, data: { status: "PLAN_READY" } }),
    prisma.reportJob.update({ where: { id: jobId }, data: { status: "SUCCESS", stage: "PLAN_READY", progress: 100, completedAt: new Date() } }),
  ]);
}

async function claimNextJob() {
  const next = await prisma.reportJob.findFirst({
    where: { status: "QUEUED", jobType: "GENERATE_PLAN" },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return null;
  const claimed = await prisma.reportJob.updateMany({
    where: { id: next.id, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), attempt: { increment: 1 }, progress: 5 },
  });
  return claimed.count === 1 ? next : null;
}

async function runOnce() {
  const job = await claimNextJob();
  if (!job) return false;
  console.log(`[report-worker] start ${job.jobType} ${job.id}`);
  try {
    if (job.jobType === "GENERATE_PLAN") await handleGeneratePlan(job.id, job.reportId);
    else throw new Error(`UNSUPPORTED_JOB_TYPE:${job.jobType}`);
    console.log(`[report-worker] success ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode = classifyCodexError(message);
    await prisma.$transaction([
      prisma.reportJob.update({ where: { id: job.id }, data: { status: "FAILED", errorCode, errorMessage: message.slice(0, 4000), completedAt: new Date() } }),
      prisma.report.update({ where: { id: job.reportId }, data: { status: "FAILED" } }),
    ]);
    console.error(`[report-worker] failed ${job.id}`, message);
  }
  return true;
}

async function main() {
  console.log(`[report-worker] workspace=${WORKSPACE_ROOT} poll=${POLL_MS}ms`);
  while (!stopping) {
    const worked = await runOnce();
    if (!worked) await sleep(POLL_MS);
  }
}

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

main().catch((error) => {
  console.error("[report-worker] fatal", error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
