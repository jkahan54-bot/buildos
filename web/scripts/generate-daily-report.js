/**
 * BuildOS Daily Report Trigger
 * Runs unattended (Windows Task Scheduler, ~7:45 PM ET) — independent of
 * the Claude app and the Vercel cron, both of which have proven unreliable
 * for this step. Just hits the public generate endpoint with the known
 * webhook token; the server does all the real work (pulls today's
 * WhatsApp + email activity, asks Claude for the narrative, stores it,
 * sends the WhatsApp push).
 */
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = {};
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch (e) {
    console.error("Could not read .env.local:", e.message);
  }
  return env;
}

const env = loadEnv();
const SITE_URL = (env.NEXT_PUBLIC_APP_URL || "https://buildos-six.vercel.app").replace(/\/$/, "");
const REPORT_TOKEN = env.WHATSAPP_VERIFY_TOKEN || "buildos_webhook_verified";

(async () => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  console.log(`[${new Date().toISOString()}] Triggering daily report for ${today}...`);

  try {
    const res = await fetch(`${SITE_URL}/api/daily-report/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: REPORT_TOKEN,
        report_date: today,
        emails_scanned: 0,
        email_context: "Windows Task trigger — email items already posted via the buildos-email-scan routine earlier tonight.",
      }),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    console.log(`HTTP ${res.status}: ${text}`);
    if (!res.ok) process.exit(1);
  } catch (e) {
    console.error("Failed to trigger daily report:", e.message);
    process.exit(1);
  }
})();
