// Pure routing rules for confirmed report items. No I/O, so it can be unit-tested.

export const ITEM_KINDS = [
  "progress", "solved", "issue", "delay", "cost", "change_order",
  "safety", "inspection", "failed_inspection", "stop_work", "injury", "neighbor_damage",
  "permit", "neighbor_legal", "schedule", "note",
] as const;
export type ItemKind = typeof ITEM_KINDS[number];

export const REASON_CODES = ["access", "inspection", "material", "hidden_condition", "design", "manpower", "our_error", "other"] as const;

export type ReportItem = {
  id: string;
  kind: ItemKind;
  text_en: string;
  text_original?: string;
  project_id: string | null;
  task_hint?: string | null;
  vendor_hint?: string | null;
  amount?: number | null;
  quantity?: string | null;
  days?: number | null;
  date?: string | null;          // YYYY-MM-DD
  reason_code?: typeof REASON_CODES[number] | null;
  needs_person?: boolean;
};

export type RouteSettings = { costAlertAmount: number | null; delayAlertDays: number };
export type Target = { who: "owner" | "office" | "pm"; immediate: boolean };

const OWNER_KINDS: ItemKind[] = ["safety", "failed_inspection", "stop_work", "injury", "neighbor_damage"];
const PM_KINDS: ItemKind[] = ["permit", "neighbor_legal", "inspection"];

export function routeItem(item: ReportItem, s: RouteSettings): Target[] {
  const out: Target[] = [];
  if (OWNER_KINDS.includes(item.kind)) out.push({ who: "owner", immediate: true });
  if (item.kind === "cost" || item.kind === "change_order") {
    // No threshold set yet => every cost alerts immediately (safe default).
    const over = s.costAlertAmount == null || (item.amount ?? 0) >= s.costAlertAmount;
    out.push({ who: "office", immediate: over });
  }
  if (PM_KINDS.includes(item.kind)) out.push({ who: "pm", immediate: false });
  if ((item.kind === "delay" || item.kind === "schedule") && (item.days ?? 0) > s.delayAlertDays) {
    out.push({ who: "pm", immediate: true });
  }
  return out;
}

/** Drafts a person must approve. Voice notes never create approved money or schedule changes. */
export function draftKind(item: ReportItem): "cost" | "change_order" | "schedule_change" | null {
  if (item.kind === "cost") return "cost";
  if (item.kind === "change_order") return "change_order";
  if (item.kind === "delay" || item.kind === "schedule") return "schedule_change";
  return null;
}

/** Fields the manager must confirm one by one (shown large in the UI, enforced by the server). */
export function criticalFields(item: ReportItem): ("amount" | "date" | "quantity" | "days")[] {
  const f: ("amount" | "date" | "quantity" | "days")[] = [];
  if (item.amount != null) f.push("amount");
  if (item.date) f.push("date");
  if (item.quantity) f.push("quantity");
  if (item.days != null) f.push("days");
  return f;
}

/** Clamp and whitelist whatever the AI returned. Anything unrecognised becomes a safe "note". */
export function sanitizeItems(raw: unknown, allowedProjects: string[]): ReportItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).map((r: any, i): ReportItem => {
    const kind: ItemKind = ITEM_KINDS.includes(r?.kind) ? r.kind : "note";
    const pid = typeof r?.project_id === "string" && allowedProjects.includes(r.project_id) ? r.project_id : null;
    const num = (v: any, max: number) => (typeof v === "number" && isFinite(v) && v >= 0 && v <= max ? v : null);
    const date = typeof r?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null;
    const str = (v: any, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n) : "");
    return {
      id: `i${i + 1}`,
      kind,
      text_en: str(r?.text_en, 500) || "(unclear)",
      text_original: str(r?.text_original, 500) || undefined,
      project_id: pid,
      task_hint: str(r?.task_hint, 120) || null,
      vendor_hint: str(r?.vendor_hint, 120) || null,
      amount: num(r?.amount, 100_000_000),
      quantity: str(r?.quantity, 60) || null,
      days: num(r?.days, 3650),
      date,
      reason_code: REASON_CODES.includes(r?.reason_code) ? r.reason_code : null,
      // never guess: no matched project (when the link has several) means a person must look
      needs_person: !!r?.needs_person || (pid === null && allowedProjects.length !== 1),
    };
  });
}
