/**
 * Unified API route handler — wraps every route with:
 *  - Structured logging (method, path, IP, timing)
 *  - Consistent error envelope: { ok: true, data } | { ok: false, error }
 *  - Automatic ResponseError -> HTTP status mapping
 *  - Security headers
 */

import { NextRequest, NextResponse } from "next/server";
import { ResponseError, ApiResponse, ok, err } from "./validate";

interface HandlerOptions {
  /** Require authentication (checked by middleware, but we log the role) */
  auth?: boolean;
  /** Custom handler name for logs */
  name?: string;
}

type RouteHandler = (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => Promise<ApiResponse<unknown> | NextResponse>;

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function logRequest(req: NextRequest, handlerName: string, startMs: number, status: number, error?: string) {
  const duration = Date.now() - startMs;
  const ip = getClientIp(req);
  const method = req.method;
  const path = req.nextUrl.pathname;
  const logLine = `[${new Date().toISOString()}] ${method} ${path} ${status} ${duration}ms ip=${ip} handler=${handlerName}${error ? ` err="${error}"` : ""}`;
  // In production you'd pipe this to a log aggregator. For now, stdout.
  console.log(logLine);
}

/**
 * Wrap a route handler with logging, error handling, and security headers.
 * The inner handler should return an ApiResponse or a NextResponse directly.
 */
export function withApiHandler(handler: RouteHandler, options: HandlerOptions = {}) {
  const name = options.name || "unknown";

  return async (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    const startMs = Date.now();

    try {
      const result = await handler(req, ctx);

      // If handler already returned a NextResponse, pass it through
      if (result instanceof NextResponse) {
        addSecurityHeaders(result);
        logRequest(req, name, startMs, result.status);
        return result;
      }

      // Otherwise, it's our ApiResponse envelope
      if (result.ok) {
        const res = NextResponse.json(result.data);
        addSecurityHeaders(res);
        logRequest(req, name, startMs, 200);
        return res;
      } else {
        const res = NextResponse.json({ error: result.error }, { status: 400 });
        addSecurityHeaders(res);
        logRequest(req, name, startMs, 400, result.error);
        return res;
      }
    } catch (e) {
      if (e instanceof ResponseError) {
        const res = NextResponse.json({ error: e.message }, { status: e.status });
        addSecurityHeaders(res);
        logRequest(req, name, startMs, e.status, e.message);
        return res;
      }
      if (e instanceof Error) {
        const res = NextResponse.json({ error: "Internal server error" }, { status: 500 });
        addSecurityHeaders(res);
        logRequest(req, name, startMs, 500, e.message);
        return res;
      }
      const res = NextResponse.json({ error: "Unknown error" }, { status: 500 });
      addSecurityHeaders(res);
      logRequest(req, name, startMs, 500, "unknown");
      return res;
    }
  };
}

/** Add baseline security headers to every response */
function addSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // CSP is intentionally loose for dev; tighten for prod
  res.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'");
}

/** Quick helpers for common responses */
export const ApiResponses = {
  notFound: (msg = "Not found") => NextResponse.json({ error: msg }, { status: 404 }),
  unauthorized: (msg = "Unauthorized") => NextResponse.json({ error: msg }, { status: 401 }),
  forbidden: (msg = "Forbidden") => NextResponse.json({ error: msg }, { status: 403 }),
  badRequest: (msg = "Bad request") => NextResponse.json({ error: msg }, { status: 400 }),
  tooManyRequests: (msg = "Too many requests") => NextResponse.json({ error: msg }, { status: 429 }),
  internal: (msg = "Internal server error") => NextResponse.json({ error: msg }, { status: 500 }),
};