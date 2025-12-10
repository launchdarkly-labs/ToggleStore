import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  apiRateLimiter,
  chatRateLimiter,
  strictRateLimiter,
  pageRateLimiter,
} from "@/lib/rate-limiter";

/**
 * Get client IP address from request
 * Handles various proxy headers
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for real IP (in order of trust)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP if there are multiple (client IP is first)
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Vercel-specific header
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(",")[0].trim();
  }

  // Cloudflare header
  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // Fallback to a default (shouldn't happen in production)
  return "unknown";
}

/**
 * Create a rate limit exceeded response
 */
function rateLimitResponse(resetIn: number): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: "Too Many Requests",
      message: "You have exceeded the rate limit. Please try again later.",
      retryAfter: Math.ceil(resetIn / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(resetIn / 1000)),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * Paths that should be excluded from rate limiting
 */
const EXCLUDED_PATHS = [
  "/_next", // Next.js internal
  "/favicon.ico",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
];

/**
 * Check if path should be excluded from rate limiting
 */
function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATHS.some(
    (excluded) => pathname === excluded || pathname.startsWith(`${excluded}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip rate limiting for excluded paths
  if (isExcludedPath(pathname)) {
    return NextResponse.next();
  }

  // Skip rate limiting for static files
  if (
    pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|otf)$/)
  ) {
    return NextResponse.next();
  }

  const clientIP = getClientIP(request);
  let result;

  // Apply different rate limits based on route type
  if (pathname.startsWith("/api/chat")) {
    // Chat/AI endpoints - stricter limits
    result = chatRateLimiter.check(clientIP);
  } else if (pathname.startsWith("/api/auth")) {
    // Auth endpoints - very strict limits
    result = strictRateLimiter.check(clientIP);
  } else if (pathname.startsWith("/api/")) {
    // General API endpoints
    result = apiRateLimiter.check(clientIP);
  } else {
    // Page requests - more lenient
    result = pageRateLimiter.check(clientIP);
  }

  if (!result.allowed) {
    console.warn(
      `[Rate Limit] Blocked request from ${clientIP} to ${pathname}`
    );
    return rateLimitResponse(result.resetIn);
  }

  // Add rate limit headers to response
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil((Date.now() + result.resetIn) / 1000))
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image).*)",
  ],
};

