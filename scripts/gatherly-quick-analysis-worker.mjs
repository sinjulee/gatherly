import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const STORAGE_ROOT = path.resolve(ROOT, process.env.STORAGE_ROOT || "storage");
const RUNTIME_DIR = path.join(STORAGE_ROOT, "runtime");
const OUTPUT_ROOT = path.join(STORAGE_ROOT, "quick-analysis");
const HEARTBEAT_PATH = path.join(RUNTIME_DIR, "quick-analysis-worker.json");
const CODEX_BIN = process.env.GATHERLY_CODEX_BIN?.trim() || "codex";
const POLL_MS = Number(process.env.GATHERLY_QUICK_ANALYSIS_POLL_MS || "2000");
const TIMEOUT_MS = Number(process.env.GATHERLY_QUICK_ANALYSIS_TIMEOUT_MS || String(6 * 60_000));
const MAX_IMAGES = Number(process.env.GATHERLY_QUICK_ANALYSIS_MAX_IMAGES || "8");
const MAX_TEXT_CHARS = Number(process.env.GATHERLY_QUICK_ANALYSIS_MAX_TEXT_CHARS || "50000");

let stopping = false;
let codexVersion = null;

function safeStoredPath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes("..")) return null;
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  return resolved.startsWith(STORAGE_ROOT + path.sep) ? resolved : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function heartbeat(extra = {}) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(HEARTBEAT_PATH, JSON.stringify({
    pid: process.pid,
    updatedAt: new Date().toISOString(),
    codexVersion,
    ...extra,
  }, null, 2));
}

function inspectCodex() {
  const result = spawnSync(CODEX_BIN, ["--version"], { encoding: "utf8", cwd: ROOT, env: process.env });
  if (result.error) return null;
  if (result.status !== 0) return null;
  return (result.stdout || result.stderr || "codex").trim().slice(0, 160);
}

function briefContext(brief) {
  if (!brief) return "(연결된 Analysis Brief 없음 — 사용자의 빠른 분석 요청을 우선 기준으로 분석)";
  const sections = [
    `Analysis Brief v${brief.version}: ${brief.title}`,
    `분석 방향: ${brief.goal}`,
  ];
  if (brief.researchQuestions) sections.push(`핵심 질문:\n${brief.researchQuestions}`);
  if (brief.decisionContext) sections.push(`의사결정 맥락:\n${brief.decisionContext}`);
  if (brief.evaluationCriteria) sections.push(`평가 기준:\n${brief.evaluationCriteria}`);
  if (brief.targetScope) sections.push(`포함 범위:\n${brief.targetScope}`);
  if (brief.excludeScope) sections.push(`제외 범위:\n${brief.excludeScope}`);
  if (brief.additionalInstruction) sections.push(`추가 지시:\n${brief.additionalInstruction}`);
  return sections.join("\n\n");
}

