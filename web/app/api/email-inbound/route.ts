/**
 * POST /api/email-inbound
 * Called by Power Automate (Microsoft Flow) when a new email arrives
 * in either jkahan@ or info@ mailboxes.
 *
 * Body (from Power Automate HTTP action):
 * {
 *   "token": "buildos_email_inbound",
 *   "subject": "...",
 *   "from_name": "...",
 *   "from_email": "...",
 *   "body": "...",        // plain text body (use Body as plain text in PA)
 *   "received": "...",   // ISO datetime
 *   "mailbox": "jkahan|info"
 * }
 */
import { NextRequest, NextResponse } from "next/server";

const INBOUND_TOKEN = process.env.EMAIL_INBOUND_TOKEN;
const WEBHOOK_URL   = "https://buildos-six.vercel.app/api/whatsapp-webhook";

const SKIP_RE = [
  /noreply@/i, /no-reply@/i, /donotreply@/i,
  /clickup/i, /buildos daily/i, /microsoft/i, /azure/i,
  /notifications?@/i, /automated/i, /mailer-daemon/i,
];

function isAutomated(fromEmail: string, subject: string): boolean {
  return SKIP_RE.some(re => re.test(fromEmail) || re.test(subject));
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!INBOUND_TOKEN || body.token !== INBOUND_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subject = "", from_name = "", from_email = "", body: emailBody = "" } = body;

  // Skip automated emails
  if (isAutomated(from_email, subject)) {
    return NextResponse.json({ ok: true, action: "skipped_automated" });
  }

  // Truncate body to 800 chars for Claude
  const bodyText = emailBody.replace(/\s+/g, " ").trim().slice(0, 800);

  // Ask Claude to classify and format the task
  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `You are a construction PM assistant for Brookstone Development. Classify incoming emails.

Active projects (use the keyword before the parentheses as project_keyword):
- ditmas (125 Ditmas, 123 Ditmas)
- klein (1852, 60th St)
- onderdonk (910 Onderdonk)
- rambam (26010, IAQ)
- chc
- ocean (1187 Ocean Avenue)
- concord (185 Concord)
- myrtle (57-23 Myrtle Ave)
- 5909 (5909 20th Ave)

Mark ACTIONABLE if the email requires: signing/approving, following up/responding, scheduling/confirming, submitting a document, resolving an issue, paying/reviewing an invoice, acting on a permit.
SKIP: "thanks!", "sounds good", spam, automated notifications.

If the email is clearly ACTIONABLE but you cannot tie it to any project above, still mark it actionable and set project_keyword to "unknown" — never drop an actionable email.`,
      messages: [{
        role:    "user",
        content: `Email:
Subject: ${subject}
From: ${from_name} <${from_email}>
Body: ${bodyText}

If ACTIONABLE, return JSON: {"actionable":true,"project_keyword":"ditmas|klein|onderdonk|rambam|chc|ocean|concord|myrtle|5909|unknown","task_title":"<Person/Company> to <specific action> <specific deliverable> for <site/address>","summary":"From: ${from_name} <${from_email}> | Re: ${subject} | What happened, what is needed, who at Brookstone owns it, and any deadline"}
If NOT actionable, return: {"actionable":false}
Return ONLY JSON, no markdown.`,
      }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  const aiData  = await aiResp.json();
  const aiText  = aiData.content?.[0]?.text ?? "";
  let parsed: any = {};
  try { parsed = JSON.parse(aiText.replace(/```json|```/g, "").trim()); } catch {
    return NextResponse.json({ ok: true, action: "ai_parse_failed", raw: aiText.slice(0, 100) });
  }

  if (!parsed.actionable) {
    return NextResponse.json({ ok: true, action: "not_actionable" });
  }

  // An actionable email we couldn't tie to a project must still reach the PM —
  // prefix it so it lands under "⚠️ Unverified Site" for triage rather than vanishing.
  const unmatched = !parsed.project_keyword || parsed.project_keyword === "unknown";
  const taskLine = unmatched
    ? `[VERIFY SITE] ${parsed.task_title}`
    : `${parsed.project_keyword} — ${parsed.task_title}`;

  // Post to the BuildOS webhook as a pending task.
  // The webhook enforces x-buildos-key (403 without it) — omitting it here used to
  // drop every Power Automate email silently, since the failure was only logged.
  let posted = false;
  let postError: string | undefined;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-buildos-key": process.env.BUILDOS_WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify({
        entry: [{
          changes: [{
            value: {
              source:   "email",
              metadata: { display_phone_number: "Email" },
              messages: [{
                type: "text",
                from: "outlook",
                text: { body: `${taskLine}\n---\n${parsed.summary}` },
              }],
            },
          }],
        }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    posted = res.ok;
    if (!res.ok) postError = `${res.status}: ${(await res.text()).slice(0, 200)}`;
  } catch (e: any) {
    postError = e.message;
  }
  if (!posted) console.error("[email-inbound] webhook post failed:", postError);

  return NextResponse.json({
    ok:      posted,
    action:  posted ? "task_created" : "webhook_post_failed",
    project: unmatched ? "unverified" : parsed.project_keyword,
    error:   postError,
  }, { status: posted ? 200 : 502 });
}
