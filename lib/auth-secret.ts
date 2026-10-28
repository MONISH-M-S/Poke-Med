// Session cookies are signed with AUTH_SECRET. scripts/ensure-secret.mjs writes a
// random one to .env.local on the first `npm run dev`/`build`/`start`, and Next
// loads that file for both the Node runtime and the middleware.
//
// There is deliberately no shared fallback: a secret published in the repository
// would let anyone mint a caregiver session. A bare `next start` without a secret
// therefore fails closed instead of running insecurely.
let _authSecret: string | null = null;
let warnedAboutDevFallback = false;

export function getAuthSecret(): string {
  if (_authSecret) return _authSecret;
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) {
    _authSecret = secret;
    return _authSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is required in production. Set it in the environment (npm run build/start generates .env.local locally).",
    );
  }

  // Development only, and only when someone bypassed the npm scripts. This value
  // is public; it must never be used outside localhost.
  _authSecret = "pokemed-development-only-not-a-real-secret";
  if (!warnedAboutDevFallback) {
    warnedAboutDevFallback = true;
    console.warn(
      "[pokemed] AUTH_SECRET is not set — using a development-only secret. " +
        "Start the app with `npm run dev` (which generates one in .env.local) before exposing it.",
    );
  }
  return _authSecret;
}
