import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const STORAGE_ROOT = path.resolve(ROOT, process.env.STORAGE_ROOT || "storage");
const OUTPUT_ROOT = path.join(STORAGE_ROOT, "final-reports");
const RUNTIME_DIR = path.join(STORAGE_ROOT, "runtime");
const HEARTBEAT_PATH = path.join(RUNTIME_DIR, "final-report-worker.json");
const CODEX_BIN = process.env.GATHERLY_CODEX_BIN?.trim() || "codex";
const POLL_MS = Number(process.env.GATHERLY_FINAL_REPORT_POLL_MS || "2500");
const TIMEOUT_MS = Number(process.env.GATHERLY_FINAL_REPORT_TIMEOUT_MS || String(12 * 60_000));
const MAX_IMAGES = Number(process.env.GATHERLY_FINAL_REPORT_MAX_IMAGES || "12");
const MAX_TEXT_CHARS = Number(process.env.GATHERLY_FINAL_REPORT_MAX_TEXT_CHARS || "90000");
let stopping = false;
let codexVersion = null;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function safeStoredPath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes("..")) return null;
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  return resolved.startsWith(STORAGE_ROOT + path.sep) ? resolved : null;
}
function inspectCodex() {
  const result = spawnSync(CODEX_BIN, ["--version"], { encoding: "utf8", cwd: ROOT, env: process.env });
  return result.error || result.status !== 0 ? null : (result.stdout || result.stderr || "codex").trim().slice(0, 160);
}
async function heartbeat(extra = {}) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(HEARTBEAT_PATH, JSON.stringify({ pid: process.pid, updatedAt: new Date().toISOString(), codexVersion, ...extra }, null, 2));
}

function briefText(brief) {
  if (!brief) return "연결된 Analysis Brief 없음. 현장자료와 사용자의 보고서 요청을 중심으로 작성하세요.";
  return [
    `제목: ${brief.title}`,
    `분석 목표: ${brief.goal}`,
    brief.researchQuestions && `핵심 질문:\n${brief.researchQuestions}`,
    brief.decisionContext && `의사결정 맥락:\n${brief.decisionContext}`,
    brief.evaluationCriteria && `평가 기준:\n${brief.evaluationCriteria}`,
    brief.additionalInstruction && `추가 지시:\n${brief.additionalInstruction}`,
  ].filter(Boolean).join("\n\n");
}

function evidenceText(materials) {
  let used = 0;
  const blocks = [];
  for (const item of materials) {
    const block = [
      `[Evidence ${item.id}]`, `유형: ${item.type}`, `제목: ${item.title}`,
      `중요표시: ${item.isImportant ? "예" : "아니오"}`, `검토상태: ${item.reviewStatus}`,
      item.description && `설명: ${item.description}`, item.content && `내용:\n${item.content}`,
      item.originalName && `원본파일: ${item.originalName}`,
    ].filter(Boolean).join("\n");
    if (used + block.length > MAX_TEXT_CHARS) { blocks.push("[이후 Evidence 텍스트 생략]"); break; }
    blocks.push(block); used += block.length;
  }
  return blocks.join("\n\n---\n\n");
}

function quickText(jobs) {
  if (!jobs.length) return "완료된 Quick Analysis 없음";
  return jobs.map((job) => `### ${job.title}\n요청: ${job.instruction}\n${job.resultMarkdown || ""}`).join("\n\n---\n\n");
}

function imagePaths(materials) {
  return materials.filter((item) => item.type === "IMAGE" && item.relativePath)
    .sort((a,b) => Number(b.isImportant)-Number(a.isImportant) || new Date(b.createdAt)-new Date(a.createdAt))
    .map((item) => ({ item, absolutePath: safeStoredPath(item.relativePath) }))
    .filter((entry) => entry.absolutePath).slice(0, MAX_IMAGES);
}

function promptFor(ctx) {
  const revision = ctx.parentReport?.content ? `\n# 기존 보고서\n아래 v${ctx.parentReport.version} 보고서를 사용자의 수정 요청에 맞게 개선하세요. 기존의 좋은 근거와 구조는 유지하되 수정 요청과 충돌하면 수정 요청을 우선하세요.\n\n${ctx.parentReport.content}\n` : "";
  return `당신은 Gatherly의 수석 리서치 애널리스트이자 보고서 에디터입니다. 현장 Evidence를 핵심 근거로 삼아 실제 의사결정에 사용할 수 있는 최종 보고서를 작성하세요.\n\n# 사용자 요청\n${ctx.report.instruction || "완성도 높은 최종 보고서를 작성하세요."}\n\n# 현장 프로젝트\n프로젝트: ${ctx.fieldDay.title}\n장소: ${ctx.fieldDay.location || "미입력"}\n현장일: ${ctx.fieldDay.fieldDate.toISOString().slice(0,10)}\n설명: ${ctx.fieldDay.description || "없음"}\n\n# 최신 Analysis Brief\n${briefText(ctx.analysisBrief)}\n\n# Quick Analysis 참고\n${quickText(ctx.quickJobs)}\n\n# 현장 Evidence\n${evidenceText(ctx.materials)}\n${revision}\n# 작성 원칙\n- 현장 Evidence가 최우선 근거입니다. 핵심 주장에는 가능한 경우 [Evidence ID]를 연결하세요.\n- Quick Analysis는 참고용이며 원 Evidence와 충돌하면 Evidence를 우선하세요.\n- 사실, 현장 관찰, 해석/추론, 외부 정보를 명확히 구분하세요.\n- 외부 조사가 필요하고 도구를 사용할 수 있다면 신뢰도 높은 출처를 보완하고 출처명과 URL을 적으세요. 확인하지 못한 사실은 꾸며내지 마세요.\n- 첨부 이미지는 보고서에서 활용 가치가 있는 것만 골라 '권장 이미지' 섹션에 Evidence ID와 배치 이유를 적으세요.\n- 모바일에서도 읽기 쉽고, Google Docs로 옮겨도 자연스러운 한국어 Markdown으로 작성하세요.\n- 지나치게 장황한 문장보다 제목, 요약, 표/불릿을 적절히 사용하세요.\n\n# 필수 구조\n# ${ctx.report.title}\n## Executive Summary\n## 조사 목적과 범위\n## 핵심 발견\n## 근거 기반 분석\n## 시사점 및 전략 제안\n## 리스크와 한계\n## 권장 다음 액션\n## 권장 이미지\n## 근거 및 출처\n\n보고서가 Analysis Brief의 질문과 의사결정 목적에 직접 답하는지 마지막에 스스로 검토한 뒤 최종본만 출력하세요.`;
}

