// Poll the live webhook until the group→project fix is deployed, then verify + clean up.
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const URL = "https://buildos-six.vercel.app/api/whatsapp-webhook";
const marker = "__DEPLOYTEST__ need to fix cracked tile in lobby waiting for the plumber";
const payload = { entry: [{ changes: [{ value: {
  metadata: { display_phone_number: "125 Ditmas safety" },
  messages: [{ type: "text", from: "test", text: { body: marker } }],
} }] }] };

(async () => {
  for (let i = 1; i <= 10; i++) {
    await fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
    await new Promise((r) => setTimeout(r, 12000));
    const { data } = await s.from("punch_list_items").select("id,title,blocked_by,projects(name)").ilike("title", "%DEPLOYTEST%").limit(1);
    if (data && data.length) {
      console.log("LIVE after ~" + i * 12 + "s");
      console.log("  Created: " + data[0].title.slice(0, 50) + " | project: " + (data[0].projects?.name) + " | blocker: " + data[0].blocked_by);
      await s.from("punch_list_items").delete().ilike("title", "%DEPLOYTEST%");
      console.log("  (test item cleaned up)");
      process.exit(0);
    }
    console.log("  attempt " + i + ": not live yet…");
  }
  console.log("Timed out.");
  process.exit(1);
})();