function materialContext(materials) {
  let used = 0;
  const blocks = [];
  for (const material of materials) {
    const meta = [
      `[Evidence ${material.id}]`,
      `유형: ${material.type}`,
      `제목: ${material.title}`,
      `중요표시: ${material.isImportant ? "예" : "아니오"}`,
      `검토상태: ${material.reviewStatus}`,
      `수집시각: ${(material.capturedAt || material.createdAt).toISOString()}`,
    ];
    if (material.originalName) meta.push(`원본파일: ${material.originalName}`);
    if (material.description) meta.push(`설명: ${material.description}`);
    if (material.content) meta.push(`내용:\n${material.content}`);
    const block = meta.join("\n");
    if (used + block.length > MAX_TEXT_CHARS) {
      blocks.push("[이후 Evidence 텍스트는 현장 신속 분석 한도 때문에 생략됨]");
      break;
    }
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n\n---\n\n");
}

function buildPrompt(job) {
  const { fieldDay, analysisBrief, materials } = job;
  const unavailableMedia = materials.filter((item) => item.type === "VIDEO" || item.type === "AUDIO").length;
  return `당신은 Gatherly의 현장 리서치 분석가입니다. 이 작업은 현장에서 즉시 의사결정을 돕는 Quick Report를 만드는 것입니다.\n\n# 사용자 요청\n${job.instruction}\n\n# 현장 프로젝트\n프로젝트: ${fieldDay.title}\n장소: ${fieldDay.location || "미입력"}\n현장일: ${fieldDay.fieldDate.toISOString().slice(0, 10)}\n설명: ${fieldDay.description || "없음"}\n\n# Analysis Brief\n${briefContext(analysisBrief)}\n\n# 현장 Evidence\n${materialContext(materials)}\n\n# 작성 원칙\n- 현장 Evidence를 가장 우선적인 근거로 사용하세요.\n- 근거를 사용할 때 가능한 경우 [Evidence ID]를 함께 표기하세요.\n- 첨부 이미지가 있다면 직접 관찰 가능한 내용만 근거로 사용하고 과도하게 추정하지 마세요.\n- 사실, 현장 관찰, 해석/추론을 구분하세요.\n- 현재 자료만으로 확인할 수 없는 내용은 '추가 확인 필요'로 명시하세요.\n- 외부 웹 검색 기능을 사용할 수 있고 사용자 요청을 위해 필요하다면 신뢰도 높은 출처를 보완 조사하고 URL과 출처명을 적으세요. 검색 기능을 사용할 수 없다면 외부 사실을 꾸며내지 마세요.\n- VIDEO/AUDIO 원본은 현재 Quick Analysis에서 직접 분석되지 않을 수 있습니다. 해당 자료가 ${unavailableMedia}개 있으므로 필요한 경우 전사/추출 필요성을 표시하세요.\n- 결과는 한국어 Markdown으로 작성하세요.\n\n# Quick Report 형식\n## 한눈에 보는 결론\n3~5개 핵심 포인트\n\n## 핵심 발견\n중요도 순으로 정리하고 Evidence 근거 연결\n\n## 현장 근거\n관찰/메모/이미지에서 확인한 근거를 구체적으로 정리\n\n## 판단 및 시사점\n사용자의 분석 요청에 직접 답변\n\n## 추가 확인 필요\n불확실한 정보와 현장에서 더 수집하면 좋은 자료\n\n## 다음 액션\n현장에서 바로 실행할 수 있는 다음 조사 또는 의사결정 3~5개\n\n불필요하게 길게 쓰지 말고, 모바일 화면에서 빠르게 읽을 수 있는 고밀도 보고서로 작성하세요.`;
}

function imagePaths(materials) {
  return materials
    .filter((item) => item.type === "IMAGE" && item.relativePath)
    .sort((a, b) => Number(b.isImportant) - Number(a.isImportant) || new Date(b.createdAt) - new Date(a.createdAt))
    .map((item) => ({ item, absolutePath: safeStoredPath(item.relativePath) }))
    .filter((entry) => entry.absolutePath)
    .slice(0, MAX_IMAGES);
}

async function runCodex(job) {
  const outputDir = path.join(OUTPUT_ROOT, job.fieldDayId);
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${job.id}.md`);
  const images = imagePaths(job.materials);
  const args = ["exec", "--ephemeral", "--sandbox", "read-only", "--ignore-rules", "--output-last-message", outputPath];
  for (const image of images) args.push("--image", image.absolutePath);
  args.push("-");

  const prompt = `${buildPrompt(job)}\n\n# 첨부 이미지 순서\n${images.length ? images.map((entry, index) => `${index + 1}. [Evidence ${entry.item.id}] ${entry.item.title} — ${entry.item.originalName || entry.item.storedName || "image"}`).join("\n") : "첨부 이미지 없음"}`;

  return new Promise((resolve, reject) => {
    const child = spawn(CODEX_BIN, args, { cwd: ROOT, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); }, 3000).unref();
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(`[quick-analysis:${job.id}] ${text}`);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", async (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error("CODEX_TIMEOUT"));
      if (code !== 0) return reject(new Error(`CODEX_EXIT_${code}:${stderr.slice(-500)}`));
      try {
        const resultMarkdown = (await readFile(outputPath, "utf8")).trim() || stdout.trim();
        if (!resultMarkdown) return reject(new Error("CODEX_EMPTY_RESULT"));
        resolve({ resultMarkdown, outputPath: path.relative(ROOT, outputPath), imageCount: images.length });
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(prompt);
  });
}

async function processNext() {
  const queued = await prisma.quickAnalysisJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { queuedAt: "asc" },
    select: { id: true },
  });
  if (!queued) return false;

  const claimed = await prisma.quickAnalysisJob.updateMany({
    where: { id: queued.id, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), errorMessageSafe: null },
  });
  if (!claimed.count) return true;

  const job = await prisma.quickAnalysisJob.findUnique({
    where: { id: queued.id },
    include: {
      fieldDay: true,
      analysisBrief: true,
    },
  });
  if (!job) return true;

  const materials = await prisma.material.findMany({
    where: { fieldDayId: job.fieldDayId, deletedAt: null, uploadStatus: "STORED" },
    orderBy: [{ isImportant: "desc" }, { capturedAt: "desc" }, { createdAt: "desc" }],
  });

  await heartbeat({ activeJobId: job.id, state: "RUNNING" });
  try {
    const result = await runCodex({ ...job, materials });
    await prisma.quickAnalysisJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        resultMarkdown: result.resultMarkdown,
        outputPath: result.outputPath,
        completedAt: new Date(),
        errorMessageSafe: null,
      },
    });
    console.log(`[quick-analysis] completed ${job.id} (${materials.length} evidence, ${result.imageCount} images)`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 1000) : "QUICK_ANALYSIS_FAILED";
    await prisma.quickAnalysisJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessageSafe: message, completedAt: new Date() },
    }).catch(() => undefined);
    console.error(`[quick-analysis] failed ${job.id}: ${message}`);
  } finally {
    await heartbeat({ activeJobId: null, state: "IDLE" });
  }
  return true;
}

async function main() {
  codexVersion = inspectCodex();
  await heartbeat({ activeJobId: null, state: codexVersion ? "IDLE" : "CODEX_NOT_FOUND" });
  console.log(`[quick-analysis] worker started pid=${process.pid}`);
  console.log(`[quick-analysis] codex=${codexVersion || `not found (${CODEX_BIN})`}`);

  while (!stopping) {
    try {
      await heartbeat({ state: codexVersion ? "IDLE" : "CODEX_NOT_FOUND" });
      if (!codexVersion) {
        codexVersion = inspectCodex();
        await sleep(5000);
        continue;
      }
      const worked = await processNext();
      if (!worked) await sleep(POLL_MS);
    } catch (cause) {
      console.error("[quick-analysis] worker loop error", cause);
      await sleep(3000);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { stopping = true; });
}

main()
  .catch((cause) => {
    console.error("[quick-analysis] fatal", cause);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
