import os from "node:os";

/**
 * Work out the origin a phone can actually reach.
 *
 * `localhost` is useless inside a QR code: the phone resolves it to itself.
 * So when the dashboard is opened on the server machine, swap in the LAN
 * address. An explicit NEXT_PUBLIC_APP_URL always wins.
 */

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

/** First real IPv4 address, preferring home/office Wi-Fi over virtual adapters. */
function lanIPv4(): string | null {
  const found: string[] = [];
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      if (address.address.startsWith("169.254.")) continue;
      found.push(address.address);
    }
  }
  const score = (ip: string) =>
    ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
  found.sort((a, b) => score(a) - score(b));
  return found[0] ?? null;
}

function splitHost(hostHeader: string): { hostname: string; port: string } {
  const ipv6 = hostHeader.match(/^(\[[^\]]+\])(?::(\d+))?$/);
  if (ipv6) return { hostname: ipv6[1], port: ipv6[2] ?? "" };
  const index = hostHeader.lastIndexOf(":");
  if (index === -1) return { hostname: hostHeader, port: "" };
  return { hostname: hostHeader.slice(0, index), port: hostHeader.slice(index + 1) };
}

export function requestOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const hostHeader = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (hostHeader) {
    const { hostname, port } = splitHost(hostHeader);
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const proto = forwardedProto ?? (hostname.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ? "http" : "https");
    const suffix = port ? `:${port}` : "";

    if (LOOPBACK.has(hostname.toLowerCase())) {
      const lan = lanIPv4();
      if (lan) return `${proto}://${lan}${suffix}`;
    }
    return `${proto}://${hostname}${suffix}`;
  }

  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}
