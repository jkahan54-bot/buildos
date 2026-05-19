import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PAGES = [
  "/dashboard", "/projects", "/budget", "/team", "/safety",
  "/rfis", "/documents", "/milestones", "/ai-tools",
  "/messages", "/subcontractors", "/daily-log", "/photos",
  "/checklist", "/timelog", "/settings",
];

const TABLES = [
  "projects", "profiles", "organizations", "safety_incidents",
  "rfis", "milestones", "budget_items", "invoices", "documents",
  "time_logs", "daily_logs", "messages", "invitations",
];

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";
  const results: any = { timestamp: new Date().toISOString(), pages: {}, database: {}, apis: {}, deployment: {} };

  // Check pages
  const pageChecks = await Promise.allSettled(
    PAGES.map(async p => {
      const start = Date.now();
      const res = await fetch(`${appUrl}${p}`, { method:"HEAD", redirect:"follow", signal: AbortSignal.timeout(8000) });
      return { page: p, ok: res.status < 500, status: res.status, ms: Date.now() - start };
    })
  );
  pageChecks.forEach((r, i) => {
    results.pages[PAGES[i]] = r.status === "fulfilled"
      ? { ok: r.value.ok, status: r.value.status, ms: r.value.ms }
      : { ok: false, status: 0, error: "Timeout" };
  });

  // Check database tables
  const dbChecks = await Promise.allSettled(
    TABLES.map(async t => {
      const start = Date.now();
      const { error } = await admin.from(t).select("id").limit(1);
      return { table: t, ok: !error, ms: Date.now() - start, error: error?.message };
    })
  );
  dbChecks.forEach((r, i) => {
    results.database[TABLES[i]] = r.status === "fulfilled"
      ? { ok: r.value.ok, ms: r.value.ms, error: r.value.error }
      : { ok: false, error: "Failed" };
  });

  // Check AI endpoints
  const aiStart = Date.now();
  try {
    const aiRes = await fetch(`${appUrl}/api/ai/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role:"user", content:"ping" }] }),
      signal: AbortSignal.timeout(10000),
    });
    results.apis.ai_chat = { ok: aiRes.status !== 500, status: aiRes.status, ms: Date.now() - aiStart };
  } catch (e: any) {
    results.apis.ai_chat = { ok: false, error: e.message };
  }

  // Check Vercel deployment via API
  try {
    const vRes = await fetch(
      `https://api.vercel.com/v6/deployments?teamId=team_XrTecyakkh1THm1U5Wzkm6SE&projectId=prj_MXA7mypGNqHTvUpTo4xrtJukw2P3&limit=1`,
      { headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN ?? ""}` }, signal: AbortSignal.timeout(5000) }
    );
    const d = await vRes.json();
    const latest = d.deployments?.[0];
    results.deployment = latest
      ? { ok: latest.state === "READY", state: latest.state, url: latest.url, createdAt: latest.createdAt }
      : { ok: false, error: "No deployments found" };
  } catch {
    results.deployment = { ok: null, error: "Vercel API not configured" };
  }

  // Summary
  const pagesFailing   = Object.values(results.pages).filter((p: any) => !p.ok).length;
  const tablesFailing  = Object.values(results.database).filter((t: any) => !t.ok).length;
  results.summary = {
    healthy: pagesFailing === 0 && tablesFailing === 0,
    pagesFailing, tablesFailing,
    totalPages: PAGES.length,
    totalTables: TABLES.length,
  };

  return NextResponse.json(results);
}
