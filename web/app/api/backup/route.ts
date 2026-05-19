/**
 * Backup API — exports all table row counts + full data snapshot
 * POST /api/backup?trigger=manual|auto-fix|scheduled
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TABLES = [
  "organizations","profiles","projects","budget_items","invoices",
  "team_members","time_logs","daily_logs","safety_incidents","rfis",
  "documents","site_photos","message_channels","messages","milestones",
  "subcontractors","ai_reviews","medical_checklists","medical_checklist_items","invitations",
];

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trigger = searchParams.get("trigger") ?? "manual";

  try {
    // 1. Count rows in every table
    const rowCounts: Record<string, number> = {};
    await Promise.all(
      TABLES.map(async t => {
        const { count } = await admin.from(t).select("*", { count:"exact", head:true });
        rowCounts[t] = count ?? 0;
      })
    );

    // 2. Export critical data tables (full snapshot)
    const snapshot: Record<string, any[]> = {};
    const criticalTables = ["projects","profiles","organizations","safety_incidents","milestones","budget_items","invoices","rfis","medical_checklists","medical_checklist_items"];
    await Promise.all(
      criticalTables.map(async t => {
        const { data } = await admin.from(t).select("*").order("created_at", { ascending: true });
        snapshot[t] = data ?? [];
      })
    );

    // 3. Store snapshot in Supabase Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename  = `backups/backup-${timestamp}.json`;
    const content   = JSON.stringify({ timestamp, rowCounts, snapshot }, null, 2);

    const { error: uploadErr } = await admin.storage.from("buildos").upload(
      filename, new Blob([content], { type: "application/json" }), { upsert: true }
    );

    const snapshotPath = uploadErr ? null : filename;

    // 4. Record backup in database
    const { data: backup, error: dbErr } = await admin.from("system_backups").insert({
      trigger,
      row_counts: rowCounts,
      snapshot_path: snapshotPath,
      status: uploadErr ? "partial" : "complete",
    }).select().single();

    return NextResponse.json({
      success: true,
      backup_id: backup?.id,
      row_counts: rowCounts,
      total_rows: Object.values(rowCounts).reduce((a, b) => a + b, 0),
      snapshot_saved: !uploadErr,
      timestamp,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — list recent backups
export async function GET() {
  const { data } = await admin.from("system_backups")
    .select("id, created_at, trigger, row_counts, status")
    .order("created_at", { ascending: false })
    .limit(20);
  return NextResponse.json({ backups: data ?? [] });
}
