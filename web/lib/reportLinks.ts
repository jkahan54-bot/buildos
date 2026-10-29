import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const LINK_TTL_DAYS = 90;

/** 256-bit random token, URL-safe. Only its hash is stored. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function looksLikeToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
}

export type ReportLink = {
  id: string; org_id: string; person_name: string; language: "en" | "es" | "yi" | "mixed";
  project_ids: string[]; expires_at: string; revoked_at: string | null;
};

/** Returns the link only if the token is valid, not revoked and not expired. */
export async function lookupLink(token: unknown): Promise<ReportLink | null> {
  if (!looksLikeToken(token)) return null;
  const { data } = await admin
    .from("report_links")
    .select("id, org_id, person_name, language, project_ids, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data as ReportLink;
}

export async function logUse(linkId: string, action: string, req: Request) {
  const ip = (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300);
  await admin.from("report_link_uses").insert({ link_id: linkId, action, ip, user_agent: ua });
  await admin.from("report_links").update({ last_used_at: new Date().toISOString() }).eq("id", linkId);
}
