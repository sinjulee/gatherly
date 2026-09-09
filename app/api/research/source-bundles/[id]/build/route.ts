import { NextResponse } from "next/server";
import { buildNotebookLmSources } from "@/lib/research-source-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await buildNotebookLmSources(id);
    return NextResponse.json({ result });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "SOURCE_BUILD_FAILED";
    if (message === "SOURCE_BUNDLE_NOT_FOUND") return NextResponse.json({ error: "Source Bundle을 찾을 수 없습니다." }, { status: 404 });
    if (message === "SOURCE_BUNDLE_EMPTY") return NextResponse.json({ error: "Source Bundle에 포함된 자료가 없습니다." }, { status: 400 });
    return NextResponse.json({ error: "NotebookLM용 Source 문서를 만들지 못했습니다." }, { status: 500 });
  }
}
