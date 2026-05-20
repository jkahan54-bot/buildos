/**
 * WhatsApp Log API
 * Receives messages from IFTTT InOut WhatsApp → BuildOS
 * POST /api/whatsapp-log
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const IFTTT_KEY = process.env.IFTTT_WEBHOOK_KEY ?? "";

// Send a WhatsApp alert back to Joel via IFTTT
export async function sendWhatsApp(message: string) {
  if (!IFTTT_KEY) return;
  await fetch(`https://maker.ifttt.com/trigger/buildos_alert/with/key/${IFTTT_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value1: message }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { type, message, from, timestamp } = await req.json();

    const msg = (message ?? "").toLowerCase().trim();
    const now = new Date().toISOString();

    // Log the incoming WhatsApp message in system_events
    await admin.from("system_events").insert({
      type: "whatsapp_message",
      status: "received",
      details: { from, message, type, timestamp },
    });

    // ── "done" / "site done" / "complete" → mark day complete ────────────
    if (type === "day_complete" || /\b(done|complete|finished|wrapped|site done|all done)\b/.test(msg)) {
      // Find all projects where someone clocked in today but no daily log
      const today = new Date().toISOString().split("T")[0];
      const { data: todayLogs } = await admin
        .from("time_logs")
        .select("project_id, profiles(full_name)")
        .gte("clock_in", today + "T00:00:00Z")
        .is("clock_out", null);

      if (todayLogs?.length) {
        // Clock out any still-active workers
        await admin
          .from("time_logs")
          .update({ clock_out: now })
          .gte("clock_in", today + "T00:00:00Z")
          .is("clock_out", null);

        // Create daily logs for each active project
        const projectIds = [...new Set(todayLogs.map((l: any) => l.project_id))];
        for (const pid of projectIds) {
          const crew = todayLogs.filter((l: any) => l.project_id === pid).length;
          const { data: proj } = await admin.from("projects").select("name, org_id").eq("id", pid).single();
          if (proj) {
            await admin.from("daily_logs").insert({
              project_id: pid,
              org_id: proj.org_id,
              work_done: `[WhatsApp] ${message} — confirmed by field team`,
              crew_count: crew,
              log_date: today,
            });
          }
        }

        await admin.from("system_events").insert({
          type: "whatsapp_day_complete",
          status: "processed",
          details: { projects: projectIds.length, message },
        });

        // Reply via WhatsApp confirming
        await sendWhatsApp(`✅ Day logged for ${projectIds.length} project${projectIds.length > 1 ? "s" : ""}. ${crew} workers clocked out. See BuildOS for details.`);
      } else {
        await sendWhatsApp(`✅ Received. No active clock-ins found for today — daily log not updated.`);
      }
    }

    // ── Safety keywords → create safety alert ────────────────────────────
    else if (/\b(accident|injury|injured|hurt|fall|fell|fire|emergency|help|danger|hazard|unsafe)\b/.test(msg)) {
      // Log as safety incident
      const { data: projects } = await admin.from("projects").select("id, name, org_id").limit(1);
      if (projects?.[0]) {
        await admin.from("safety_incidents").insert({
          type: "WhatsApp Report",
          severity: "High",
          description: `[WhatsApp from ${from}]: ${message}`,
          status: "Open",
          org_id: projects[0].org_id,
          project_id: projects[0].id,
          incident_date: now,
        });
      }
      await sendWhatsApp(`🚨 Safety incident logged in BuildOS. Supervisors notified. Please call 911 if emergency.`);
    }

    // ── RFI keywords → log as note ────────────────────────────────────────
    else if (/\b(question|rfi|clarif|need|waiting|spec|drawing|approval)\b/.test(msg)) {
      await admin.from("system_events").insert({
        type: "whatsapp_rfi_note",
        status: "logged",
        details: { from, message },
      });
      await sendWhatsApp(`📋 Message logged as a note in BuildOS. Create an RFI at buildos-six.vercel.app if needed.`);
    }

    // ── General message → just log it ────────────────────────────────────
    else {
      await sendWhatsApp(`📩 Received: "${message.slice(0, 80)}${message.length > 80 ? "…" : ""}". Logged in BuildOS.`);
    }

    return NextResponse.json({ ok: true, processed: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
