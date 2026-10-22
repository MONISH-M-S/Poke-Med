// HMAC secret for session cookies. Middleware runs on the edge runtime and cannot
// read files, so the secret has to come from the environment with a demo fallback.
// For a real deployment set AUTH_SECRET to a long random string.
export const AUTH_SECRET = process.env.AUTH_SECRET || "pokemed-demo-secret-change-me";
