/**
 * GET /api/email-scan  — Vercel cron (daily 7 PM ET = 11 PM UTC)
 * POST /api/email-scan — Manual trigger (authenticated owner/admin)
 *
 * Reads today's emails from both Outlook mailboxes via Microsoft Graph API,
 * classifies them with Claude Haiku, posts actionable ones as BuildOS tasks,
 * then triggers the daily report generator.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ORG_ID      = "f18352de-979e-44d8-a874-c70aa8b05347";
const TENANT_ID   = "5ede7597-ede4-49ad-8a62-a5b526b88a30";
const CLIENT_ID   = "209731df-ebc3-474e-9fe7-813dfe029cb8";
const WEBHOOK_URL = "https://buildos-six.vercel.app/api/whatsapp-webhook";
const REPORT_URL  = "https://buildos-six.vercel.app/api/daily-report/generate";

// ── Token management ─────────────────────────────────────────────────────────
// Refresh token is stored in Supabase (so it stays fresh across calls)
// and also falls back to the MICROSOFT_GRAPH_REFRESH_TOKEN env var for first boot.
async function getAccessToken(): Promise<string> {
  // Read stored token from Supabase
  const { data: tokenRow } = await admin
    .from("system_events")
    .select("details")
    .eq("org_id", ORG_ID)
    .eq("type", "oauth_token")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const refreshToken =
    tokenRow?.details?.refresh_token ?? process.env.MICROSOFT_GRAPH_REFRESH_TOKEN;

  if (!refreshToken) throw new Error("No Microsoft Graph refresh token found in Supabase or env");

  const body = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: process.env.MICROSOFT_GRAPH_CLIENT_SECRET!,
    grant_type:    "refresh_token",
    refresh_token: refreshToken,
    scope:
      "https://graph.microsoft.com/Mail.Read " +
      "https://graph.microsoft.com/Mail.ReadShared " +
      "offline_access",
  });

  const resp = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method:  "POST",
      body:    body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal:  AbortSignal.timeout(10000),
    }
  );

  const data = await resp.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  // Persist the new refresh token so the next run uses it
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await admin.from("system_events").insert({
      org_id:  ORG_ID,
      type:    "oauth_token",
      status:  "active",
      details: { refresh_token: data.refresh_token },
    });
  }

  return data.access_token;
}

// ── Email fetching ────────────────────────────────────────────────────────────
async function fetchEmails(accessToken: string, mailbox: string | null): Promise<any[]> {
  const since    = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const userPath = mailbox ? `/users/${encodeURIComponent(mailbox)}` : "/me";
  const url =
    `https://graph.microsoft.com/v1.0${userPath}/messages` +
    `?$filter=receivedDateTime ge ${since}` +
    `&$select=id,subject,from,receivedDateTime,body,internetMessageId` +
    `&$top=30&$orderby=receivedDateTime desc`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal:  AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[email-scan] Graph API error (${mailbox ?? "me"}): ${resp.status} ${err}`);
    return [];
  }

  const data = await resp.json();
  return data.value ?? [];
}

// ── Automated sender/subject filter ──────────────────────────────────────────
const SKIP_RE = [
  /noreply@/i, /no-reply@/i, /donotreply@/i,
  /clickup/i, /buildos daily/i, /microsoft/i, /azure/i, /security.{1,20}alert/i,
  /notifications?@/i, /automated/i,
];

function isAutomated(email: any): boolean {
  const from = email.from?.emailAddress?.address ?? "";
  const subj = email.subject ?? "";
  return SKIP_RE.some(re => re.test(from) || re.test(subj));
}

// ── Claude classification ─────────────────────────────────────────────────────
interface EmailTask {
  project_keyword: string;
  task_title:      string;
  summary:         string;
}

async function classifyWithClaude(emails: any[]): Promise<EmailTask[]> {
  const emailList = emails
    .map((e, i) => {
      // Strip HTML; cap at 600 chars
      const text = (e.body?.content ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600);
      return (
        `EMAIL ${i + 1}:\n` +
        `Subject: ${e.subject}\n` +
        `From: ${e.from?.emailAddress?.name} <${e.from?.emailAddress?.address}>\n` +
        `Body: ${text}`
      );
    })
    .join("\n\n---\n\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You are a construction PM assistant for Brookstone Development. Classify today's emails.

Active projects (use exact keyword below):
- rambam  → Rambam (26010, IAQ, 150-26)
- ditmas  → Ditmas Park (125 Ditmas, 123 Ditmas)
- onderdonk → 910 Onderdonk
- klein   → Klein (1852, 60th St)
- chc     → CHC

Mark ACTIONABLE if someone must: sign/approve something, follow up/respond, schedule/confirm a meeting or inspection, submit/send a document, resolve an issue or dispute, pay/review an invoice, act on a permit or regulation.

SKIP: pure social replies ("thanks!", "sounds good"), spam, automated notifications.`,
      messages: [{
        role:    "user",
        content:
          `Here are today's emails. Return ONLY a JSON array of actionable tasks — no markdown:\n\n` +
          `${emailList}\n\n` +
          `Format:\n` +
          `[\n` +
          `  {\n` +
          `    "project_keyword": "rambam|ditmas|onderdonk|klein|chc",\n` +
          `    "task_title": "Verb phrase — e.g. Sign IAQ report from tenant",\n` +
          `    "summary": "From: sender | Re: subject | 2-3 sentences: what the email says and what action is needed"\n` +
          `  }\n` +
          `]\n\n` +
          `Return [] if nothing is actionable.`,
      }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  const data = await resp.json();
  const text = data.content?.[0]?.text ?? "";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    console.error("[email-scan] Claude returned non-JSON:", text.slice(0, 200));
    return [];
  }
}

// ── Post a single task to the webhook ────────────────────────────────────────
async function postTask(task: EmailTask) {
  await fetch(WEBHOOK_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry: [{
        changes: [{
          value: {
            source:   "email",
            metadata: { display_phone_number: "Email" },
            messages: [{
              type: "text",
              from: "outlook",
              text: {
                body: `${task.project_keyword} — ${task.task_title}\n---\n${task.summary}`,
              },
            }],
          },
        }],
      }],
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(e => console.error("[email-scan] webhook post failed:", e));
}

// ── Main scan logic ───────────────────────────────────────────────────────────
async function runEmailScan() {
  const today = new Date().toISOString().split("T")[0];

  // 1. Refresh access token
  const accessToken = await getAccessToken();

  // 2. Fetch from both mailboxes in parallel
  const [jkahanEmails, infoEmails] = await Promise.all([
    fetchEmails(accessToken, null),                               // jkahan@ (signed-in user)
    fetchEmails(accessToken, "info@brookstonedevelopers.com"),   // shared mailbox
  ]);

  // 3. Dedupe by internetMessageId + filter automated
  const seen = new Set<string>();
  const allEmails: any[] = [];
  for (const email of [...jkahanEmails, ...infoEmails]) {
    const mid = email.internetMessageId ?? email.id;
    if (!seen.has(mid) && !isAutomated(email)) {
      seen.add(mid);
      allEmails.push(email);
    }
  }

  // 4. Classify with Claude (one batch call)
  const tasks: EmailTask[] = allEmails.length > 0 ? await classifyWithClaude(allEmails) : [];

  // 5. Post all tasks to the webhook
  await Promise.all(tasks.map(postTask));

  // 6. Trigger the daily report generator
  const emailContext =
    tasks.length > 0
      ? `${tasks.length} actionable email(s) across: ${[...new Set(tasks.map(t => t.project_keyword))].join(", ")}.`
      : "No actionable emails today.";

  await fetch(REPORT_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token:          "buildos_webhook_verified",
      report_date:    today,
      emails_scanned: jkahanEmails.length + infoEmails.length,
      email_context:  emailContext,
    }),
    signal: AbortSignal.timeout(45000),
  }).catch(e => console.error("[email-scan] report trigger failed:", e));

  return {
    ok:             true,
    date:           today,
    jkahan_fetched: jkahanEmails.length,
    info_fetched:   infoEmails.length,
    unique_non_auto: allEmails.length,
    tasks_created:  tasks.length,
    tasks,
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runEmailScan());
  } catch (e: any) {
    console.error("[email-scan] cron failed:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!["owner", "admin"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  try {
    return NextResponse.json(await runEmailScan());
  } catch (e: any) {
    console.error("[email-scan] manual scan failed:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
