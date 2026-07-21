/**
 * Outbound email via Resend (https://resend.com).
 * Requires RESEND_API_KEY. RESEND_FROM defaults to Resend's shared sending
 * domain until brookstonedevelopers.com is verified in the Resend dashboard.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "BuildOS Reports <onboarding@resend.dev>";

export async function sendReportEmail(opts: { to: string[]; subject: string; html: string; text?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — email not sent");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Resend send failed:", res.status, body);
      return { ok: false, error: `${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("[email] send error:", e.message);
    return { ok: false, error: e.message };
  }
}
