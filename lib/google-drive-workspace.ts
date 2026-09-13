const DRIVE_API = "https://www.googleapis.com/drive/v3";
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

async function createFolder(token: string, name: string, parentId?: string) {
  const response = await googleFetch(`${DRIVE_API}/files?fields=id,name,webViewLink`, token, {
    method: "POST",
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }),
  });
  const data = await response.json() as { id?: string; name?: string; webViewLink?: string };
  if (!response.ok || !data.id) throw new Error("DRIVE_FOLDER_CREATE_FAILED");
  return { id: data.id, name: data.name || name, webViewLink: data.webViewLink };
}

async function findFolders(token: string, name: string, parentId?: string) {
  const clauses = [`name = '${escapeQuery(name)}'`, `mimeType = 'application/vnd.google-apps.folder'`, "trashed = false"];
  if (parentId) clauses.push(`'${escapeQuery(parentId)}' in parents`);
  const params = new URLSearchParams({ q: clauses.join(" and "), fields: "files(id,name,webViewLink,parents)", pageSize: "100" });
  const response = await googleFetch(`${DRIVE_API}/files?${params}`, token);
  const data = await response.json() as { files?: Array<{ id: string; name: string; webViewLink?: string; parents?: string[] }> };
  if (!response.ok) throw new Error("DRIVE_FOLDER_SEARCH_FAILED");
  return data.files || [];
}

async function ensureFolder(token: string, name: string, parentId?: string) {
  const matches = await findFolders(token, name, parentId);
  return matches[0] || createFolder(token, name, parentId);
}

export async function createSharedDriveWorkspace(projectTitle: string) {
  const token = await getAccessToken();
  const configuredRoot = process.env.GATHERLY_GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  const root = configuredRoot ? { id: configuredRoot } : await ensureFolder(token, "Gatherly");
  const projects = await ensureFolder(token, "Projects", root.id);
  const existing = await findFolders(token, projectTitle, projects.id);
  if (existing.length > 1) throw new Error("DRIVE_WORKSPACE_NAME_AMBIGUOUS");
  const project = existing[0] || await createFolder(token, projectTitle, projects.id);
  for (const name of ["00_사전조사", "01_현장자료", "02_조사계획", "03_분석자료", "04_최종보고서"]) {
    await ensureFolder(token, name, project.id);
  }
  return { id: project.id, name: project.name, webViewLink: project.webViewLink || `https://drive.google.com/drive/folders/${project.id}` };
}

export async function getDriveFolder(folderId: string) {
  const token = await getAccessToken();
  const response = await googleFetch(`${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,webViewLink,trashed`, token);
  const data = await response.json() as { id?: string; name?: string; mimeType?: string; webViewLink?: string; trashed?: boolean };
  if (!response.ok || !data.id || data.trashed || data.mimeType !== "application/vnd.google-apps.folder") throw new Error("DRIVE_WORKSPACE_NOT_FOUND");
  return { id: data.id, name: data.name || "", webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}` };
}

export async function ensureSharedDriveSubfolders(folderId: string) {
  const token = await getAccessToken();
  const created: Record<string, string> = {};
  for (const name of ["00_사전조사", "01_현장자료", "02_조사계획", "03_분석자료", "04_최종보고서"]) {
    const folder = await ensureFolder(token, name, folderId);
    created[name] = folder.id;
  }
  return created;
}

export async function scanPreResearchSources(folderId: string) {
  const token = await getAccessToken();
  const matches = await findFolders(token, "00_사전조사", folderId);
  const preResearchFolder = matches[0] || await createFolder(token, "00_사전조사", folderId);
  const params = new URLSearchParams({
    q: `'${escapeQuery(preResearchFolder.id)}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,webViewLink,modifiedTime,size,md5Checksum)",
    pageSize: "1000",
    orderBy: "name",
  });
  const response = await googleFetch(`${DRIVE_API}/files?${params}`, token);
  const data = await response.json() as { files?: Array<{ id: string; name: string; mimeType?: string; webViewLink?: string; modifiedTime?: string; size?: string; md5Checksum?: string }> };
  if (!response.ok) throw new Error("DRIVE_PRE_RESEARCH_SCAN_FAILED");
  return { folderId: preResearchFolder.id, files: data.files || [] };
}
