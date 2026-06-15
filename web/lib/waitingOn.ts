/**
 * Shared "ball in court" categories — who currently owns the next action
 * on an RFI, submittal, change order, or punch list item.
 */
export type WaitingOnValue = "Architect" | "Engineer" | "GC" | "Owner" | "Sub/Trade" | "Inspector/DOB" | "Other";

export const WAITING_ON_META: Record<WaitingOnValue, { label: string; color: string; bg: string }> = {
  "Architect":     { label: "Architect",          color: "#7c3aed", bg: "#ede9fe" },
  "Engineer":      { label: "Engineer",           color: "#2563eb", bg: "#dbeafe" },
  "GC":            { label: "General Contractor", color: "#ea580c", bg: "#fff7ed" },
  "Owner":         { label: "Owner",               color: "#92400e", bg: "#fef3c7" },
  "Sub/Trade":     { label: "Subcontractor",       color: "#16a34a", bg: "#dcfce7" },
  "Inspector/DOB": { label: "Inspector / DOB",     color: "#dc2626", bg: "#fee2e2" },
  "Other":         { label: "Other",               color: "#6b7280", bg: "#f3f4f6" },
};

export const WAITING_ON_OPTIONS = Object.keys(WAITING_ON_META) as WaitingOnValue[];

// Ordered keyword map for auto-categorizing free text (e.g. a "waiting for X" blocker
// extracted from a WhatsApp message or email). First match wins.
const KEYWORD_MAP: { pattern: RegExp; value: WaitingOnValue }[] = [
  { pattern: /\b(architect|design team|aor)\b/i,                                          value: "Architect" },
  { pattern: /\b(engineer|structural|mep|eor|s\.?e\.?)\b/i,                               value: "Engineer" },
  { pattern: /\b(dob|d\.o\.b\.|inspector|inspection|department of buildings|violation|permit|cofo|c of o)\b/i, value: "Inspector/DOB" },
  { pattern: /\b(owner|client)\b/i,                                                       value: "Owner" },
  { pattern: /\b(gc|general contractor)\b/i,                                             value: "GC" },
  { pattern: /\b(sub|subcontractor|electrician|electrical|plumber|plumbing|hvac|drywall|framer|framing|mason|masonry|roofer|roofing|painter|painting|concrete|steel)\b/i, value: "Sub/Trade" },
];

/** Categorize free text into a ball-in-court bucket, or null if nothing matches. */
export function categorizeWaitingOn(text: string | null | undefined): WaitingOnValue | null {
  if (!text) return null;
  for (const { pattern, value } of KEYWORD_MAP) {
    if (pattern.test(text)) return value;
  }
  return null;
}
