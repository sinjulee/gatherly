import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveStoredPath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fileResponse(stream: ReturnType<typeof createReadStream>, headers: Headers, status = 200) {
  return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await prisma.material.findFirst({ where: { id, deletedAt: null, uploadStatus: "STORED" } });
  if (!material?.relativePath || !material.mimeType) return NextResponse.json({ error: "저장된 파일을 찾을 수 없습니다." }, { status: 404 });
  const absolutePath = resolveStoredPath(material.relativePath);
  if (!absolutePath) return NextResponse.json({ error: "저장된 파일을 찾을 수 없습니다." }, { status: 404 });
  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) throw new Error("not a file");
    const headers = new Headers({ "Content-Type": material.mimeType, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" });
    const range = request.headers.get("range");
    if (!range) {
      headers.set("Content-Length", String(fileStat.size));
      return fileResponse(createReadStream(absolutePath), headers);
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + fileStat.size } });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), fileStat.size - 1) : fileStat.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= fileStat.size) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + fileStat.size } });
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Range", "bytes " + start + "-" + end + "/" + fileStat.size);
    return fileResponse(createReadStream(absolutePath, { start, end }), headers, 206);
  } catch {
    return NextResponse.json({ error: "저장된 파일을 찾을 수 없습니다." }, { status: 404 });
  }
}
