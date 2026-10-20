/**
 * Cross-references known vendor names (from OneDrive, via project_vendors)
 * against recent WhatsApp/email messages already captured in BuildOS, so a
 * vendor who's actively on-site shows up even before any invoice/paperwork
 * creates a OneDrive folder for them.
 *
 * Deliberately conservative: only matches multi-word vendor names, or
 * single-word names of 7+ characters not on the stoplist below. Many of the
 * OneDrive vendor folder names are short/generic ("Q", "ACE", "Set", "Wolf",
 * "Master") and would produce false-positive matches against ordinary chat
 * text — those are skipped rather than guessed at. This is a substring
 * heuristic, not NLP entity extraction, so it will miss a genuinely new
 * vendor name that's never appeared in any OneDrive folder before.
 *
 * Run manually or on the same nightly schedule as sync-vendor-folders.js
 * (run that one first — this one builds on its output).
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STOPLIST = new Set([
  "q", "ace", "set", "hrf", "ugs", "zv", "ssp", "wolf", "master", "mission",
  "contact", "certified", "greater", "steel", "asbestos", "expediting",
  "new folder", "new folder (2)", "new folder (3)", "engineering vendors",
  "s and f", "s&f",
]);

function isSpecificEnough(name) {
  const n = name.trim().toLowerCase();
  if (STOPLIST.has(n)) return false;
  if (n.includes(" ") || n.includes("&")) return true; // multi-word names are specific enough
  return n.length >= 7;
}

const MENTION_LOOKBACK_DAYS = 90;

(async () => {
  const { data: allVendors } = await supabase.from("project_vendors").select("project_id, vendor_name");
  const candidateNames = [...new Set((allVendors ?? []).map((v) => v.vendor_name))].filter(isSpecificEnough);
  console.log(`Matching against ${candidateNames.length} of ${new Set((allVendors ?? []).map(v=>v.vendor_name)).size} known vendor names (rest too generic to match safely).`);

  const { data: projects } = await supabase.from("projects").select("id, name");
  const since = new Date(Date.now() - MENTION_LOOKBACK_DAYS * 86400000).toISOString();

  let totalNew = 0, totalUpdated = 0;
  for (const project of projects ?? []) {
    const { data: items } = await supabase
      .from("punch_list_items")
      .select("title, created_at, source")
      .eq("project_id", project.id)
      .in("source", ["whatsapp", "email"])
      .gte("created_at", since);
    if (!items?.length) continue;

    const { data: existing } = await supabase.from("project_vendors").select("vendor_name, last_activity_at").eq("project_id", project.id);
    const existingMap = new Map((existing ?? []).map((e) => [e.vendor_name.toLowerCase(), e]));

    for (const name of candidateNames) {
      const needle = name.toLowerCase();
      let lastMention = null;
      for (const item of items) {
        if (item.title?.toLowerCase().includes(needle)) {
          if (!lastMention || new Date(item.created_at) > new Date(lastMention)) lastMention = item.created_at;
        }
      }
      if (!lastMention) continue;

      const existingRow = existingMap.get(needle);
      const alreadyHasFolder = !!existingRow;
      const newer = !existingRow?.last_activity_at || new Date(lastMention) > new Date(existingRow.last_activity_at);

      const { error } = await supabase.from("project_vendors").upsert({
        project_id: project.id,
        vendor_name: name,
        last_activity_at: newer ? lastMention : existingRow.last_activity_at,
        source_path: alreadyHasFolder
          ? (existingRow.source_path?.includes("mentioned in") ? existingRow.source_path : `${existingRow.source_path ?? ""} (also mentioned in WhatsApp/email)`)
          : "mentioned in WhatsApp/email — no OneDrive folder yet",
        synced_at: new Date().toISOString(),
      }, { onConflict: "project_id,vendor_name" });

      if (error) { console.error(`ERROR for "${name}" on "${project.name}":`, error.message); continue; }
      if (alreadyHasFolder) totalUpdated++; else { totalNew++; console.log(`NEW (no OneDrive folder): "${name}" mentioned on "${project.name}" project — last ${lastMention}`); }
    }
  }
  console.log(`Done. ${totalNew} vendor(s) found only via WhatsApp/email, ${totalUpdated} existing vendor(s) got a freshness update.`);
})();
