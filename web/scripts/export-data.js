/**
 * BuildOS data export → OneDrive
 * Dumps every BuildOS table to a timestamped JSON file in the business OneDrive,
 * so all data is backed up off Supabase. Runs unattended (scheduled nightly).
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OUT_DIR = path.join("C:", "Users", "JoelKahan", "OneDrive - Brookstone Developers LLC", "BuildOS", "Data Backups");

const TABLES = [
  "organizations", "profiles", "projects", "budget_items", "invoices",
  "team_members", "time_logs", "daily_logs", "safety_incidents", "rfis",
  "documents", "site_photos", "message_channels", "messages", "milestones",
  "subcontractors", "ai_reviews", "medical_checklists", "medical_checklist_items",
  "punch_list_items", "leads", "lead_notes", "blocker_history", "role_menu_prefs",
];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const started = new Date();
  const backup = { exported_at: started.toISOString(), tables: {} };
  const counts = {};

  for (const t of TABLES) {
    const { data, error } = await s.from(t).select("*");
    if (error) { backup.tables[t] = { error: error.message }; counts[t] = "ERR"; }
    else { backup.tables[t] = data; counts[t] = data.length; }
  }

  const stamp = started.toISOString().slice(0, 10); // YYYY-MM-DD (one file per day, overwrites same-day)
  const file = path.join(OUT_DIR, `BuildOS_Data_${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2), "utf8");

  // Keep a rolling "latest" copy too
  fs.writeFileSync(path.join(OUT_DIR, "BuildOS_Data_LATEST.json"), JSON.stringify(backup, null, 2), "utf8");

  console.log("Exported to: " + file);
  console.log("Row counts: " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", "));
  process.exit(0);
})().catch((e) => { console.error("Export failed:", e.message); process.exit(1); });
