import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

const AREA_NAMES: Record<string, string> = {
  ML:  "Main Lobby",
  EXT: "Exterior",
  RRC: "Short Term Resident Room Corridor",
  RR:  "Resident Rooms",
  RB:  "Resident Bathrooms (Jack & Jill)",
  DR:  "Dining Room",
  PTR: "Gym / PT Room",
  VB:  "Visitors Bathroom",
  CR:  "Long Term Corridor",
};

const CATEGORY_NAMES: Record<string, string> = {
  LE:  "Lighting & Electrical",
  FC:  "Floor & Ceiling",
  WL:  "Walls",
  DVW: "Doors, Vents & Windows",
  FN:  "Finishes",
};

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_NAMES));
const VALID_AREAS      = new Set(Object.keys(AREA_NAMES));

function parseCost(val: any): number | null {
  if (val == null || val === "" || String(val).toUpperCase() === "NA" || String(val).toUpperCase() === "N/A") return null;
  const cleaned = String(val).replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();

  const form = await req.formData();
  const file      = form.get("file") as File;
  const projectId = form.get("projectId") as string;

  if (!file || !projectId) return NextResponse.json({ error: "Missing file or projectId" }, { status: 400 });

  // Parse Excel
  const buf  = Buffer.from(await file.arrayBuffer());
  const wb   = XLSX.read(buf, { type: "buffer" });
  const ws   = wb.Sheets["Basic Proposal"];
  if (!ws) return NextResponse.json({ error: "Sheet 'Basic Proposal' not found" }, { status: 400 });

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find header row (row 11 = index 10)
  const dataRows = rows.slice(11); // skip rows 0-10

  // Group items by area code
  const byArea: Record<string, any[]> = {};

  for (const row of dataRows) {
    const catCode  = String(row[0] ?? "").trim().toUpperCase();
    const areaCode = String(row[1] ?? "").trim().toUpperCase();
    const desc     = String(row[2] ?? "").trim();
    const qty      = parseFloat(String(row[3] ?? "0")) || 0;
    const uom      = String(row[4] ?? "").trim();
    const matUnit  = parseCost(row[5]);
    const matTotal = parseCost(row[6]);
    const labUnit  = parseCost(row[7]);
    const labTotal = parseCost(row[8]);
    const comments = String(row[9] ?? "").trim() || null;

    // Only data rows (valid category + valid area + has description)
    if (!VALID_CATEGORIES.has(catCode) || !VALID_AREAS.has(areaCode) || !desc) continue;

    if (!byArea[areaCode]) byArea[areaCode] = [];
    byArea[areaCode].push({
      product_code: `${catCode}-${areaCode}`,
      product_name: desc,
      category: CATEGORY_NAMES[catCode] ?? catCode,
      quantity_needed: Math.round(qty) || 1,
      notes: [
        uom ? `UOM: ${uom}` : null,
        matTotal != null ? `Material: $${matTotal.toLocaleString()}` : null,
        labTotal != null ? `Labor: $${labTotal.toLocaleString()}` : null,
        comments,
      ].filter(Boolean).join(" | ") || null,
    });
  }

  if (Object.keys(byArea).length === 0) {
    return NextResponse.json({ error: "No valid data rows found in Basic Proposal sheet" }, { status: 400 });
  }

  // Delete existing checklists for this project first (fresh import)
  await supabase.from("medical_checklists").delete().eq("project_id", projectId);

  let totalChecklists = 0;
  let totalItems = 0;

  for (const [areaCode, items] of Object.entries(byArea)) {
    // Create checklist for this room
    const { data: checklist, error: clErr } = await supabase
      .from("medical_checklists")
      .insert({
        project_id: projectId,
        org_id: profile?.org_id,
        name: AREA_NAMES[areaCode] ?? areaCode,
        room_type: areaCode,
      })
      .select()
      .single();

    if (clErr || !checklist) continue;
    totalChecklists++;

    // Insert all items for this room
    const itemsToInsert = items.map(item => ({
      ...item,
      checklist_id: checklist.id,
      checked: false,
      modified: false,
      quantity_installed: 0,
    }));

    const { error: itemErr } = await supabase.from("medical_checklist_items").insert(itemsToInsert);
    if (!itemErr) totalItems += items.length;
  }

  return NextResponse.json({
    success: true,
    checklists: totalChecklists,
    items: totalItems,
    rooms: Object.keys(byArea).map(code => AREA_NAMES[code] ?? code),
  });
}