async function runCodex(ctx) {
  const outputDir = path.join(OUTPUT_ROOT, ctx.report.fieldDayId || "unassigned");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${ctx.report.id}-v${ctx.report.version}.md`);
  const images = imagePaths(ctx.materials);
  const args = ["exec", "--ephemeral", "--sandbox", "read-only", "--ignore-rules", "--output-last-message", outputPath];
  for (const image of images) args.push("--image", image.absolutePath);
  args.push("-");
  const prompt = `${promptFor(ctx)}\n\n# 첨부 이미지 순서\n${images.length ? images.map((entry,index)=>`${index+1}. [Evidence ${entry.item.id}] ${entry.item.title}`).join("\n") : "첨부 이미지 없음"}`;

  return new Promise((resolve,reject) => {
    const child = spawn(CODEX_BIN,args,{cwd:ROOT,env:process.env,stdio:["pipe","pipe","pipe"]});
    let stderr="", stdout="", timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;child.kill("SIGTERM");setTimeout(()=>{if(!child.killed)child.kill("SIGKILL");},3000).unref();},TIMEOUT_MS);
    child.stdout.on("data",c=>{stdout+=c.toString();});
    child.stderr.on("data",c=>{const t=c.toString();stderr+=t;process.stderr.write(`[final-report:${ctx.report.id}] ${t}`);});
    child.on("error",e=>{clearTimeout(timer);reject(e);});
    child.on("exit",async code=>{clearTimeout(timer);if(timedOut)return reject(new Error("CODEX_TIMEOUT"));if(code!==0)return reject(new Error(`CODEX_EXIT_${code}:${stderr.slice(-500)}`));try{const content=(await readFile(outputPath,"utf8")).trim()||stdout.trim();if(!content)return reject(new Error("CODEX_EMPTY_RESULT"));resolve({content,outputPath:path.relative(ROOT,outputPath),imageCount:images.length});}catch(e){reject(e);}});
    child.stdin.end(prompt);
  });
}

async function processNext() {
  const queued = await prisma.report.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!queued) return false;
  const claimed = await prisma.report.updateMany({ where: { id: queued.id, status: "QUEUED" }, data: { status: "RUNNING", startedAt: new Date(), errorMessageSafe: null } });
  if (!claimed.count) return true;
  const report = await prisma.report.findUnique({ where: { id: queued.id }, include: { fieldDay: true, parentReport: true } });
  if (!report?.fieldDay) return true;
  const [analysisBrief, quickJobs, materials] = await Promise.all([
    prisma.analysisBrief.findFirst({ where: { fieldDayId: report.fieldDayId }, orderBy: { version: "desc" } }),
    prisma.quickAnalysisJob.findMany({ where: { fieldDayId: report.fieldDayId, status: "COMPLETED" }, orderBy: { completedAt: "desc" }, take: 5 }),
    prisma.material.findMany({ where: { fieldDayId: report.fieldDayId, deletedAt: null, uploadStatus: "STORED" }, orderBy: [{ isImportant: "desc" }, { capturedAt: "desc" }, { createdAt: "desc" }] }),
  ]);
  await heartbeat({ activeReportId: report.id, state: "RUNNING" });
  try {
    const result = await runCodex({ report, fieldDay: report.fieldDay, parentReport: report.parentReport, analysisBrief, quickJobs, materials });
    await prisma.report.update({ where: { id: report.id }, data: { status: "COMPLETED", content: result.content, outputPath: result.outputPath, completedAt: new Date(), errorMessageSafe: null } });
    console.log(`[final-report] completed ${report.id} (${materials.length} evidence, ${result.imageCount} images)`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0,1000) : "FINAL_REPORT_FAILED";
    await prisma.report.update({ where: { id: report.id }, data: { status: "FAILED", errorMessageSafe: message, completedAt: new Date() } }).catch(()=>undefined);
    console.error(`[final-report] failed ${report.id}: ${message}`);
  } finally { await heartbeat({ activeReportId: null, state: "IDLE" }); }
  return true;
}

async function main() {
  codexVersion = inspectCodex();
  await heartbeat({ activeReportId: null, state: codexVersion ? "IDLE" : "CODEX_NOT_FOUND" });
  console.log(`[final-report] worker started pid=${process.pid}`);
  while (!stopping) {
    try {
      await heartbeat({ state: codexVersion ? "IDLE" : "CODEX_NOT_FOUND" });
      if (!codexVersion) { codexVersion=inspectCodex(); await sleep(5000); continue; }
      const worked=await processNext(); if(!worked) await sleep(POLL_MS);
    } catch(cause) { console.error("[final-report] worker loop error",cause); await sleep(3000); }
  }
}
for (const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>{stopping=true;});
main().catch(cause=>{console.error("[final-report] fatal",cause);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect().catch(()=>undefined);});
