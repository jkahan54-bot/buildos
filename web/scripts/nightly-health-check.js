/**
 * BuildOS Nightly Health Check
 * Runs unattended (e.g. midnight via Windows Task Scheduler).
 * Exercises the live database and website and writes a plain-English report.
 *
 * No UI automation, no permission prompts — pure backend checks.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// ── Load env from .env.local (simple parser, no extra deps) ──────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = {};
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch (e) {
    console.error("Could not read .env.local:", e.message);
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = (env.NEXT_PUBLIC_APP_URL || "https://buildos-six.vercel.app").replace(/\/$/, "");

const report = [];
const log = (line = "") => { report.push(line); console.log(line); };

let pass = 0, warn = 0, fail = 0;
const ok   = (m) => { pass++; log(`  [OK]   ${m}`); };
const flag = (m) => { warn++; log(`  [WARN] ${m}`); };
const bad  = (m) => { fail++; log(`  [FAIL] ${m}`); };

// Tables that should exist and be queryable
const TABLES = [
  "organizations", "profiles", "projects", "budget_items", "invoices",
  "team_members", "time_logs", "daily_logs", "safety_incidents", "rfis",
  "documents", "site_photos", "message_channels", "messages", "milestones",
  "subcontractors", "ai_reviews", "medical_checklists", "medical_checklist_items",
  "punch_list_items", "leads", "lead_notes",
];

async function main() {
  const started = new Date();
  log("=".repeat(64));
  log("  BuildOS NIGHTLY HEALTH CHECK");
  log("  " + started.toLocaleString("en-US"));
  log("=".repeat(64));
  log("");

  // ── 0. Config sanity ──────────────────────────────────────────────────────
  log("CONFIG");
  if (SUPABASE_URL) ok(`Supabase URL: ${SUPABASE_URL}`); else bad("NEXT_PUBLIC_SUPABASE_URL missing in .env.local");
  if (SERVICE_KEY)  ok("Service role key present"); else bad("SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
    if (env[k]) ok(`${k} present`); else flag(`${k} not set (AI features may be limited)`);
  }
  log("");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    log("Cannot continue without Supabase credentials. Stopping.");
    return finish(started);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Table existence + row counts ───────────────────────────────────────
  log("DATABASE TABLES");
  for (const t of TABLES) {
    const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
    if (error) bad(`Table "${t}" — ${error.message}`);
    else ok(`Table "${t}" — ${count} row${count === 1 ? "" : "s"}`);
  }
  log("");

  // ── 2. Write round-trip tests (catches silent schema bugs) ────────────────
  log("WRITE / SAVE TESTS  (insert a test row, then delete it)");

  // Need a real org_id + user_id for FK constraints
  const { data: org }  = await db.from("organizations").select("id").limit(1).single();
  const { data: prof } = await db.from("profiles").select("id").limit(1).single();
  const orgId  = org?.id;
  const userId = prof?.id;

  if (!orgId || !userId) {
    flag("No organization/profile found to anchor write tests — skipping save tests");
  } else {
    await writeTest(db, "leads", {
      org_id: orgId, created_by: userId, contact_name: "HEALTHCHECK_TEST",
      status: "new", project_type: "standard",
    });
    await writeTest(db, "punch_list_items", {
      org_id: orgId, created_by: userId, title: "HEALTHCHECK_TEST",
      status: "pending_review", priority: "medium",
    });
  }
  log("");

  // ── 3. Live website + API endpoints ───────────────────────────────────────
  log("LIVE WEBSITE  (verifying the server is up and not erroring)");
  await httpCheck(`${SITE_URL}`, "Homepage");
  // These are login-protected, so a 404/302/401 just means \"requires login\" — only a 5xx is a real problem
  await httpCheck(`${SITE_URL}/pipeline`, "Pipeline page", true);
  await httpCheck(`${SITE_URL}/punch-list`, "Punch list page", true);
  await httpCheck(`${SITE_URL}/daily-summary`, "Daily review page", true);
  log("");

  finish(started);
}

async function writeTest(db, table, row) {
  // insert
  const ins = await db.from(table).insert(row).select("id").single();
  if (ins.error) {
    bad(`SAVE to "${table}" FAILED — ${ins.error.message}`);
    return;
  }
  const id = ins.data.id;
  // delete the test row so we don't leave junk
  const del = await db.from(table).delete().eq("id", id);
  if (del.error) flag(`Saved to "${table}" OK, but could not clean up test row ${id} — ${del.error.message}`);
  else ok(`Save + delete on "${table}" works`);
}

async function httpCheck(url, label, protectedPage = false) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "manual" });
    clearTimeout(timer);
    const code = res.status;
    if (code >= 500) bad(`${label} — HTTP ${code} (server error)`);
    else if (protectedPage) ok(`${label} — HTTP ${code} (server up; requires login)`);
    else if (code >= 400 && code !== 401 && code !== 403) flag(`${label} — HTTP ${code}`);
    else ok(`${label} — HTTP ${code}`);
  } catch (e) {
    bad(`${label} — unreachable (${e.message})`);
  }
}

function finish(started) {
  const secs = ((Date.now() - started.getTime()) / 1000).toFixed(1);
  log("");
  log("=".repeat(64));
  log(`  SUMMARY:  ${pass} OK   ${warn} warnings   ${fail} failures`);
  log(`  ${fail === 0 ? (warn === 0 ? "✅ Everything checks out." : "⚠ Working, with minor warnings above.") : "❌ Problems found — see [FAIL] lines above."}`);
  log(`  Completed in ${secs}s`);
  log("=".repeat(64));

  // Write report file
  const reportDir = path.join("C:", "Users", "JoelKahan", "BuildOS_Reports");
  try { fs.mkdirSync(reportDir, { recursive: true }); } catch {}
  const stamp = started.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const file = path.join(reportDir, `health_${stamp}.txt`);
  try {
    fs.writeFileSync(file, report.join("\n"), "utf8");
    console.log(`\nReport saved to: ${file}`);
  } catch (e) {
    console.error("Could not write report file:", e.message);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  bad(`Health check crashed: ${e.message}`);
  finish(new Date());
});
