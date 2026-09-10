import { readFile } from "node:fs/promises";
import path from "node:path";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DOCS_API = "https://docs.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
}

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: required("GATHERLY_GOOGLE_CLIENT_ID"),
    client_secret: required("GATHERLY_GOOGLE_CLIENT_SECRET"),
    refresh_token: required("GATHERLY_GOOGLE_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) throw new Error(`GOOGLE_TOKEN_FAILED:${data.error || response.status}`);
  return data.access_token;
}

async function googleFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

function escapeQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(token: string, name: string, parentId?: string) {
  const clauses = [
    `name = '${escapeQuery(name)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    "trashed = false",
  ];
  if (parentId) clauses.push(`'${escapeQuery(parentId)}' in parents`);
  const params = new URLSearchParams({ q: clauses.join(" and "), fields: "files(id,name,webViewLink)", pageSize: "10" });
  const response = await googleFetch(`${DRIVE_API}/files?${params}`, token);
  const data = await response.json() as { files?: Array<{ id: string; name: string; webViewLink?: string }> };
  if (!response.ok) throw new Error("DRIVE_FOLDER_SEARCH_FAILED");
  return data.files?.[0] || null;
}

async function createFolder(token: string, name: string, parentId?: string) {
  const response = await googleFetch(`${DRIVE_API}/files?fields=id,name,webViewLink`, token, {
    method: "POST",
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }),
  });
  const data = await response.json() as { id?: string; name?: string; webViewLink?: string };
  if (!response.ok || !data.id) throw new Error("DRIVE_FOLDER_CREATE_FAILED");
  return { id: data.id, name: data.name || name, webViewLink: data.webViewLink };
}

async function ensureFolder(token: string, name: string, parentId?: string) {
  return (await findFolder(token, name, parentId)) || createFolder(token, name, parentId);
}

async function ensureProjectFolder(token: string, projectTitle: string, fieldDayId: string) {
  const configuredRoot = process.env.GATHERLY_GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  const root = configuredRoot ? { id: configuredRoot } : await ensureFolder(token, "Gatherly");
  const projectsFolder = await ensureFolder(token, "Projects", root.id);
  const projectFolder = await ensureFolder(token, `${projectTitle} (${fieldDayId.slice(0, 8)})`, projectsFolder.id);
  return { root, projectsFolder, projectFolder };
}

async function createGoogleDoc(token: string, name: string, parentId: string) {
  const response = await googleFetch(`${DRIVE_API}/files?fields=id,name,webViewLink`, token, {
    method: "POST",
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.document", parents: [parentId] }),
  });
  const data = await response.json() as { id?: string; name?: string; webViewLink?: string };
  if (!response.ok || !data.id) throw new Error("GOOGLE_DOC_CREATE_FAILED");
  return { id: data.id, name: data.name || name, webViewLink: data.webViewLink };
}

async function replaceGoogleDocText(token: string, documentId: string, text: string) {
  const getResponse = await googleFetch(`${DOCS_API}/documents/${encodeURIComponent(documentId)}`, token);
  const document = await getResponse.json() as { body?: { content?: Array<{ endIndex?: number }> } };
  if (!getResponse.ok) throw new Error("GOOGLE_DOC_READ_FAILED");
  const endIndex = document.body?.content?.at(-1)?.endIndex ?? 1;
  const requests: object[] = [];
  if (endIndex > 2) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
  if (text.length) requests.push({ insertText: { location: { index: 1 }, text } });
  const response = await googleFetch(`${DOCS_API}/documents/${encodeURIComponent(documentId)}:batchUpdate`, token, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
  if (!response.ok) throw new Error("GOOGLE_DOC_WRITE_FAILED");
}

async function findFileByName(token: string, name: string, parentId: string) {
  const params = new URLSearchParams({
    q: `name = '${escapeQuery(name)}' and '${escapeQuery(parentId)}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,webViewLink)",
    pageSize: "10",
  });
  const response = await googleFetch(`${DRIVE_API}/files?${params}`, token);
  const data = await response.json() as { files?: Array<{ id: string; name: string; mimeType: string; webViewLink?: string }> };
  if (!response.ok) throw new Error("DRIVE_FILE_SEARCH_FAILED");
  return data.files?.find((file) => file.mimeType === "application/vnd.google-apps.document") || null;
}

function documentName(type: string) {
  const names: Record<string, string> = {
    PROJECT_OVERVIEW: "01 Project Overview",
    FIELD_NOTES: "02 Field Notes",
    PHOTO_EVIDENCE: "03 Photo Evidence",
    MEDIA_INDEX: "04 Media Index",
    SOURCE_INDEX: "05 Source Index",
  };
  return names[type] || type;
}

