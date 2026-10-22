// Session tokens: HMAC-signed, Web Crypto only, so this module works in both the
// Node runtime (route handlers) and the edge runtime (middleware).
import { AUTH_SECRET } from "./auth-secret";
import type { Role } from "./types";

export interface Session {
  pid: string;
  role: Role;
  name: string;
  exp: number;
}

const encoder = new TextEncoder();

let keyPromise: Promise<CryptoKey> | null = null;

function key(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return keyPromise;
}

function b64url(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function signSession(session: Session): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload));
  return `${payload}.${b64url(new Uint8Array(signature))}`;
}

export async function verifySession(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await key(),
      fromB64url(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;

    const session = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    if (!session.pid || !session.role || !session.exp) return null;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
