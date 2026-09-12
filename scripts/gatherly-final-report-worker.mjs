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
const OUTPUT_SCHEMA_PATH = path.join(RUNTIME_DIR, "final-report-output.schema.json");
const CODEX_BIN = process.env.GATHERLY_CODEX_BIN?.trim() || "codex";
const POLL_MS = Number(process.env.GATHERLY_FINAL_REPORT_POLL_MS || "2500");
const TIMEOUT_MS = Number(process.env.GATHERLY_FINAL_REPORT_TIMEOUT_MS || String(12 * 60_000));
const MAX_IMAGES = Number(process.env.GATHERLY_FINAL_REPORT_MAX_IMAGES || "12");
const MAX_TEXT_CHARS = Number(process.env.GATHERLY_FINAL_REPORT_MAX_TEXT_CHARS || "90000");
const SCHEMA_VERSION = "gatherly.report.v1";
let stopping = false;
let codexVersion = null;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["report_markdown", "structured_result"],
  properties: {
    report_markdown: { type: "string" },
    structured_result: {
      type: "object",
      additionalProperties: false,
      required: ["schema_version", "analysis_direction", "executive_summary", "findings", "insights", "recommendations", "metrics", "evidence_refs", "external_sources", "selected_images", "tags"],
      properties: {
        schema_version: { type: "string", enum: [SCHEMA_VERSION] },
        analysis_direction: { type: "string" },
        executive_summary: { type: "string" },
        findings: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["finding_id", "title", "summary", "evidence_refs", "confidence"],
            properties: {
              finding_id: { type: "string" }, title: { type: "string" }, summary: { type: "string" },
              evidence_refs: { type: "array", items: { type: "string" } },
              confidence: { type: ["number", "null"] },
            },
          },
        },
        insights: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["insight_id", "title", "summary", "implication", "evidence_refs", "confidence"],
            properties: {
              insight_id: { type: "string" }, title: { type: "string" }, summary: { type: "string" },
              implication: { type: ["string", "null"] }, evidence_refs: { type: "array", items: { type: "string" } },
              confidence: { type: ["number", "null"] },
            },
          },
        },
        recommendations: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["recommendation_id", "title", "action", "rationale", "priority", "evidence_refs"],
            properties: {
              recommendation_id: { type: "string" }, title: { type: "string" }, action: { type: "string" },
              rationale: { type: ["string", "null"] }, priority: { type: ["string", "null"], enum: ["HIGH", "MEDIUM", "LOW", null] },
              evidence_refs: { type: "array", items: { type: "string" } },
            },
          },
        },
        metrics: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["metric_id", "name", "value", "unit", "period", "source_id", "confidence"],
            properties: {
              metric_id: { type: "string" }, name: { type: "string" }, value: { type: ["number", "string"] },
              unit: { type: ["string", "null"] }, period: { type: ["string", "null"] }, source_id: { type: ["string", "null"] },
              confidence: { type: ["number", "null"] },
            },
          },
        },
        evidence_refs: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["evidence_id", "evidence_type", "material_id", "source_id", "summary"],
            properties: {
              evidence_id: { type: "string" }, evidence_type: { type: "string", enum: ["FIELD", "EXTERNAL", "INFERENCE"] },
              material_id: { type: ["string", "null"] }, source_id: { type: ["string", "null"] }, summary: { type: "string" },
            },
          },
        },
        external_sources: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["source_id", "title", "publisher", "url", "published_at", "accessed_at", "source_tier"],
            properties: {
              source_id: { type: "string" }, title: { type: "string" }, publisher: { type: ["string", "null"] },
              url: { type: ["string", "null"] }, published_at: { type: ["string", "null"] }, accessed_at: { type: ["string", "null"] },
              source_tier: { type: ["string", "null"], enum: ["A", "B", "C", "D", null] },
            },
          },
        },
        selected_images: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["material_id", "caption", "section_key"],
            properties: { material_id: { type: "string" }, caption: { type: ["string", "null"] }, section_key: { type: ["string", "null"] } },
          },
        },
        tags: { type: "array", items: { type: "string" } },
      },
    },
  },
};

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
async function ensureOutputSchema() {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(OUTPUT_SCHEMA_PATH, JSON.stringify(OUTPUT_SCHEMA, null, 2));
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
  const revision = ctx.parentReport?.content
    ? `\n# 기존 보고서\n아래 v${ctx.parentReport.reportVersion} 보고서를 사용자의 수정 요청에 맞게 개선하세요. 기존의 좋은 근거와 구조는 유지하되 수정 요청과 충돌하면 수정 요청을 우선하세요.\n\n${ctx.parentReport.content}\n`
    : "";
  return `당신은 Gatherly의 수석 리서치 애널리스트이자 보고서 에디터입니다. 현장 Evidence를 핵심 근거로 삼아 실제 의사결정에 사용할 수 있는 최종 보고서 초안을 작성하세요.\n\n# 사용자 요청\n${ctx.report.instruction || "완성도 높은 최종 보고서를 작성하세요."}\n\n# 현장 프로젝트\n프로젝트: ${ctx.fieldDay.title}\n장소: ${ctx.fieldDay.location || "미입력"}\n현장일: ${ctx.fieldDay.fieldDate.toISOString().slice(0,10)}\n설명: ${ctx.fieldDay.description || "없음"}\n\n# 최신 Analysis Brief\n${briefText(ctx.analysisBrief)}\n\n# Quick Analysis 참고\n${quickText(ctx.quickJobs)}\n\n# 현장 Evidence\n${evidenceText(ctx.materials)}\n${revision}\n# 작성 원칙\n- report_markdown과 structured_result는 반드시 같은 판단과 같은 근거를 반영하세요.\n- 현장 Evidence가 최우선 근거입니다. 핵심 주장에는 가능한 경우 [Evidence ID]를 연결하세요.\n- FIELD는 실제 수집 자료, EXTERNAL은 외부 출처, INFERENCE는 해석/추론입니다. 서로 혼동하지 마세요.\n- Quick Analysis는 참고용이며 원 Evidence와 충돌하면 Evidence를 우선하세요.\n- 확인하지 못한 사실이나 수치를 꾸며내지 마세요. 수치는 metrics에 별도로 구조화하세요.\n- 외부 출처를 사용했다면 external_sources에 source_id를 만들고 관련 Evidence/Metric과 연결하세요.\n- 첨부 이미지 중 활용 가치가 있는 것만 selected_images에 넣고 실제 material_id를 사용하세요.\n- confidence는 0~1 범위로 판단하고 불확실하면 낮게 두세요.\n- 모바일에서도 읽기 쉽고 Google Docs로 옮겨도 자연스러운 한국어 Markdown으로 작성하세요.\n\n# report_markdown 필수 구조\n# ${ctx.report.title}\n## Executive Summary\n## 조사 목적과 범위\n## 핵심 발견\n## 근거 기반 분석\n## 시사점 및 전략 제안\n## 리스크와 한계\n## 권장 다음 액션\n## 권장 이미지\n## 근거 및 출처\n\n# structured_result 작성 규칙\n- schema_version은 정확히 ${SCHEMA_VERSION}\n- analysis_direction은 이번 보고서가 어떤 의사결정 관점으로 자료를 해석했는지 한 문장으로 명확하게 작성\n- findings, insights, recommendations는 각각 고유 ID를 부여\n- evidence_refs의 evidence_id를 findings/insights/recommendations의 evidence_refs 배열에서 참조\n- 현장 Material을 참조하는 FIELD evidence에는 material_id를 실제 Evidence ID 값과 동일하게 넣기\n- metrics는 PlanFrame이 바로 사용할 수 있도록 값, 단위, 기간, source_id를 분리\n- tags는 향후 전략 분석 분류에 쓸 수 있는 짧은 키워드 배열\n\n최종 출력은 지정된 JSON Schema를 정확히 만족하는 객체 하나만 반환하세요.`;
}

