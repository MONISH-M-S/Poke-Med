// HMAC secret for session cookies. Middleware runs on the edge runtime and cannot
// read files, so the secret has to come from the environment. scripts/ensure-secret.mjs
// writes a random one to .env.local on the first `npm run dev`, `build` or `start`,
// and Next loads that file for both the Node runtime and the middleware.
let _authSecret: string | null = null;
let warnedAboutFallback = false;

export function getAuthSecret(): string {
  if (_authSecret) return _authSecret;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // A fallback keeps a bare `next start` (outside the npm scripts) working.
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
          "Session cookies can be forged. Start the app with `npm start` (which generates one in .env.local), " +
          "or set AUTH_SECRET yourself before exposing this app.",
      );
    }
    return _authSecret;
  }
  _authSecret = secret;
  return _authSecret;
}
