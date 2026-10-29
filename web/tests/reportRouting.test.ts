import test from "node:test";
import assert from "node:assert/strict";
import { routeItem, draftKind, criticalFields, sanitizeItems } from "../lib/reportRouting.ts";

const S = { costAlertAmount: 5000, delayAlertDays: 3 };
const it = (o: any) => ({ id: "i1", kind: "note", text_en: "x", project_id: null, ...o });

test("safety goes to owner immediately", () => {
  assert.deepEqual(routeItem(it({ kind: "injury" }), S), [{ who: "owner", immediate: true }]);
  assert.deepEqual(routeItem(it({ kind: "failed_inspection" }), S), [{ who: "owner", immediate: true }]);
});
test("cost: below threshold not immediate, at/above immediate, unset threshold always immediate", () => {
  assert.equal(routeItem(it({ kind: "cost", amount: 100 }), S)[0].immediate, false);
  assert.equal(routeItem(it({ kind: "cost", amount: 5000 }), S)[0].immediate, true);
  assert.equal(routeItem(it({ kind: "change_order", amount: 1 }), { ...S, costAlertAmount: null })[0].immediate, true);
});
test("delay over 3 days alerts PM", () => {
  assert.deepEqual(routeItem(it({ kind: "delay", days: 4 }), S), [{ who: "pm", immediate: true }]);
  assert.deepEqual(routeItem(it({ kind: "delay", days: 2 }), S), []);
});
test("permits and inspections go to PM, not immediate", () => {
  assert.deepEqual(routeItem(it({ kind: "permit" }), S), [{ who: "pm", immediate: false }]);
});
test("money and schedule are drafts only", () => {
  assert.equal(draftKind(it({ kind: "cost" })), "cost");
  assert.equal(draftKind(it({ kind: "delay" })), "schedule_change");
  assert.equal(draftKind(it({ kind: "progress" })), null);
});
test("amounts, dates, quantities, days must be confirmed", () => {
  assert.deepEqual(criticalFields(it({ amount: 5, date: "2026-11-01", days: 0 })), ["amount", "date", "days"]);
});
test("sanitize: unknown kind -> note, foreign project -> null + needs_person, bad numbers dropped", () => {
  const out = sanitizeItems([{ kind: "hack", text_en: "a", project_id: "evil", amount: -5, days: "9", date: "tomorrow" }], ["p1", "p2"]);
  assert.equal(out[0].kind, "note"); assert.equal(out[0].project_id, null);
  assert.equal(out[0].amount, null); assert.equal(out[0].days, null); assert.equal(out[0].date, null);
  assert.equal(out[0].needs_person, true);
});
test("sanitize: single-project link keeps job without needing a person", () => {
  const out = sanitizeItems([{ kind: "progress", text_en: "framing done", project_id: "p1" }], ["p1"]);
  assert.equal(out[0].project_id, "p1"); assert.equal(out[0].needs_person, false);
});
test("sanitize: non-array input gives empty list", () => { assert.deepEqual(sanitizeItems("nope", []), []); });
