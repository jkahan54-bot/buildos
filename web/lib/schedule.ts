// Auto-scheduler shared by the Workflow and Timeline views.
// Dates are computed from duration + "blocked by" links, in working days (Mon–Fri).

export type SchedTask = {
  id: string;
  title: string;
  stage?: string | null;
  trade?: string | null;
  assigned_to?: string | null;
  status: string;
  progress?: number | null;
  duration_days: number;
  depends_on: string[];
  start_date: string;
  end_date: string;
  original_start?: string | null;
  original_end?: string | null;
  locked?: boolean | null;
  delay_reason?: string | null;
  sort_order?: number | null;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T12:00:00Z");
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

export function addWorkdays(startISO: string, n: number): string {
  const d = parse(startISO);
  let left = Math.max(0, n);
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (!isWeekend(d)) left--; }
  return iso(d);
}
export function nextWorkday(dateISO: string): string {
  const d = parse(dateISO);
  d.setUTCDate(d.getUTCDate() + 1);
  while (isWeekend(d)) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}
function snapToWorkday(dateISO: string): string {
  const d = parse(dateISO);
  while (isWeekend(d)) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

/**
 * Recompute dates. A task with no dependencies (or locked) keeps its start.
 * A task with dependencies starts the workday after its latest blocker finishes.
 * Returns only the tasks whose dates changed. Cycles are ignored (left as-is).
 */
export function reschedule(tasks: SchedTask[]): { updates: Record<string, { start_date: string; end_date: string }>; all: SchedTask[] } {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]));
  const done = new Set<string>();
  const visiting = new Set<string>();
  const updates: Record<string, { start_date: string; end_date: string }> = {};

  const visit = (id: string) => {
    if (done.has(id) || visiting.has(id)) return;
    visiting.add(id);
    const t = byId.get(id)!;
    const deps = (t.depends_on ?? []).filter((d) => byId.has(d));
    deps.forEach(visit);
    let start = t.start_date;
    if (!t.locked && deps.length) {
      const latest = deps.map((d) => byId.get(d)!.end_date).sort().pop()!;
      start = nextWorkday(latest);
    }
    start = snapToWorkday(start);
    const end = t.status === "complete" && t.end_date ? t.end_date : addWorkdays(start, Math.max(1, t.duration_days) - 1);
    if (start !== t.start_date || end !== t.end_date) updates[id] = { start_date: start, end_date: end };
    t.start_date = start; t.end_date = end;
    visiting.delete(id); done.add(id);
  };
  tasks.forEach((t) => visit(t.id));
  return { updates, all: [...byId.values()] };
}

/** Days a task is later than originally planned (0 if on plan or no baseline). */
export const slipDays = (t: SchedTask) => (t.original_end ? Math.max(0, daysBetween(t.original_end, t.end_date)) : 0);

/** Everything downstream of a task (what a delay to it pushes). */
export function downstream(tasks: SchedTask[], id: string): SchedTask[] {
  const out = new Set<string>();
  const walk = (cur: string) => tasks.forEach((t) => { if ((t.depends_on ?? []).includes(cur) && !out.has(t.id)) { out.add(t.id); walk(t.id); } });
  walk(id);
  return tasks.filter((t) => out.has(t.id));
}

// NYC new-building stage templates: [title, trade, workdays, index of blocker(s)]
export const TEMPLATES: Record<string, { label: string; items: { title: string; trade: string; days: number; after: number[] }[] }> = {
  new_building: {
    label: "New building (NYC)",
    items: [
      { title: "Plans & permit filing (DOB)", trade: "Architect", days: 20, after: [] },
      { title: "DOB approval / permit", trade: "Expediter", days: 30, after: [0] },
      { title: "Mobilize & site safety setup", trade: "GC", days: 5, after: [1] },
      { title: "Demolition", trade: "Demo", days: 10, after: [2] },
      { title: "Excavation & SOE", trade: "Excavation", days: 20, after: [3] },
      { title: "Foundation", trade: "Concrete", days: 25, after: [4] },
      { title: "Structure / framing", trade: "Framing", days: 45, after: [5] },
      { title: "Roofing & windows (dry-in)", trade: "Roofing", days: 15, after: [6] },
      { title: "MEP rough-in", trade: "MEP", days: 25, after: [7] },
      { title: "Inspections – rough", trade: "Inspector", days: 5, after: [8] },
      { title: "Insulation & sheetrock", trade: "Drywall", days: 20, after: [9] },
      { title: "Finishes (tile, floors, paint)", trade: "Finishes", days: 30, after: [10] },
      { title: "Final inspections & TCO", trade: "Inspector", days: 10, after: [11] },
      { title: "Punch list & turnover", trade: "GC", days: 10, after: [12] },
    ],
  },
  renovation: {
    label: "Renovation / interior",
    items: [
      { title: "Scope & permits", trade: "Architect", days: 15, after: [] },
      { title: "Demo & protection", trade: "Demo", days: 7, after: [0] },
      { title: "Framing & rough MEP", trade: "MEP", days: 15, after: [1] },
      { title: "Rough inspection", trade: "Inspector", days: 3, after: [2] },
      { title: "Sheetrock & compound", trade: "Drywall", days: 12, after: [3] },
      { title: "Finishes", trade: "Finishes", days: 20, after: [4] },
      { title: "Final inspection & punch", trade: "GC", days: 7, after: [5] },
    ],
  },
};
