/**
 * In-process rate limiter — works per Vercel function instance.
 * For critical endpoints (login, invite) we also log to Supabase for cross-instance protection.
 */

interface RateLimitEntry { count: number; resetAt: number }
const store = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;   // time window in ms
  max: number;        // max requests per window
}

export function rateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowMs };
  }

  entry.count++;
  const allowed = entry.count <= config.max;
  return { allowed, remaining: Math.max(0, config.max - entry.count), resetAt: entry.resetAt };
}

// Preset configs
export const LIMITS = {
  login:    { windowMs: 15 * 60 * 1000, max: 10 },   // 10 attempts per 15 min
  invite:   { windowMs: 60 * 60 * 1000, max: 20 },   // 20 invites per hour
  api:      { windowMs: 60 * 1000,      max: 120 },   // 120 req/min general API
  aiTools:  { windowMs: 60 * 1000,      max: 15 },    // 15 AI calls/min (cost control)
  register: { windowMs: 60 * 60 * 1000, max: 5  },    // 5 registrations per hour per IP
};

// Get the real IP from Vercel headers
export function getIP(req: Request): string {
  const headers = req instanceof Request ? req.headers : new Headers();
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// Clean up old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000); // every 5 minutes
