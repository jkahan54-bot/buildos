/**
 * WhatsApp Business API → BuildOS Webhook
 * Receives messages from Meta WhatsApp Cloud API
 * Creates punch list items automatically from group messages
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { categorizeWaitingOn } from "@/lib/waitingOn";
import { lookupSenderName, enrichTitle } from "@/lib/enrichMessage";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PHONE_ID      = process.env.WHATSAPP_PHONE_ID || "";
const ACCESS_TOKEN  = process.env.WHATSAPP_API_TOKEN || "";
const VERIFY_TOKEN  = process.env.WHATSAPP_VERIFY_TOKEN || "buildos_webhook_verified";
const ORG_ID        = "f18352de-979e-44d8-a874-c70aa8b05347";
const CALLMEBOT_PHONE = "18456626789";
const CALLMEBOT_KEY   = "8598005";

// Project mapping
const PROJECT_MAP: { keywords: string[]; id: string; name: string }[] = [
  { keywords: ["ditmas","125","123"],     id: "8d3354b0-1028-4b5c-9147-79f04f3e9a5c", name: "123-125 Ditmas" },
  { keywords: ["klein","1852","60th"],    id: "6e6be30d-1374-4a3f-989e-8f265b29a308", name: "Klein 1852 60th" },
  { keywords: ["910","onderdonk"],        id: "84ac6d50-0a40-44db-acbe-5975c6a5c877", name: "910 Onderdonk" },
  { keywords: ["rambam"],                 id: "4e67b531-3402-49d3-ae88-cf65f450d649", name: "Rambam Clinic" },
  { keywords: ["chc"],                    id: "1231a2e5-f98c-4601-98ca-1e9eef4f995f", name: "CHC Construction" },
];

const ACTION_WORDS = /\b(fix|check|need|needs|waiting|broken|damaged|issue|problem|repair|replace|finish|missing|wrong|cracked|leaking|not working|install|remove|stuck|blocked|urgent|asap|call|follow up|inspect|review|waiting on|pending|schedule)\b/i;
const DONE_WORDS   = /\b(done|finished|completed|all set|ready|fixed|resolved|good to go|wrapped|complete)\b/i;
const BLOCKER_PATTERN = /(?:waiting\s+for|waiting\s+on|blocked\s+by|pending|need)\s+([^,.!?;]+?)(?:\s+to\s+|$|[,.!?;])/i;

function matchProject(text: string): { id: string; name: string } | null {
  const lower = text.toLowerCase();
  for (const p of PROJECT_MAP) {
    if (p.keywords.some(k => lower.includes(k))) return p;
  }
  return null;
}

function extractBlocker(text: string): string | null {
  const match = text.match(BLOCKER_PATTERN);
  if (match && match[1]) {
    return match[1].trim().slice(0, 100); // max 100 chars
  }
  return null;
}

function priorityFromText(text: string): "high" | "medium" | "low" {
  if (/\b(urgent|asap|emergency|critical|violation|fire|immediately|accident|injury)\b/i.test(text)) return "high";
  if (/\b(soon|this week|important|need to|must|waiting|overdue|pending)\b/i.test(text)) return "medium";
  return "medium";
}

async function sendWhatsAppMessage(toNumber: string, message: string): Promise<void> {
  try {
    await fetch(`https://graph.instagram.com/v18.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toNumber,
        type: "text",
        text: { body: message },
      }),
    });
  } catch (e) {
    console.error("WhatsApp send error:", e);
  }
}

async function sendCallMeBot(message: string): Promise<void> {
  const encoded = encodeURIComponent(message);
  await fetch(`https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE}&text=${encoded}&apikey=${CALLMEBOT_KEY}`, {
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});
}

// ── VERIFICATION (webhook setup) ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return new NextResponse(challenge);
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── MESSAGE HANDLER ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Shared-secret check: only our WhatsApp scanner and email scan may post here.
  // Skipped if BUILDOS_WEBHOOK_SECRET is unset so a missing env var can't break intake.
  const secret = process.env.BUILDOS_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-buildos-key") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();

    // Meta sends changes array
    const changes = body?.entry?.[0]?.changes ?? [];
    for (const change of changes) {
      const value = change.value;
      const messages = value?.messages ?? [];
      const metadata = value?.metadata ?? {};
      const senderPhone = metadata.display_phone_number || "WhatsApp";
      // Source defaults to whatsapp; the email scanner passes value.source = "email"
      const msgSource = value?.source === "email" ? "email" : "whatsapp";
      // Meta sends the sender's profile name in the contacts array
      const metaContacts = value?.contacts ?? [];

      for (const msg of messages) {
        if (msg.type !== "text") continue; // ignore images, files, etc for now

        const rawMessage = msg.text?.body ?? "";
        const fromPhone = msg.from;
        if (!rawMessage) continue;

        const metaProfile = metaContacts.find((c: any) => c.wa_id === fromPhone);
        const senderName = lookupSenderName(fromPhone, metaProfile?.profile?.name);

        const lower = rawMessage.toLowerCase();
        // Match the project from the message text, falling back to the group name
        // (e.g. group "125 Ditmas safety" → Ditmas project) so messages that don't
        // repeat the project name still get filed to the right job.
        const project = matchProject(rawMessage) ?? matchProject(senderPhone);

        // ── EMAIL ITEMS (AI-curated — skip heuristic gates) ──────────
        // Email items arrive pre-filtered by the nightly AI scan, so we
        // don't re-apply the ACTION_WORDS gate or multi-line split.
        // Body format: "<project> — <task>\n---\n<email context summary>"
        if (msgSource === "email") {
          const [taskPart, contextPart] = rawMessage.split("\n---\n");
          const taskTitle = taskPart.trim().slice(0, 200);
          const emailCtx  = (contextPart ?? "").trim().slice(0, 500);
          if (project) {
            const blocker   = extractBlocker(rawMessage);
            const waitingOn = blocker ? (categorizeWaitingOn(blocker) ?? categorizeWaitingOn(rawMessage) ?? "Other") : null;
            await admin.from("punch_list_items").insert({
              project_id:          project.id,
              org_id:              ORG_ID,
              title:               taskTitle,
              description:         emailCtx || taskTitle,
              source:              "email",
              source_message:      emailCtx || rawMessage.slice(0, 500),
              status:              "pending_review",
              priority:            priorityFromText(rawMessage),
              blocked_by:          blocker,
              blocker_detected_at: blocker ? new Date().toISOString() : null,
              waiting_on:          waitingOn,
            });
          } else {
            await admin.from("system_events").insert({
              org_id:  ORG_ID,
              type:    "email_unmatched",
              status:  "received",
              details: { task: taskTitle, context: emailCtx.slice(0, 200) },
            });
          }
          continue;
        }

        // ── COMPLETION DETECTION ──────────────────────────────────────
        if (DONE_WORDS.test(lower) && !ACTION_WORDS.test(lower)) {
          if (project) {
            const { data: openItems } = await admin
              .from("punch_list_items")
              .select("id, title")
              .eq("project_id", project.id)
              .eq("status", "open");

            let matched = 0;
            for (const item of (openItems ?? [])) {
              const msgWords = lower.split(/\s+/).filter((w: string) => w.length > 3);
              const itemWords: string[] = item.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
              const overlap = msgWords.filter((w: string) => itemWords.some((iw: string) => iw.includes(w) || w.includes(iw)));
              if (overlap.length >= 2) {
                await admin.from("punch_list_items").update({
                  status: "completed",
                  description: `Auto-completed from WhatsApp: "${rawMessage}"`,
                }).eq("id", item.id);
                matched++;
              }
            }

            if (matched > 0) {
              await sendWhatsAppMessage(
                fromPhone,
                `✅ ${matched} item${matched > 1 ? "s" : ""} marked complete on ${project.name}`
              );
              return NextResponse.json({ ok: true, action: "completed", count: matched });
            }
          }
          return NextResponse.json({ ok: true, action: "done_logged" });
        }

        // ── ACTION ITEM DETECTION ─────────────────────────────────────
        // Only create items from messages that look like tasks/issues (action words
        // or a detected blocker) — plain chatter is ignored to keep the review queue clean.
        if (ACTION_WORDS.test(rawMessage) || extractBlocker(rawMessage)) {
          const priority = priorityFromText(rawMessage);
          // Only split into multiple items when individual lines are each independently
          // actionable (their own action word or blocker) — otherwise a single message
          // like "Delivery / Laborers / Sheetrock install / All is scheduled" gets
          // shredded into meaningless one-word fragments instead of staying one update.
          const candidateLines = rawMessage.split(/[,\n;]/).map((l: string) => l.trim()).filter((l: string) => l.length > 5);
          const actionableLines = candidateLines.filter((l: string) => ACTION_WORDS.test(l) || extractBlocker(l));
          // Need at least 2 independently-actionable lines to justify splitting;
          // otherwise fall through to the single-item path below so context isn't lost.
          const lines = candidateLines.length > 1
            ? (actionableLines.length >= 2 ? actionableLines : [])
            : candidateLines;

          let createdCount = 0;
          const blocker = extractBlocker(rawMessage);

          for (const line of lines.slice(0, 10)) {
            const lineProject = matchProject(line) ?? project;
            if (!lineProject) continue;
            const lineBlocker = extractBlocker(line) ?? blocker;
            const lineWaitingOn = lineBlocker
              ? (categorizeWaitingOn(lineBlocker) ?? categorizeWaitingOn(rawMessage) ?? "Other")
              : null;

            const title = await enrichTitle(line, senderName, lineProject.name);
            await admin.from("punch_list_items").insert({
              project_id:     lineProject.id,
              org_id:         ORG_ID,
              title,
              description:    `From ${senderName} via WhatsApp: "${rawMessage.slice(0, 300)}"`,
              source:         msgSource,
              source_message: rawMessage.slice(0, 500),
              status:         "pending_review",
              priority,
              blocked_by:     lineBlocker,
              blocker_detected_at: lineBlocker ? new Date().toISOString() : null,
              waiting_on:     lineWaitingOn,
            });
            createdCount++;
          }

          if (createdCount === 0 && project) {
            const waitingOn = blocker
              ? (categorizeWaitingOn(blocker) ?? categorizeWaitingOn(rawMessage) ?? "Other")
              : null;
            const title = await enrichTitle(rawMessage, senderName, project.name);
            await admin.from("punch_list_items").insert({
              project_id:     project.id,
              org_id:         ORG_ID,
              title,
              description:    `From ${senderName} via WhatsApp: "${rawMessage.slice(0, 300)}"`,
              source:         msgSource,
              source_message: rawMessage.slice(0, 500),
              status:         "pending_review",
              priority,
              blocked_by:     blocker,
              blocker_detected_at: blocker ? new Date().toISOString() : null,
              waiting_on:     waitingOn,
            });
            createdCount = 1;
          }

          if (createdCount > 0) {
            const projName = project?.name ?? "BuildOS";
            await sendWhatsAppMessage(
              fromPhone,
              `📋 ${createdCount} item${createdCount > 1 ? "s" : ""} added to review for ${projName}.\n\nReview: buildos-six.vercel.app/daily-summary`
            );
            return NextResponse.json({ ok: true, action: "items_created", count: createdCount });
          }
        }

        // ── SAFETY EMERGENCY ──────────────────────────────────────────
        if (/\b(accident|injury|injured|hurt|fall|emergency|fire|danger|911)\b/i.test(rawMessage)) {
          await admin.from("safety_incidents").insert({
            type: "WhatsApp Emergency",
            severity: "Critical",
            description: `[${senderName}]: ${rawMessage}`,
            status: "Open",
            org_id: ORG_ID,
            project_id: project?.id ?? null,
            incident_date: new Date().toISOString(),
          });
          await sendWhatsAppMessage(fromPhone, `🚨 SAFETY ALERT logged. Check BuildOS immediately.`);
          await sendCallMeBot(`🚨 WhatsApp safety alert: "${rawMessage.slice(0, 100)}"`);
          return NextResponse.json({ ok: true, action: "safety_incident" });
        }

        // ── Fallback ──────────────────────────────────────────────────
        await admin.from("system_events").insert({
          org_id: ORG_ID,
          type: "whatsapp_message",
          status: "received",
          details: { from: senderName, phone: fromPhone, message: rawMessage.slice(0, 200), project: project?.name ?? null },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[whatsapp-webhook]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
