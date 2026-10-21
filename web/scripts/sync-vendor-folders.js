/**
 * Syncs "who's on the job" per project from the local OneDrive job-site folder
 * structure — one subfolder per vendor under each project's vendor/invoice
 * folder (naming varies per site: "vendors", "Subcontractors", "Invoices",
 * "Signed Vendors", etc., so this matches by keyword, not an exact name).
 *
 * Only handles sites where vendors are organized as subfolders. A few sites
 * (Klein 1852 60th St, Rambam Clinic as of 2026-10-20) just have loose
 * invoice files with no per-vendor folder — those are skipped, not guessed.
 *
 * Run manually or on a nightly Windows Task, same pattern as export-data.js.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { inferTrade } = require("./lib/inferTrade");

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PROJECTS_ROOT = path.join(
  "C:", "Users", "JoelKahan", "OneDrive - Brookstone Developers LLC", "Projects"
);

// OneDrive folder name -> BuildOS project name. Add to this as new sites are set up.
const FOLDER_TO_PROJECT = {
  "123-125 ditmas": "123-125 Ditmas",
  "910 Onderdonk": "910 Onderdonk",
  "1187 Ocean Ave": "1187 Ocean Avenue",
  "185 Concord": "185 Concord",
  "57-23 Myrtle": "57-23 Myrtle Ave",
  "5909 20th Ave": "5909 20th Ave",
  "124 Stuyvesant Ave": "124 Stuyvesant Ave",
  "517 Nostrand": "517 Nostrand Ave",
};

const VENDOR_FOLDER_PATTERN = /vendor|subcontractor|invoice/i;

function latestMtimeRecursive(dir) {
  let latest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, latestMtimeRecursive(full));
    } else {
      const stat = fs.statSync(full);
      latest = Math.max(latest, stat.mtimeMs);
    }
  }
  return latest;
}

(async () => {
  const { data: projects } = await supabase.from("projects").select("id, name");
  const byName = new Map((projects ?? []).map((p) => [p.name, p.id]));

  let totalVendors = 0;
  for (const [folderName, projectName] of Object.entries(FOLDER_TO_PROJECT)) {
    const projectId = byName.get(projectName);
    if (!projectId) { console.log(`SKIP "${folderName}" — no BuildOS project named "${projectName}"`); continue; }

    const projectDir = path.join(PROJECTS_ROOT, folderName);
    if (!fs.existsSync(projectDir)) { console.log(`SKIP "${folderName}" — folder not found on disk`); continue; }

    const vendorFolderName = fs.readdirSync(projectDir, { withFileTypes: true })
      .find((e) => e.isDirectory() && VENDOR_FOLDER_PATTERN.test(e.name))?.name;
    if (!vendorFolderName) { console.log(`SKIP "${folderName}" — no vendor/subcontractor/invoice folder found`); continue; }

    const vendorRoot = path.join(projectDir, vendorFolderName);
    const vendorSubfolders = fs.readdirSync(vendorRoot, { withFileTypes: true }).filter((e) => e.isDirectory());
    if (!vendorSubfolders.length) { console.log(`"${folderName}" → "${vendorFolderName}" has no per-vendor subfolders, skipping`); continue; }

    const rows = vendorSubfolders.map((e) => {
      const full = path.join(vendorRoot, e.name);
      const mtime = latestMtimeRecursive(full);
      return {
        project_id: projectId,
        vendor_name: e.name,
        trade: inferTrade(e.name),
        last_activity_at: mtime ? new Date(mtime).toISOString() : null,
        source_path: full,
        synced_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from("project_vendors").upsert(rows, { onConflict: "project_id,vendor_name" });
    if (error) { console.error(`ERROR upserting vendors for "${projectName}":`, error.message); continue; }
    totalVendors += rows.length;
    console.log(`"${projectName}": ${rows.length} vendor(s) synced from "${vendorFolderName}"`);
  }
  console.log(`Done. ${totalVendors} vendor record(s) synced.`);
})();
