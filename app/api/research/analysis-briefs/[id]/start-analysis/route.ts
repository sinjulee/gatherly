import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildNotebookInstruction(input: {
  projectTitle: string;
  version: number;
  title: string;
  goal: string;
  researchQuestions: string | null;
  evaluationCriteria: string | null;
  additionalInstruction: string | null;
}) {
  const lines = [
    `프로젝트: ${input.projectTitle}`,
    `Analysis Brief: v${input.version} ${input.title}`,
    "",
    "이 노트북에 등록된 Gatherly 현장 Source와 위 Analysis Brief 문서를 기준으로 분석을 수행해 주세요.",
    "현장 Evidence를 우선 근거로 사용하고, 사실과 해석을 구분하세요. 핵심 주장에는 근거를 연결하고, 필요한 경우에만 신뢰할 수 있는 외부 자료를 보완 조사해 출처와 시점을 명시하세요.",
    "최종 결과는 의사결정에 바로 사용할 수 있는 구조화된 보고서 형태로 작성하고, 중요한 현장 이미지가 근거로 유효하면 해당 맥락과 함께 활용하세요.",
    "",
    `핵심 분석 방향: ${input.goal}`,
  ];

  if (input.researchQuestions) lines.push(`핵심 질문: ${input.researchQuestions}`);
  if (input.evaluationCriteria) lines.push(`평가 기준: ${input.evaluationCriteria}`);
  if (input.additionalInstruction) lines.push(`추가 지시: ${input.additionalInstruction}`);
  lines.push("", "보고서 초안을 완성한 뒤 핵심 결론, 근거, 불확실성, 추가 확인이 필요한 항목을 구분해 주세요.");

  return lines.join("\n");
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const brief = await prisma.analysisBrief.findUnique({
    where: { id },
    include: {
      fieldDay: { select: { id: true, title: true, deletedAt: true, notebookLink: true } },
      sourceBundle: { select: { id: true, version: true, status: true } },
    },
  });

  if (!brief || brief.fieldDay.deletedAt) {
    return NextResponse.json({ error: "분석 브리프를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!brief.driveFileId) {
    return NextResponse.json({ error: "먼저 Analysis Brief를 Google Docs에 동기화해 주세요." }, { status: 409 });
  }
  if (!brief.sourceBundle || brief.sourceBundle.status !== "SYNCED") {
    return NextResponse.json({ error: "연결된 Source Bundle의 Google Drive 동기화를 먼저 완료해 주세요." }, { status: 409 });
  }
  if (!brief.fieldDay.notebookLink?.notebookUrl) {
    return NextResponse.json({ error: "이 프로젝트의 NotebookLM 주소를 먼저 연결해 주세요." }, { status: 409 });
  }

  const updated = await prisma.analysisBrief.update({
    where: { id: brief.id },
    data: { status: "IN_ANALYSIS" },
  });

  return NextResponse.json({
    brief: updated,
    notebookUrl: brief.fieldDay.notebookLink.notebookUrl,
    documentUrl: `https://docs.google.com/document/d/${brief.driveFileId}/edit`,
    instruction: buildNotebookInstruction({
      projectTitle: brief.fieldDay.title,
      version: brief.version,
      title: brief.title,
      goal: brief.goal,
      researchQuestions: brief.researchQuestions,
      evaluationCriteria: brief.evaluationCriteria,
      additionalInstruction: brief.additionalInstruction,
    }),
  });
}
