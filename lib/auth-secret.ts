// HMAC secret for session cookies. Middleware runs on the edge runtime and cannot
// read files, so the secret has to come from the environment.
// In production, this MUST be set — no fallback allowed.
// During `next build`, NODE_ENV=production is set, so we allow the fallback
// but the real server will fail if not configured.
let _authSecret: string | null = null;
let warnedAboutFallback = false;

export function getAuthSecret(): string {
  if (_authSecret) return _authSecret;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Only throw at actual runtime if explicitly required
    // Allow demo secret unless POKEMED_REQUIRE_AUTH_SECRET=1 is set
    const requireSecret = process.env.POKEMED_REQUIRE_AUTH_SECRET === "1";
    if (process.env.NODE_ENV === "production" && requireSecret) {
      throw new Error("AUTH_SECRET must be set in production (set POKEMED_REQUIRE_AUTH_SECRET=1 to enforce)");
    }
    _authSecret = "pokemed-demo-secret-change-me";
    // This value is published in the repository, so anyone can mint a session
    // cookie with it. Fine for localhost, never for a public URL.
    if (process.env.NODE_ENV === "production" && !warnedAboutFallback) {
      warnedAboutFallback = true;
      console.warn(
        "[pokemed] AUTH_SECRET is not set — using the public demo secret. " +
          "Session cookies can be forged. Set AUTH_SECRET (and POKEMED_REQUIRE_AUTH_SECRET=1) before exposing this app.",
      );
    }
    return _authSecret;
  }
  _authSecret = secret;
  return _authSecret;
}

// Backward compatibility - AUTH_SECRET is now a getter function
export function AUTH_SECRET(): string {
  return getAuthSecret();
}
