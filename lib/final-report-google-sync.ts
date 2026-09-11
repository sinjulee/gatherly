const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DOCS_API = "https://docs.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
}

async function accessToken() {
  const body = new URLSearchParams({
    client_id: required("GATHERLY_GOOGLE_CLIENT_ID"),
    client_secret: required("GATHERLY_GOOGLE_CLIENT_SECRET"),
    refresh_token: required("GATHERLY_GOOGLE_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  const data = await response.json() as { access_token?: string };
  if (!response.ok || !data.access_token) throw new Error("GOOGLE_TOKEN_FAILED");
  return data.access_token;
}

async function gfetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers || {}) }, cache: "no-store" });
}
function esc(value: string) { return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
async function findFolder(token: string, name: string, parentId?: string) {
  const q = [`name = '${esc(name)}'`, `mimeType = 'application/vnd.google-apps.folder'`, "trashed = false", ...(parentId ? [`'${esc(parentId)}' in parents`] : [])].join(" and ");
  const p = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "10" });
  const r = await gfetch(`${DRIVE_API}/files?${p}`, token); const d = await r.json() as { files?: Array<{id:string;name:string}> };
  if (!r.ok) throw new Error("DRIVE_FOLDER_SEARCH_FAILED"); return d.files?.[0] || null;
}
async function createFolder(token: string, name: string, parentId?: string) {
  const r = await gfetch(`${DRIVE_API}/files?fields=id,name`, token, { method: "POST", body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }) });
  const d = await r.json() as { id?: string; name?: string }; if (!r.ok || !d.id) throw new Error("DRIVE_FOLDER_CREATE_FAILED"); return { id: d.id, name: d.name || name };
}
async function ensureFolder(token: string, name: string, parentId?: string) { return (await findFolder(token,name,parentId)) || createFolder(token,name,parentId); }
async function ensureProjectFolder(token: string, projectTitle: string, fieldDayId: string) {
  const configuredRoot = process.env.GATHERLY_GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  const root = configuredRoot ? { id: configuredRoot } : await ensureFolder(token, "Gatherly");
  const projects = await ensureFolder(token, "Projects", root.id);
  return ensureFolder(token, `${projectTitle} (${fieldDayId.slice(0,8)})`, projects.id);
}
async function createDoc(token: string, name: string, parentId: string) {
  const r = await gfetch(`${DRIVE_API}/files?fields=id,name`, token, { method: "POST", body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.document", parents: [parentId] }) });
  const d = await r.json() as { id?: string }; if (!r.ok || !d.id) throw new Error("GOOGLE_DOC_CREATE_FAILED"); return d.id;
}
async function replaceText(token: string, id: string, text: string) {
  const r = await gfetch(`${DOCS_API}/documents/${encodeURIComponent(id)}`, token); const d = await r.json() as { body?: { content?: Array<{endIndex?:number}> } };
  if (!r.ok) throw new Error("GOOGLE_DOC_READ_FAILED"); const end = d.body?.content?.at(-1)?.endIndex ?? 1;
  const requests: object[] = []; if (end > 2) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: end - 1 } } });
  if (text) requests.push({ insertText: { location: { index: 1 }, text } });
  const u = await gfetch(`${DOCS_API}/documents/${encodeURIComponent(id)}:batchUpdate`, token, { method: "POST", body: JSON.stringify({ requests }) });
  if (!u.ok) throw new Error("GOOGLE_DOC_WRITE_FAILED");
}

export async function syncFinalReportToGoogleDocs(input: { projectTitle: string; fieldDayId: string; title: string; version: number; content: string; googleDocId?: string | null }) {
  const token = await accessToken();
  const projectFolder = await ensureProjectFolder(token, input.projectTitle, input.fieldDayId);
  const finalFolder = await ensureFolder(token, "04_Final_Report", projectFolder.id);
  const name = `v${input.version} ${input.title}`.slice(0,180);
  const docId = input.googleDocId || await createDoc(token, name, finalFolder.id);
  await replaceText(token, docId, input.content);
  return { googleDocId: docId, documentUrl: `https://docs.google.com/document/d/${docId}/edit`, folderUrl: `https://drive.google.com/drive/folders/${finalFolder.id}` };
}
