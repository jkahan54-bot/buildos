/**
 * WhatsApp Log API — receives ALL messages from InOut bot
 * Works for both direct messages and group messages
 * POST /api/whatsapp-log?project=PROJECT_ID (for group applets)
 * POST /api/whatsapp-log (for direct messages)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const IFTTT_KEY = process.env.IFTTT_WEBHOOK_KEY ?? "";

export async function sendWhatsApp(message: string, urgent = false) {
  if (!IFTTT_KEY) return;
  const event = urgent ? "buildos_alert" : "buildos_alert";
  await fetch(`https://maker.ifttt.com/trigger/${event}/with/key/${IFTTT_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value1: message }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectIdParam = searchParams.get("project");
    const { type, message, from, timestamp } = await req.json();

    const msg = (message ?? "").toLowerCase().trim();
    const today = new Date().toISOString().split("T")[0];

    // ── If project-specific (group message) → store for daily report ─────
    if (projectIdParam) {
      await admin.from("whatsapp_messages").insert({
        project_id: projectIdParam,
        message_date: today,
        sender: from,
        content: message,
      });

      // Check for keywords that need immediate action
      if (/\b(accident|injury|injured|hurt|fall|emergency|fire|danger)\b/.test(msg)) {
        const { data: proj } = await admin.from("projects").select("name, org_id").eq("id", projectIdParam).single();
        await admin.from("safety_incidents").insert({
          type: "WhatsApp Group Report",
          severity: "High",
          description: `[Group: ${from}]: ${message}`,
          status: "Open",
          org_id: proj?.org_id,
          project_id: projectIdParam,
          incident_date: new Date().toISOString(),
        });
        await sendWhatsApp(`🚨 Safety incident logged! Supervisors notified. Call 911 if emergency.`, true);
      }

      // "report" or "done" → trigger immediate report generation
      if (/\b(report|done|complete|finished|eod|end of day)\b/.test(msg)) {
        await generateDailyReport(projectIdParam, today);
        return NextResponse.json({ ok: true, action: "report_generated" });
      }

      await admin.from("system_events").insert({
        type: "whatsapp_group_message",
        status: "logged",
        details: { project_id: projectIdParam, sender: from, message: message.slice(0, 200) },
      });

      return NextResponse.json({ ok: true, action: "logged" });
    }

    // ── Direct message (no project) ───────────────────────────────────────
    await admin.from("system_events").insert({
      type: "whatsapp_message",
      status: "received",
      details: { from, message, type, timestamp },
    });

    if (/\b(done|complete|finished|wrapped|site done|all done)\b/.test(msg)) {
      const now = new Date().toISOString();
      const { data: todayLogs } = await admin.from("time_logs").select("project_id, profiles(full_name)").gte("clock_in", today + "T00:00:00Z").is("clock_out", null);

      if (todayLogs?.length) {
        await admin.from("time_logs").update({ clock_out: now }).gte("clock_in", today + "T00:00:00Z").is("clock_out", null);
        const projectIds = [...new Set(todayLogs.map((l: any) => l.project_id))];
        for (const pid of projectIds) {
          const crew = todayLogs.filter((l: any) => l.project_id === pid).length;
          const { data: proj } = await admin.from("projects").select("name, org_id").eq("id", pid as string).single();
          if (proj) {
            await admin.from("daily_logs").insert({ project_id: pid, org_id: proj.org_id, work_done: `[WhatsApp] ${message}`, crew_count: crew, log_date: today });
          }
        }
        await sendWhatsApp(`✅ Day logged for ${projectIds.length} project${projectIds.length > 1 ? "s" : ""}. ${todayLogs.length} workers clocked out.`);
      } else {
        await sendWhatsApp(`✅ Received. No active clock-ins found for today.`);
      }
    } else if (/\b(accident|injury|fire|emergency|danger)\b/.test(msg)) {
      await sendWhatsApp(`🚨 Safety incident logged in BuildOS. Call 911 if emergency.`, true);
    } else {
      await sendWhatsApp(`📩 Received: "${message.slice(0, 60)}${message.length > 60 ? "…" : ""}". Logged in BuildOS.`);
    }

    return NextResponse.json({ ok: true, processed: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Generate AI daily report from group messages ──────────────────────────
async function generateDailyReport(projectId: string, date: string) {
  const { data: project } = await admin.from("projects").select("name").eq("id", projectId).single();
  const { data: messages } = await admin.from("whatsapp_messages").select("sender, content, created_at").eq("project_id", projectId).eq("message_date", date).order("created_at");

  if (!messages?.length) {
    await sendWhatsApp(`📋 No messages found for ${project?.name} today. Add progress updates to the group and try again.`);
    return;
  }

  const messageLog = messages.map(m => `[${new Date(m.created_at).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}] ${m.sender}: ${m.content}`).join("\n");

  // Use Claude to generate the report
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system: `You are a construction daily log assistant. Extract structured information from WhatsApp group messages and create a professional daily log report. Return ONLY valid JSON.`,
        messages: [{
          role: "user",
          content: `Project: ${project?.name}\nDate: ${date}\n\nWhatsApp messages from today:\n${messageLog}\n\nExtract and return this JSON:\n{\n  "work_done": "description of all work performed today",\n  "crew_count": number or null,\n  "weather": "weather if mentioned or null",\n  "materials": "materials received if mentioned or null",\n  "equipment": "equipment used if mentioned or null",\n  "issues": "any issues, delays or concerns or null",\n  "summary": "one sentence summary for WhatsApp reply"\n}`
        }]
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "{}";
    const draft = JSON.parse(text.replace(/```json|```/g, "").trim());

    // Save draft to database
    const { data: savedDraft } = await admin.from("daily_log_drafts").insert({
      project_id: projectId,
      log_date: date,
      draft_content: draft,
      status: "pending",
    }).select().single();

    // Send WhatsApp notification to PM
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";
    await sendWhatsApp(
      `📋 *${project?.name} — Daily Report Draft*\n\n${draft.summary}\n\n` +
      `Crew: ${draft.crew_count ?? "?"} · ${draft.weather ?? ""}\n` +
      `Review & confirm at:\n${appUrl}/daily-report/${savedDraft?.id}\n\n` +
      `Reply CONFIRM to approve as-is.`
    );

    await admin.from("system_events").insert({
      type: "daily_report_generated",
      status: "pending_review",
      details: { project_id: projectId, date, draft_id: savedDraft?.id, message_count: messages.length },
    });
  } catch (e: any) {
    await sendWhatsApp(`⚠️ Report generation failed: ${e.message}. Check BuildOS.`);
  }
}
