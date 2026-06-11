/**
 * Input sanitization — strips dangerous characters before saving to DB or rendering.
 * Prevents XSS, script injection, and SQL injection attempts.
 */

// Strip HTML tags and dangerous characters from user input
export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")               // strip HTML tags
    .replace(/javascript:/gi, "")          // strip JS protocol
    .replace(/on\w+\s*=/gi, "")            // strip event handlers
    .replace(/[<>]/g, "")                  // strip angle brackets
    .trim()
    .slice(0, 10000);                       // max length guard
}

// Sanitize an object's string values recursively
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") result[key] = sanitizeText(value);
    else if (typeof value === "object" && value !== null && !Array.isArray(value)) result[key] = sanitizeObject(value);
    else result[key] = value;
  }
  return result as T;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Validate UUID format
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Check if a string looks like a SQL injection attempt
export function looksLikeSQLInjection(input: string): boolean {
  const patterns = [/(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bEXEC\b)/i, /('|--|;|\*|\/\*|\*\/)/];
  return patterns.some(p => p.test(input));
}

// Safe JSON parse — never throws
export function safeJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T; }
  catch { return fallback; }
}
