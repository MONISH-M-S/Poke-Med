import fs from "node:fs";
import path from "node:path";
import { blobEnabled, blobRead, blobWrite } from "./blob";

interface PairingToken {
  token: string;
  elderId: string;
  expiresAt: number; // epoch ms
}

interface ElderSession {
  elderId: string;
  token: string;
  sid: string;
  createdAt: number;
  deviceInfo?: string;
}

/**
 * Pairing tokens, paired devices and revocations share one small document.
 * Locally it is data/elder-sessions.json; on Vercel it is a private blob, so a
 * QR created on one instance can be redeemed on another and a removed device
 * stays removed across every instance.
 */
type Store = {
  tokens: PairingToken[];
  sessions: ElderSession[];
  revoked: string[];
};

const STORE_FILE = path.join(process.cwd(), "data", "elder-sessions.json");
const STORE_KEY = "pokemed/pairing.json";
const useBlob = blobEnabled();

async function load(): Promise<Store> {
  let raw: Partial<Store> | null = null;
  if (useBlob) {
    raw = await blobRead<Partial<Store>>(STORE_KEY);
  } else {
    try {
      // Older builds wrote { sessions, revoked } without tokens; accept both.
      raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) as Partial<Store>;
    } catch {
      raw = null;
    }
  }
  return {
    tokens: raw?.tokens ?? [],
    sessions: raw?.sessions ?? [],
    revoked: raw?.revoked ?? [],
  };
}

async function save(store: Store): Promise<void> {
  if (useBlob) {
    await blobWrite(STORE_KEY, store);
    return;
  }
  try {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch {
    // Losing the device list is better than failing the pairing flow.
  }
}

/** Create a single-use pairing token valid for 5 minutes. */
export async function createPairingToken(elderId: string): Promise<string> {
  const token = crypto.randomUUID();
  const store = await load();
  const nowMs = Date.now();
  store.tokens = store.tokens.filter((t) => t.expiresAt > nowMs);
  store.tokens.push({ token, elderId, expiresAt: nowMs + 5 * 60 * 1000 });
  await save(store);
  return token;
}

/** Validate and consume a pairing token. Returns elderId if valid. */
export async function consumePairingToken(token: string): Promise<string | null> {
  const store = await load();
  const record = store.tokens.find((t) => t.token === token);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    store.tokens = store.tokens.filter((t) => t.token !== token);
    await save(store);
    return null;
  }
  store.tokens = store.tokens.filter((t) => t.token !== token); // single-use
  await save(store);
  return record.elderId;
}

/** Create a long-lived elder session (180 days) and remember the device. */
export async function createElderSession(elderId: string, deviceInfo?: string, sid?: string): Promise<string> {
  const sessionId = sid ?? crypto.randomUUID();
  const store = await load();
  store.sessions = store.sessions.filter((s) => s.sid !== sessionId);
  store.sessions.push({
    elderId,
    token: sessionId,
    sid: sessionId,
    createdAt: Date.now(),
    deviceInfo,
  });
  await save(store);
  return sessionId;
}

/** Remember a device that already holds a valid signed cookie.
 *
 *  Covers phones paired before the session list was persisted, and any future
 *  loss of the store: the cookie is proof the device was paired, so the
 *  caregiver's list heals itself instead of showing nothing.
 *  Revoked sessions are never adopted back. */
export async function adoptElderSession(
  sid: string | undefined,
  elderId: string,
  deviceInfo = "Paired via QR",
): Promise<void> {
  if (!sid) return;
  const store = await load();
  if (store.sessions.some((s) => s.sid === sid) || store.revoked.includes(sid)) return;
  store.sessions.push({ elderId, token: sid, sid, createdAt: Date.now(), deviceInfo });
  await save(store);
}

/** Revoke a device by its session token. The cookie JWT cannot be unsigned, so
 *  the session id joins a deny-list that route handlers check. */
export async function revokeElderSession(sessionToken: string): Promise<boolean> {
  const store = await load();
  const session = store.sessions.find((s) => s.token === sessionToken);
  if (!session) return false;
  if (!store.revoked.includes(session.sid)) store.revoked.push(session.sid);
  store.sessions = store.sessions.filter((s) => s.token !== sessionToken);
  await save(store);
  return true;
}

/** True when this device's session was removed by the caregiver. */
export async function isElderSessionRevoked(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  const store = await load();
  return store.revoked.includes(sid);
}

/** List all active sessions for an elder. */
export async function listElderSessions(elderId: string): Promise<ElderSession[]> {
  const store = await load();
  return store.sessions.filter((s) => s.elderId === elderId);
}
