/**
 * Audit Logger — records every important action to the audit_logs table.
 * Every login, invite, role change, approval, file upload, project edit, etc.
 * This is your security paper trail — who did what, when, from where.
 */
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export type AuditAction =
  | "login" | "logout" | "login_failed"
  | "user_invited" | "user_approved" | "user_rejected" | "user_role_changed"
  | "invite_revoked"
  | "project_created" | "project_updated" | "project_deleted"
  | "punch_item_created" | "punch_item_verified" | "punch_item_deleted"
  | "file_uploaded" | "file_deleted"
  | "budget_updated" | "invoice_created" | "invoice_paid"
  | "safety_incident_reported"
  | "api_key_accessed"
  | "settings_changed"
  | "rate_limit_hit"
  | "suspicious_activity";

export interface AuditEntry {
  action: AuditAction;
  userId?: string;
  orgId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity?: "info" | "warning" | "critical";
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await admin.from("audit_logs").insert({
      action:        entry.action,
      user_id:       entry.userId      ?? null,
      org_id:        entry.orgId       ?? null,
      resource_type: entry.resourceType ?? null,
      resource_id:   entry.resourceId  ?? null,
      details:       entry.details     ?? {},
      ip_address:    entry.ipAddress   ?? null,
      user_agent:    entry.userAgent   ?? null,
      severity:      entry.severity    ?? "info",
      created_at:    new Date().toISOString(),
    });
  } catch {
    // Never throw — audit logging must not break app flow
    console.error("[audit] Failed to write audit log:", entry.action);
  }
}

// Helper: extract request metadata
export function getRequestMeta(req: Request): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    userAgent: req.headers.get("user-agent") ?? "unknown",
  };
}
