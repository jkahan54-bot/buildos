import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ─── In-middleware rate limiter (edge-compatible, no imports) ───────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// ─── Suspicious patterns ────────────────────────────────────────────────────
const BLOCKED_PATTERNS = [
  /\.\.\//,                         // path traversal
  /<script/i,                       // XSS
  /union.*select/i,                 // SQL injection
  /exec\s*\(/i,                     // code execution
  /eval\s*\(/i,
  /\/etc\/passwd/,                  // Linux file access
  /\/wp-admin/,                     // WordPress scanning
  /\/phpmy/i,                       // phpMyAdmin scanning
  /\.env/,                          // env file probing
  /\.git\//,                        // git exposure
];

export async function middleware(request: NextRequest) {
  const ip       = getIP(request);
  const pathname = request.nextUrl.pathname;
  const ua       = request.headers.get("user-agent") ?? "";

  // ── 1. Block suspicious URL patterns ──────────────────────────────────────
  const fullUrl = pathname + (request.nextUrl.search ?? "");
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(fullUrl)) {
      console.warn(`[security] Blocked suspicious request from ${ip}: ${fullUrl}`);
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // ── 2. Block known bad user agents (scanners, exploit kits) ───────────────
  const BAD_UA = ["sqlmap", "nikto", "nmap", "masscan", "zgrab", "dirbuster", "python-requests/2.2"];
  if (BAD_UA.some(b => ua.toLowerCase().includes(b))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── 3. Rate limiting per endpoint ─────────────────────────────────────────
  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    // Login: 10 attempts per 15 min per IP
    if (!checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
      console.warn(`[security] Rate limit hit on login from ${ip}`);
      return new NextResponse(JSON.stringify({ error: "Too many attempts. Try again in 15 minutes." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "900" },
      });
    }
  } else if (pathname.startsWith("/api/register")) {
    // Registration: 5 per hour per IP
    if (!checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
      return new NextResponse(JSON.stringify({ error: "Too many registration attempts." }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }
  } else if (pathname.startsWith("/api/invite")) {
    // Invitations: 30 per hour per IP
    if (!checkRateLimit(`invite:${ip}`, 30, 60 * 60 * 1000)) {
      return new NextResponse(JSON.stringify({ error: "Too many invite requests." }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }
  } else if (pathname.startsWith("/api/ai/")) {
    // AI endpoints: 20 calls per minute per IP (cost control)
    if (!checkRateLimit(`ai:${ip}`, 20, 60 * 1000)) {
      return new NextResponse(JSON.stringify({ error: "AI rate limit reached. Wait a moment." }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }
  } else if (pathname.startsWith("/api/")) {
    // General API: 200 req/min per IP
    if (!checkRateLimit(`api:${ip}`, 200, 60 * 1000)) {
      return new NextResponse(JSON.stringify({ error: "Too many requests." }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ── 4. Supabase auth session refresh ──────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuth   = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isApi    = pathname.startsWith("/api/");
  const isPublic = pathname === "/" || isAuth || isApi || pathname.startsWith("/invite/");

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isAuth) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── 5. Add security headers to all responses ──────────────────────────────
  supabaseResponse.headers.set("X-Frame-Options", "SAMEORIGIN");
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set("X-XSS-Protection", "1; mode=block");

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
