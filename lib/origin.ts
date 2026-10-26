/**
 * Work out the origin the browser actually used, so QR links work when a phone
 * opens the app over the LAN instead of localhost.
 *
 * Priority: explicit NEXT_PUBLIC_APP_URL → forwarded/host headers → req.url.
 */
export function requestOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const proto =
      forwardedProto ??
      (host.startsWith("localhost") || host.startsWith("127.") || /^\d+\.\d+\.\d+\.\d+/.test(host)
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }

  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}