function validateStructuredResult(value) {
  if (!value || typeof value !== "object") throw new Error("STRUCTURED_RESULT_INVALID");
  if (value.schema_version !== SCHEMA_VERSION) throw new Error("STRUCTURED_RESULT_SCHEMA_VERSION_INVALID");
  if (typeof value.analysis_direction !== "string" || !value.analysis_direction.trim()) throw new Error("STRUCTURED_RESULT_ANALYSIS_DIRECTION_REQUIRED");
  for (const key of ["findings", "insights", "recommendations", "metrics", "evidence_refs", "external_sources", "selected_images", "tags"]) {
    if (!Array.isArray(value[key])) throw new Error(`STRUCTURED_RESULT_${key.toUpperCase()}_INVALID`);
  }
  return value;
}

async function runCodex(ctx) {
  const outputDir = path.join(OUTPUT_ROOT, ctx.report.fieldDayId || "unassigned");
  await mkdir(outputDir, { recursive: true });
  await ensureOutputSchema();
  const baseName = `${ctx.report.id}-v${ctx.report.reportVersion}`;
  const jsonOutputPath = path.join(outputDir, `${baseName}.json`);
  const markdownOutputPath = path.join(outputDir, `${baseName}.md`);
  const images = imagePaths(ctx.materials);
  const args = [
    "exec", "--ephemeral", "--sandbox", "read-only", "--ignore-rules",
    "--output-schema", OUTPUT_SCHEMA_PATH,
    "--output-last-message", jsonOutputPath,
  ];
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
    child.on("exit",async code=>{
      clearTimeout(timer);
      if(timedOut)return reject(new Error("CODEX_TIMEOUT"));
      if(code!==0)return reject(new Error(`CODEX_EXIT_${code}:${stderr.slice(-500)}`));
      try{
        const raw=(await readFile(jsonOutputPath,"utf8")).trim()||stdout.trim();
        if(!raw)return reject(new Error("CODEX_EMPTY_RESULT"));
        const parsed=JSON.parse(raw);
        const content=typeof parsed.report_markdown === "string" ? parsed.report_markdown.trim() : "";
        if(!content)return reject(new Error("CODEX_EMPTY_MARKDOWN"));
        const structuredResult=validateStructuredResult(parsed.structured_result);
        await writeFile(markdownOutputPath, content);
        resolve({
          content,
          structuredResult,
          outputPath:path.relative(ROOT,markdownOutputPath),
          structuredOutputPath:path.relative(ROOT,jsonOutputPath),
          imageCount:images.length,
        });
      }catch(e){reject(e);}
    });
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
    const serialized = JSON.stringify(result.structuredResult);
    await prisma.$transaction(async (tx) => {
      await tx.reportVersion.upsert({
        where: { reportId_reportVersion: { reportId: report.id, reportVersion: report.reportVersion } },
        create: {
          reportId: report.id,
          reportVersion: report.reportVersion,
          versionType: report.parentReportId ? "AI_REVISION" : "AI_DRAFT",
          status: "DRAFT",
          title: report.title,
          content: result.content,
          structuredResult: serialized,
          structuredSchemaVersion: SCHEMA_VERSION,
          createdBy: "CODEX",
        },
        update: {
          versionType: report.parentReportId ? "AI_REVISION" : "AI_DRAFT",
          status: "DRAFT",
          title: report.title,
          content: result.content,
          structuredResult: serialized,
          structuredSchemaVersion: SCHEMA_VERSION,
          createdBy: "CODEX",
        },
      });
      await tx.report.update({
        where: { id: report.id },
        data: {
          status: "COMPLETED",
          content: result.content,
          structuredResult: serialized,
          structuredSchemaVersion: SCHEMA_VERSION,
          outputPath: result.outputPath,
          completedAt: new Date(),
          errorMessageSafe: null,
        },
      });
    });
    console.log(`[final-report] completed ${report.id} v${report.reportVersion} (${materials.length} evidence, ${result.imageCount} images, structured=${result.structuredOutputPath})`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0,1000) : "FINAL_REPORT_FAILED";
    await prisma.report.update({ where: { id: report.id }, data: { status: "FAILED", errorMessageSafe: message, completedAt: new Date() } }).catch(()=>undefined);
    console.error(`[final-report] failed ${report.id}: ${message}`);
  } finally { await heartbeat({ activeReportId: null, state: "IDLE" }); }
  return true;
}

async function main() {
  codexVersion = inspectCodex();
  await ensureOutputSchema();
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