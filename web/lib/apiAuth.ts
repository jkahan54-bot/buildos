import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

/** Constant-time string compare. Returns false if either side is empty. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * True only if the request carries `Authorization: Bearer <secret>` AND the secret
 * is actually configured. An unset env var can never let a request through
 * (previously "Bearer undefined" or an empty secret could match).
 */
export function bearerOk(req: NextRequest | Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const h = req.headers.get("authorization") ?? "";
  return safeEqual(h, `Bearer ${secret}`);
}

/**
 * True only if the shared webhook key is configured AND matches.
 * Header is preferred. `allowQuery` keeps ?key= working for callers that cannot set
 * headers (IFTTT-style); secrets in URLs can leak into logs, so use sparingly.
 */
export function webhookKeyOk(req: NextRequest | Request, allowQuery = false): boolean {
  const secret = process.env.BUILDOS_WEBHOOK_SECRET;
  const fromHeader = req.headers.get("x-buildos-key");
  if (safeEqual(fromHeader, secret)) return true;
  if (allowQuery) return safeEqual(new URL(req.url).searchParams.get("key"), secret);
  return false;
}

/** Returns the signed-in user, or a 401 response to return immediately. */
export async function requireUser() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  return { user, res: null } as const;
}
