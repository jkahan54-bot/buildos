/**
 * Enriches vague WhatsApp messages into clear, actionable task titles.
 * Uses Claude Haiku for short/ambiguous messages; falls back to manual prefix.
 */

// Known team members — phone → name.
// Phones in international format without "+" (e.g. "18456626789").
// Add entries as you learn who texts which groups.
const TEAM_CONTACTS: Record<string, string> = {
  // "18001234567": "Manny Abowitz",
  // "18009876543": "Yakov Frankel",
};

export function lookupSenderName(
  phone: string,
  metaProfileName?: string | null,
): string {
  if (TEAM_CONTACTS[phone]) return TEAM_CONTACTS[phone];
  if (metaProfileName && metaProfileName !== phone) return metaProfileName;
  return phone;
}

function isVague(text: string): boolean {
  if (text.length > 80) return false;
  const specifics =
    /\b(floor|flr|apt|unit|room|roof|cellar|basement|lobby|stair|elevator|shaft|pipe|wire|duct|beam|column|wall|ceiling|window|door|concrete|steel|drywall|plumbing|electric|hvac|sprinkler|inspection|permit|dob|violation|drawing|plan|submittal|rfi|cofo|tco)\b/i;
  return !specifics.test(text);
}

export async function enrichTitle(
  rawMessage: string,
  senderName: string,
  projectName: string | null,
): Promise<string> {
  const prefix = projectName
    ? `${projectName} — ${senderName}: `
    : `${senderName}: `;

  if (!isVague(rawMessage)) {
    return (prefix + rawMessage).slice(0, 200);
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return (prefix + rawMessage).slice(0, 200);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content: `Rewrite this vague WhatsApp message from a construction site into a clear one-line task title a PM can act on.

Sender: ${senderName}
Project: ${projectName ?? "Unknown"}
Message: "${rawMessage}"

Rules:
- Keep the MEANING exactly the same — do NOT invent details
- If it's a question, start with "Confirm" or "Respond to"
- If it's a status update, say what happened
- Under 90 characters
- Return ONLY the rewritten line, nothing else`,
          },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });

    const data = await res.json();
    const enriched = data.content?.[0]?.text?.trim();
    if (enriched && enriched.length > 5) {
      return (prefix + enriched).slice(0, 200);
    }
  } catch {
    // AI unavailable — manual prefix is still better than raw text
  }

  return (prefix + rawMessage).slice(0, 200);
}
