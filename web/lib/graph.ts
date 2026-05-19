/**
 * Microsoft Graph API client for SharePoint integration
 * Uses app-only auth (client_credentials grant)
 * Requires: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 */

const TENANT_ID    = process.env.AZURE_TENANT_ID;
const CLIENT_ID    = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

// Brookstone's SharePoint drive ID (discovered from existing files)
export const SHAREPOINT_DRIVE_ID = "b!_aCk4BSzSU2EHWt8MkOGan-0NcuUp6JPiDqZxwzBzun-gEsy-S21QJbS75AhU4Ou";
export const SHAREPOINT_BASE_URL = "https://brookstonedevelopers.sharepoint.com";
export const PROJECTS_FOLDER    = "Shared Documents/Projects";

let _token: string | null = null;
let _tokenExpiry = 0;

export async function getGraphToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry - 60000) return _token;

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Azure credentials not configured. Add AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to environment variables.");
  }

  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         "https://graph.microsoft.com/.default",
    }),
  });

  if (!res.ok) throw new Error(`Token fetch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  _token = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _token!;
}

export async function graphGet(path: string) {
  const token = await getGraphToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Graph API error ${res.status}: ${await res.text()}`);
  return res.json();
}

/** List all files in a SharePoint subfolder (e.g. "Projects/123-125 ditmas") */
export async function listSharePointFolder(folderPath: string) {
  const encodedPath = encodeURIComponent(folderPath);
  const data = await graphGet(
    `/drives/${SHAREPOINT_DRIVE_ID}/root:/${encodedPath}:/children?$top=100&$select=id,name,webUrl,size,lastModifiedDateTime,file,folder`
  );
  return data.value ?? [];
}

/** Search for files in SharePoint by name/content */
export async function searchSharePoint(query: string, folderFilter?: string) {
  const filter = folderFilter
    ? ` AND path:"${SHAREPOINT_BASE_URL}/Shared Documents/Projects/${folderFilter}"`
    : ` AND path:"${SHAREPOINT_BASE_URL}/Shared Documents/Projects"`;
  const data = await graphGet(
    `/drives/${SHAREPOINT_DRIVE_ID}/root/search(q='${encodeURIComponent(query + filter)}')?$top=50&$select=id,name,webUrl,size,lastModifiedDateTime,file`
  );
  return data.value ?? [];
}
