/**
 * Backup punch list data to OneDrive
 * Called daily at 8pm via scheduled routine
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    // Verify this is a scheduled call (should have auth header or be from Vercel cron)
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.includes(process.env.BACKUP_SECRET || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all punch list data
    const { data: items } = await admin
      .from("punch_list_items")
      .select("*")
      .order("created_at", { ascending: false });

    // Fetch blocker history
    const { data: blockers } = await admin
      .from("blocker_history")
      .select("*")
      .order("detected_at", { ascending: false });

    // Create backup file
    const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const backup = {
      timestamp: new Date().toISOString(),
      data: {
        punch_items: items ?? [],
        blocker_history: blockers ?? [],
        summary: {
          total_items: items?.length ?? 0,
          open_items: items?.filter(i => i.status === "open").length ?? 0,
          completed_items: items?.filter(i => i.status === "completed").length ?? 0,
          blocked_items: items?.filter(i => i.blocked_by).length ?? 0,
        }
      }
    };

    // Upload to OneDrive via Microsoft Graph API
    const graphToken = process.env.MICROSOFT_GRAPH_TOKEN;
    if (!graphToken) {
      console.error("MICROSOFT_GRAPH_TOKEN not set");
      return NextResponse.json({ error: "Missing Graph token" }, { status: 400 });
    }

    const fileName = `BuildOS_Backup_${timestamp}.json`;
    const driveId = process.env.ONEDRIVE_DRIVE_ID;
    const folderId = process.env.ONEDRIVE_BACKUP_FOLDER_ID;

    if (!driveId || !folderId) {
      console.error("OneDrive config missing");
      return NextResponse.json({ error: "Missing OneDrive config" }, { status: 400 });
    }

    // Upload file to OneDrive
    const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${fileName}:/content`;
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${graphToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backup),
    });

    if (!uploadRes.ok) {
      const error = await uploadRes.text();
      console.error("OneDrive upload failed:", error);
      return NextResponse.json(
        { error: "Upload failed", details: error },
        { status: uploadRes.status }
      );
    }

    // Clean up old backups (keep last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // This would require listing files and deleting old ones
    // For now, just log that cleanup is needed
    console.log("Backup complete. Manual cleanup of old backups may be needed.");

    return NextResponse.json({
      ok: true,
      message: "Backup uploaded successfully",
      fileName,
      size: JSON.stringify(backup).length,
      summary: backup.data.summary,
    });

  } catch (e: any) {
    console.error("[backup-to-onedrive]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
