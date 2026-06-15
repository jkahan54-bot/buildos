/**
 * WhatsApp → BuildOS
 * Receives messages from InOut WhatsApp bot via IFTTT webhook.
 * When you message the InOut bot number from your phone, this fires.
 * Creates pending_review punch list items automatically.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ORG_ID = "f18352de-979e-44d8-a874-c70aa8b05347";

// Hardcoded project map — matches keywords to project UUIDs
const PROJECT_MAP: { keywords: string[]; id: string; name: string }[] = [
  { keywords: ["ditmas","125","123"],     id: "8d3354b0-1028-4b5c-9147-79f04f3e9a5c", name: "123-125 Ditmas" },
  { keywords: ["klein","1852","60th"],    id: "6e6be30d-1374-4a3f-989e-8f265b29a308", name: "Klein 1852 60th" },
  { keywords: ["910","onderdonk"],        id: "84ac6d50-0a40-44db-acbe-5975c6a5c877", name: "910 Onderdonk" },
  { keywords: ["rambam"],                 id: "4e67b531-3402-49d3-ae88-cf65f450d649", name: "Rambam Clinic" },
  { keywords: ["chc"],                    id: "1231a2e5-f98c-4601-98ca-1e9eef4f995f", name: "CHC Construction" },
];

const ACTION_WORDS = /\b(fix|check|need|needs|waiting|broken|damaged|issue|problem|repair|replace|finish|missing|wrong|cracked|leaking|not working|install|remove|stuck|blocked|investigate|inspect|call|contact|follow up|urgent|asap)\b/i;
const DONE_WORDS   = /\b(done|finished|completed|all set|ready|fixed|resolved|good to go|complete|wrapped)\b/i;

function matchProject(text: string): { id: string; name: string } | null {
  const lower = text.toLowerCase();
  for (const p of PROJECT_MAP) {
    if (p.keywords.some(k => lower.includes(k))) return p;
  }
  return null;
}

function priorityFromText(text: string): "high" | "medium" | "low" {
  if (/\b(urgent|asap|emergency|critical|violation|fire|immediately)\b/i.test(text)) return "high";
  if (/\b(soon|this week|important|need to|must)\b/i.test(text)) return "medium";
  return "medium";
}

async function sendCallMeBot(message: string): Promise<void> {
  const phone  = "18456626789";
  const apiKey = "8598005";
  const encoded = encodeURIComponent(message);
  await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`, {
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  try {
    // IFTTT sends the body in various formats — handle both
    let body: any = {};
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      for (const pair of text.split("&")) {
        const [k, v] = pair.split("=");
        body[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
      }
    } else {
      // Try JSON anyway
      try { body = await req.json(); } catch { body = {}; }
    }

    // IFTTT InOut sends: value1=message, value2=sender, value3=timestamp
    // Direct POST sends: { message, from, type, timestamp }
    const rawMessage: string = (body.value1 ?? body.message ?? "").trim();
    const sender: string     = (body.value2 ?? body.from ?? "WhatsApp").trim();

    if (!rawMessage) {
      return NextResponse.json({ ok: false, reason: "empty message" });
    }

    const lower = rawMessage.toLowerCase();
    const project = matchProject(rawMessage);
    const today   = new Date().toISOString().split("T")[0];

    // ── 1. COMPLETION DETECTION ────────────────────────────────────────────
    if (DONE_WORDS.test(lower) && !ACTION_WORDS.test(lower)) {
      // Try to find a matching open punch item
      if (project) {
        const { data: openItems } = await admin
          .from("punch_list_items")
          .select("id, title")
          .eq("project_id", project.id)
          .eq("status", "open");

        let matched = 0;
        for (const item of (openItems ?? [])) {
          // Simple fuzzy match — do any significant words overlap?
          const msgWords  = lower.split(/\s+/).filter((w: string) => w.length > 3);
          const itemWords: string[] = item.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
          const overlap   = msgWords.filter((w: string) => itemWords.some((iw: string) => iw.includes(w) || w.includes(iw)));
          if (overlap.length >= 2) {
            await admin.from("punch_list_items").update({
              status: "completed",
              description: `Auto-completed from WhatsApp message: "${rawMessage}"`,
            }).eq("id", item.id);
            matched++;
          }
        }

        if (matched > 0) {
          await sendCallMeBot(`✅ BuildOS: ${matched} item${matched>1?"s":""} marked complete on ${project.name} from your WhatsApp message.`);
          return NextResponse.json({ ok: true, action: "completed", count: matched });
        }
      }
      // No match found — log it anyway
      await sendCallMeBot(`✅ BuildOS received: "${rawMessage.slice(0,80)}" — logged, but no matching open item found to complete.`);
      return NextResponse.json({ ok: true, action: "done_logged" });
    }

    // ── 2. ACTION ITEM DETECTION ───────────────────────────────────────────
    if (ACTION_WORDS.test(rawMessage) || rawMessage.length > 10) {
      const priority = priorityFromText(rawMessage);

      // If message has multiple lines or multiple issues, split and create separate items
      const lines = rawMessage.split(/[,\n;]/).map(l => l.trim()).filter(l => l.length > 5);

      let createdCount = 0;
      for (const line of lines.slice(0, 10)) { // max 10 items per message
        const lineProject = matchProject(line) ?? project;
        if (!lineProject) continue; // skip if can't match to a project

        await admin.from("punch_list_items").insert({
          project_id:     lineProject.id,
          org_id:         ORG_ID,
          title:          line.slice(0, 200),
          description:    `From WhatsApp: "${rawMessage.slice(0, 300)}"`,
          source:         "whatsapp",
          source_message: rawMessage.slice(0, 500),
          status:         "pending_review",
          priority,
          assigned_to:    sender !== "WhatsApp" ? sender : null,
        });
        createdCount++;
      }

      if (createdCount === 0 && project) {
        // Whole message is one item
        await admin.from("punch_list_items").insert({
          project_id:     project.id,
          org_id:         ORG_ID,
          title:          rawMessage.slice(0, 200),
          description:    `From WhatsApp message`,
          source:         "whatsapp",
          source_message: rawMessage.slice(0, 500),
          status:         "pending_review",
          priority,
          assigned_to:    sender !== "WhatsApp" ? sender : null,
        });
        createdCount = 1;
      }

      if (createdCount > 0) {
        const projName = project?.name ?? "BuildOS";
        await sendCallMeBot(`📋 BuildOS: ${createdCount} item${createdCount>1?"s":""} added to review queue for ${projName}.\nReview: buildos-six.vercel.app/daily-summary`);
        return NextResponse.json({ ok: true, action: "items_created", count: createdCount });
      }
    }

    // ── 3. SAFETY EMERGENCY ────────────────────────────────────────────────
    if (/\b(accident|injury|injured|hurt|fall|emergency|fire|danger|911)\b/i.test(rawMessage)) {
      await admin.from("safety_incidents").insert({
        type: "WhatsApp Emergency Report",
        severity: "Critical",
        description: `[WhatsApp] ${sender}: ${rawMessage}`,
        status: "Open",
        org_id: ORG_ID,
        project_id: project?.id ?? null,
        incident_date: new Date().toISOString(),
      });
      await sendCallMeBot(`🚨 SAFETY ALERT logged in BuildOS: "${rawMessage.slice(0,100)}". Check BuildOS immediately.`);
      return NextResponse.json({ ok: true, action: "safety_incident" });
    }

    // ── 4. Fallback — just log it ──────────────────────────────────────────
    await admin.from("system_events").insert({
      org_id: ORG_ID,
      type: "whatsapp_message",
      status: "received",
      details: { sender, message: rawMessage, matched_project: project?.name ?? null, date: today },
    });
    await sendCallMeBot(`📩 BuildOS received: "${rawMessage.slice(0,80)}${rawMessage.length>80?"…":""}"`);
    return NextResponse.json({ ok: true, action: "logged" });

  } catch (e: any) {
    console.error("[whatsapp-log]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
