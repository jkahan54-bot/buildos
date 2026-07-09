/**
 * Outbound WhatsApp sender via WhatsApp Business API (929-600-0873)
 * Replaces the old CallMeBot integration.
 */

const PHONE_ID    = process.env.WHATSAPP_PHONE_ID!;   // 1146038215262190
const ACCESS_TOKEN = process.env.WHATSAPP_API_TOKEN!;
// Owner's personal number that receives all BuildOS alerts
const OWNER_PHONE = process.env.OWNER_WHATSAPP_PHONE!;

export async function sendOwnerAlert(message: string): Promise<void> {
  if (!PHONE_ID || !ACCESS_TOKEN || !OWNER_PHONE) {
    console.warn("[whatsapp] Missing env vars — alert not sent");
    return;
  }
  try {
    await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: OWNER_PHONE,
        type: "text",
        text: { body: message },
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e: any) {
    console.error("[whatsapp] send failed:", e.message);
  }
}
