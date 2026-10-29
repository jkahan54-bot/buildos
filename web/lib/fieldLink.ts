import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";

export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export type FieldLink = {
  id: string; org_id: string; person_name: string; language: string;
  project_ids: string[]; notify_emails: string[];
};

/** Resolve a link token to its record, or null if unknown / revoked / expired. */
export async function resolveLink(token: unknown): Promise<FieldLink | null> {
  if (typeof token !== "string" || token.length < 30 || token.length > 100) return null;
  const { data } = await admin.from("field_links").select("*").eq("token_hash", hashToken(token)).maybeSingle();
  if (!data || data.revoked || new Date(data.expires_at).getTime() < Date.now()) return null;
  void admin.from("field_links").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data as FieldLink;
}
