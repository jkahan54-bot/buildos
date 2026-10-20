// Poll until webhook email-source support is live; verify an email-shaped post creates a source=email item.
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs"); const path = require("path");
const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const URL = "https://buildos-six.vercel.app/api/whatsapp-webhook";
const marker = "__EMAILTEST__ 125 Ditmas inspection needs to be scheduled waiting for the architect";
const payload = { entry: [{ changes: [{ value: {
  source: "email",
  metadata: { display_phone_number: "Email" },
  messages: [{ type: "text", from: "test@brookstonedevelopers.com", text: { body: marker } }],
} }] }] };
(async () => {
  for (let i = 1; i <= 10; i++) {
    await fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
    await new Promise((r) => setTimeout(r, 12000));
    const { data } = await s.from("punch_list_items").select("id,source,blocked_by,projects(name)").ilike("title", "%EMAILTEST%").limit(1);
    if (data && data.length) {
      console.log("LIVE: source=" + data[0].source + " | project=" + (data[0].projects?.name) + " | blocker=" + data[0].blocked_by);
      await s.from("punch_list_items").delete().ilike("title", "%EMAILTEST%");
      console.log("(cleaned up)");
      process.exit(0);
    }
    console.log("attempt " + i + ": not live yet…");
  }
  process.exit(1);
})();
