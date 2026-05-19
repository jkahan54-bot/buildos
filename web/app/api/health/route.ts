import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PAGES = [
  "/dashboard","/projects","/budget","/team","/safety",
  "/rfis","/documents","/milestones","/ai-tools","/messages",
  "/subcontractors","/daily-log","/photos","/checklist",
  "/timelog","/settings","/system",
];

const TABLES = [
  "organizations","profiles","projects","budget_items","invoices",
  "team_members","time_logs","daily_logs","safety_incidents","rfis",
  "documents","site_photos","message_channels","messages","milestones",
  "subcontractors","ai_reviews","medical_checklists","medical_checklist_items","invitations",
];

async function check(fn: () => Promise<any>, timeout = 8000) {
  const start = Date.now();
  try {
    const result = await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), timeout))]);
    return { ok: true, ms: Date.now() - start, result };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - start, error: e.message };
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";
  const out: any = { timestamp: new Date().toISOString() };

  // ── ENV VARS ─────────────────────────────────────────────────────────────
  const required = ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","ANTHROPIC_API_KEY","NEXT_PUBLIC_APP_URL"];
  out.env = {};
  for (const k of required) {
    const val = process.env[k];
    out.env[k] = { ok: !!val && val.length > 10, set: !!val };
  }
  out.env["OPENAI_API_KEY"] = { ok: !!process.env.OPENAI_API_KEY, set: !!process.env.OPENAI_API_KEY, optional: true };

  // ── DATABASE ──────────────────────────────────────────────────────────────
  out.database = {};
  const dbResults = await Promise.allSettled(
    TABLES.map(t => check(() => admin.from(t).select("id").limit(1).then(({ error }) => { if (error) throw new Error(error.message); return true; })))
  );
  TABLES.forEach((t, i) => {
    const r = dbResults[i];
    out.database[t] = r.status === "fulfilled" ? r.value : { ok: false, error: "Failed" };
  });

  // ── AUTH ──────────────────────────────────────────────────────────────────
  out.auth = await check(async () => {
    const { data: { session } } = await admin.auth.admin.listUsers({ perPage: 1 });
    return !!session !== undefined;
  });

  // ── STORAGE ───────────────────────────────────────────────────────────────
  out.storage = await check(async () => {
    const { data, error } = await admin.storage.listBuckets();
    if (error) throw new Error(error.message);
    const buildos = data?.find(b => b.name === "buildos");
    if (!buildos) {
      // Create bucket if missing
      await admin.storage.createBucket("buildos", { public: true });
      return { created: true };
    }
    return { bucket: buildos.name, public: buildos.public };
  });

  // ── ANTHROPIC AI ──────────────────────────────────────────────────────────
  out.anthropic = await check(async () => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 10, messages: [{ role:"user", content:"hi" }] }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? data.error.type);
    if (res.status === 401) throw new Error("Invalid API key");
    if (res.status === 529) throw new Error("Overloaded — try again");
    return { model: data.model, status: res.status };
  }, 12000);

  // ── OPENAI ────────────────────────────────────────────────────────────────
  out.openai = process.env.OPENAI_API_KEY
    ? await check(async () => {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return { status: res.status };
      })
    : { ok: null, error: "Key not configured (optional)" };

  // ── EMAIL ────────────────────────────────────────────────────────────────
  out.email = await check(async () => {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1 });
    return { configured: true, users: data?.users?.length ?? 0 };
  });

  // ── PAGES ─────────────────────────────────────────────────────────────────
  out.pages = {};
  const pageResults = await Promise.allSettled(
    PAGES.map(p => check(() =>
      fetch(`${appUrl}${p}`, { method:"HEAD", redirect:"follow", signal: AbortSignal.timeout(8000) })
        .then(r => { if (r.status >= 500) throw new Error(`HTTP ${r.status}`); return r.status; })
    ))
  );
  PAGES.forEach((p, i) => {
    const r = pageResults[i];
    out.pages[p] = r.status === "fulfilled" ? r.value : { ok: false, error: "Timeout/Error" };
  });

  // ── VERCEL DEPLOYMENT ─────────────────────────────────────────────────────
  const vToken = process.env.VERCEL_TOKEN;
  out.deployment = vToken
    ? await check(async () => {
        const r = await fetch("https://api.vercel.com/v6/deployments?teamId=team_XrTecyakkh1THm1U5Wzkm6SE&projectId=prj_MXA7mypGNqHTvUpTo4xrtJukw2P3&limit=1",
          { headers: { Authorization: `Bearer ${vToken}` } });
        const d = await r.json();
        const dep = d.deployments?.[0];
        if (!dep) throw new Error("No deployments");
        if (dep.state !== "READY") throw new Error(`Deploy state: ${dep.state}`);
        return { state: dep.state, url: dep.url, age: Math.round((Date.now() - dep.createdAt) / 3600000) + "h ago" };
      })
    : { ok: null, error: "VERCEL_TOKEN not set" };

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const pagesFail  = Object.values(out.pages).filter((p: any) => !p.ok).length;
  const tablesFail = Object.values(out.database).filter((t: any) => !t.ok).length;
  const envFail    = Object.values(out.env).filter((e: any) => !e.ok && !e.optional).length;
  const issues: string[] = [];
  if (envFail > 0)   issues.push(`${envFail} env var${envFail>1?"s":""} missing`);
  if (!out.anthropic.ok) issues.push("Anthropic API failing");
  if (tablesFail > 0) issues.push(`${tablesFail} DB table${tablesFail>1?"s":""} failing`);
  if (!out.storage.ok) issues.push("Storage bucket issue");
  if (pagesFail > 0)  issues.push(`${pagesFail} page${pagesFail>1?"s":""} failing`);
  if (out.deployment.ok === false) issues.push("Deployment issue");

  out.summary = {
    healthy: issues.length === 0,
    issues,
    score: Math.round(((PAGES.length - pagesFail) + (TABLES.length - tablesFail)) / (PAGES.length + TABLES.length) * 100),
  };

  return NextResponse.json(out);
}
