/**
 * CallMeBot WhatsApp sender
 * Simpler and more reliable than IFTTT for outbound alerts
 * API docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */

export async function sendWhatsApp(message: string): Promise<boolean> {
  const phone  = process.env.CALLMEBOT_PHONE  ?? "18456626789";
  const apiKey = process.env.CALLMEBOT_API_KEY ?? "8598005";

  if (!phone || !apiKey) {
    console.warn("CallMeBot not configured");
    return false;
  }

  try {
    const encoded = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return res.ok;
  } catch (e: any) {
    console.error("CallMeBot error:", e.message);
    return false;
  }
}

// Alert templates
export const alerts = {
  punchItemCreated: (count: number, project: string) =>
    `📋 BuildOS: ${count} punch list item${count > 1 ? "s" : ""} auto-created for ${project} from WhatsApp messages. Review at buildos-six.vercel.app/projects`,

  safetyIncident: (project: string, description: string) =>
    `🚨 SAFETY ALERT — ${project}: ${description.slice(0, 100)}. Review at buildos-six.vercel.app/safety`,

  walkthroughReady: (facility: string) =>
    `🏥 Site walkthrough report ready for ${facility}. Review & create estimate at buildos-six.vercel.app/walkthroughs`,

  milestoneOverdue: (title: string, project: string, daysOverdue: number) =>
    `⚠️ OVERDUE ${daysOverdue}d — ${project}: "${title}". Follow-up needed.`,

  dailySummary: (projects: number, tasks: number, issues: number) =>
    `📊 BuildOS Daily — ${projects} active projects | ${tasks} open tasks | ${issues} open issues`,

  taskCreated: (description: string, project: string) =>
    `✅ Task created for ${project}: "${description.slice(0, 80)}"`,
};