export async function syncSourceDocumentsToGoogleDrive(input: {
  projectTitle: string;
  fieldDayId: string;
  bundleVersion: number;
  documents: Array<{ id: string; documentType: string; localPath: string | null; driveFileId: string | null }>;
}) {
  const token = await getAccessToken();
  const { root, projectFolder } = await ensureProjectFolder(token, input.projectTitle, input.fieldDayId);
  const sourceFolder = await ensureFolder(token, "01_Source", projectFolder.id);
  const versionFolder = await ensureFolder(token, `v${input.bundleVersion}`, sourceFolder.id);

  const synced: Array<{ sourceDocumentId: string; driveFileId: string; webViewLink?: string }> = [];
  for (const source of input.documents) {
    if (!source.localPath) throw new Error("SOURCE_DOCUMENT_LOCAL_PATH_MISSING");
    const absolutePath = path.resolve(source.localPath);
    const content = await readFile(absolutePath, "utf8");
    const name = documentName(source.documentType);
    let doc = source.driveFileId ? { id: source.driveFileId, name } : await findFileByName(token, name, versionFolder.id);
    if (!doc) doc = await createGoogleDoc(token, name, versionFolder.id);
    await replaceGoogleDocText(token, doc.id, content);
    synced.push({ sourceDocumentId: source.id, driveFileId: doc.id, webViewLink: "webViewLink" in doc ? doc.webViewLink : undefined });
  }

  return {
    rootFolderId: root.id,
    projectFolderId: projectFolder.id,
    versionFolderId: versionFolder.id,
    versionFolderUrl: `https://drive.google.com/drive/folders/${versionFolder.id}`,
    synced,
  };
}

function section(label: string, value: string | null | undefined) {
  return value?.trim() ? `${label}\n${value.trim()}\n` : "";
}

export async function syncAnalysisBriefToGoogleDrive(input: {
  projectTitle: string;
  fieldDayId: string;
  briefId: string;
  version: number;
  title: string;
  goal: string;
  researchQuestions?: string | null;
  decisionContext?: string | null;
  evaluationCriteria?: string | null;
  targetScope?: string | null;
  excludeScope?: string | null;
  outputType?: string | null;
  additionalInstruction?: string | null;
  sourceBundleVersion?: number | null;
  driveFileId?: string | null;
}) {
  const token = await getAccessToken();
  const { root, projectFolder } = await ensureProjectFolder(token, input.projectTitle, input.fieldDayId);
  const briefFolder = await ensureFolder(token, "02_Analysis_Brief", projectFolder.id);
  const name = `v${input.version} ${input.title}`.slice(0, 180);
  let doc = input.driveFileId ? { id: input.driveFileId, name } : await findFileByName(token, name, briefFolder.id);
  if (!doc) doc = await createGoogleDoc(token, name, briefFolder.id);

  const content = [
    `Gatherly Analysis Brief v${input.version}`,
    `프로젝트: ${input.projectTitle}`,
    `브리프 ID: ${input.briefId}`,
    input.sourceBundleVersion ? `연결 Source Bundle: v${input.sourceBundleVersion}` : "연결 Source Bundle: 없음",
    "",
    section("분석 제목", input.title),
    section("분석 방향 / 목표", input.goal),
    section("핵심 연구 질문", input.researchQuestions),
    section("의사결정 맥락", input.decisionContext),
    section("평가 기준", input.evaluationCriteria),
    section("분석 범위", input.targetScope),
    section("제외 범위", input.excludeScope),
    section("결과물 유형", input.outputType),
    section("추가 지시", input.additionalInstruction),
    "NotebookLM 작업 지시",
    "이 Analysis Brief와 프로젝트 Source를 근거로 분석하세요. 각 핵심 주장에는 근거가 되는 Source를 연결하고, 현장 Evidence와 외부 조사 내용을 구분해 설명하세요. 불확실한 내용은 추정으로 표시하고, 최종 결과는 의사결정에 바로 사용할 수 있는 구조화된 보고서 형태로 작성하세요.",
  ].filter(Boolean).join("\n");

  await replaceGoogleDocText(token, doc.id, content);

  return {
    rootFolderId: root.id,
    projectFolderId: projectFolder.id,
    briefFolderId: briefFolder.id,
    briefFolderUrl: `https://drive.google.com/drive/folders/${briefFolder.id}`,
    driveFileId: doc.id,
    documentUrl: `https://docs.google.com/document/d/${doc.id}/edit`,
  };
}
