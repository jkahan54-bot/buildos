/**
 * Monitor API — runs health check, backs up, auto-fixes, verifies
 * Called by the hourly scheduled agent and the System Health page
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const VERCEL_TOKEN   = process.env.VERCEL_TOKEN;
const VERCEL_TEAM    = "team_XrTecyakkh1THm1U5Wzkm6SE";
const VERCEL_PROJECT = "prj_MXA7mypGNqHTvUpTo4xrtJukw2P3";
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";

const TABLES = [
  "organizations","profiles","projects","budget_items","invoices",
  "team_members","time_logs","daily_logs","safety_incidents","rfis",
  "documents","site_photos","message_channels","messages","milestones",
  "subcontractors","ai_reviews","medical_checklists","medical_checklist_items","invitations",
];

const CRITICAL_PAGES = ["/dashboard","/projects","/safety","/team","/budget","/rfis","/documents"];

async function safeGet(url: string, timeout = 8000) {
  try {
    const r = await fetch(url, { method:"HEAD", redirect:"follow", signal: AbortSignal.timeout(timeout) });
    return { ok: r.status < 500, status: r.status };
  } catch { return { ok: false, status: 0 }; }
}

async function getRowCounts() {
  const counts: Record<string, number> = {};
  await Promise.all(TABLES.map(async t => {
    const { count } = await admin.from(t).select("*", { count:"exact", head:true });
    counts[t] = count ?? 0;
  }));
  return counts;
}

async function createBackup(trigger: string) {
  const res = await fetch(`${APP_URL}/api/backup?trigger=${trigger}`, { method:"POST" });
  return res.json();
}

async function logEvent(type: string, status: string, details: any, fixed = false, backupId?: string) {
  await admin.from("system_events").insert({ type, status, details, fixed, backup_id: backupId ?? null });
}

export async function POST(req: NextRequest) {
  const { source = "api" } = await req.json().catch(() => ({}));
  const report: any = { timestamp: new Date().toISOString(), source, issues: [], fixes: [], backup: null, verified: false };

  // ── STEP 1: Health check ────────────────────────────────────────────────
  const issues: { type: string; detail: string }[] = [];

  // Check critical pages
  const pageResults = await Promise.all(CRITICAL_PAGES.map(p => safeGet(`${APP_URL}${p}`)));
  const failingPages = CRITICAL_PAGES.filter((_, i) => !pageResults[i].ok);
  if (failingPages.length > 0) {
    issues.push({ type:"pages_down", detail:`Failing: ${failingPages.join(", ")}` });
  }

  // Check database
  const rowsBefore = await getRowCounts();
  const failingTables = Object.entries(rowsBefore).filter(([_, v]) => v === undefined || v < 0).map(([k]) => k);
  if (failingTables.length > 0) {
    issues.push({ type:"database_error", detail:`Tables: ${failingTables.join(", ")}` });
  }

  // Check Vercel deployment
  let deploymentBad = false;
  if (VERCEL_TOKEN) {
    try {
      const vRes = await fetch(`https://api.vercel.com/v6/deployments?teamId=${VERCEL_TEAM}&projectId=${VERCEL_PROJECT}&limit=1`,
        { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
      const vData = await vRes.json();
      const latestDeploy = vData.deployments?.[0];
      if (latestDeploy && latestDeploy.state === "ERROR") {
        deploymentBad = true;
        issues.push({ type:"deployment_error", detail:`State: ${latestDeploy.state}` });
      }
    } catch {}
  }

  report.issues = issues;

  // ── STEP 2: If issues found, backup FIRST ───────────────────────────────
  if (issues.length > 0) {
    report.backup = await createBackup("auto-fix");
    await logEvent("backup_created", "complete", { trigger:"auto-fix", row_counts: report.backup.row_counts });
  }

  // ── STEP 3: Auto-fix ────────────────────────────────────────────────────
  for (const issue of issues) {

    if (issue.type === "pages_down" || issue.type === "deployment_error") {
      // Trigger Vercel redeploy
      if (VERCEL_TOKEN) {
        try {
          const redeployRes = await fetch(`https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type":"application/json" },
            body: JSON.stringify({
              name: "buildos",
              project: VERCEL_PROJECT,
              gitSource: { type:"github", repo:"jkahan54-bot/buildos", ref:"main" },
            }),
          });
          const redeployData = await redeployRes.json();
          report.fixes.push({ type: issue.type, action:"triggered_redeploy", url: redeployData.url });
          await logEvent("auto_fix", "redeployed", { issue: issue.type, deploy_url: redeployData.url }, true);
        } catch (e: any) {
          report.fixes.push({ type: issue.type, action:"redeploy_failed", error: e.message });
        }
      }
    }

    if (issue.type === "database_error") {
      // Log — cannot auto-fix DB schema, alert only
      report.fixes.push({ type: issue.type, action:"alerted", note:"Manual intervention needed" });
      await logEvent("auto_fix", "alert_only", { issue: issue.type, tables: failingTables }, false);
    }
  }

  // ── STEP 4: Verify — compare row counts ─────────────────────────────────
  if (issues.length > 0) {
    await new Promise(r => setTimeout(r, 5000)); // wait 5s for redeploy to start
    const rowsAfter = await getRowCounts();

    const lost: Record<string, { before: number; after: number }> = {};
    for (const [table, countBefore] of Object.entries(rowsBefore)) {
      const countAfter = rowsAfter[table] ?? 0;
      if (countAfter < countBefore) {
        lost[table] = { before: countBefore, after: countAfter };
      }
    }

    report.verified = true;
    report.data_integrity = {
      rows_before: Object.values(rowsBefore).reduce((a, b) => a + b, 0),
      rows_after:  Object.values(rowsAfter).reduce((a, b) => a + b, 0),
      data_lost: Object.keys(lost).length > 0,
      lost_tables: lost,
    };

    if (Object.keys(lost).length > 0) {
      await logEvent("data_integrity_warning", "data_lost", { lost }, false, report.backup?.backup_id);
    } else {
      await logEvent("verification", "passed", { total_rows: report.data_integrity.rows_after });
    }
  }

  report.healthy = issues.length === 0;
  return NextResponse.json(report);
}

// GET — fetch recent monitoring events
export async function GET() {
  const [{ data: events }, { data: backups }] = await Promise.all([
    admin.from("system_events").select("*").order("created_at", { ascending:false }).limit(50),
    admin.from("system_backups").select("id, created_at, trigger, row_counts, status").order("created_at", { ascending:false }).limit(10),
  ]);
  return NextResponse.json({ events: events ?? [], backups: backups ?? [] });
}
