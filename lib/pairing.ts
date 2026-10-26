import fs from "node:fs";
import path from "node:path";

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

// Pairing tokens live for five minutes, so memory is enough.
const tokens = new Map<string, PairingToken>();

// Paired devices outlive a restart: a phone that scanned yesterday should still
// appear in the caregiver's list (and a removed one should stay removed).
const sessions = new Map<string, ElderSession>();
const revoked = new Set<string>();

const STORE = path.join(process.cwd(), "data", "elder-sessions.json");

type Stored = { sessions: ElderSession[]; revoked: string[] };

let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = JSON.parse(fs.readFileSync(STORE, "utf8")) as Partial<Stored>;
    for (const session of raw.sessions ?? []) {
      if (session?.sid) sessions.set(session.sid, session);
    }
    for (const sid of raw.revoked ?? []) revoked.add(sid);
  } catch {
    // First run or an unreadable file: start empty rather than crash.
  }
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    const payload: Stored = { sessions: [...sessions.values()], revoked: [...revoked] };
    fs.writeFileSync(STORE, JSON.stringify(payload, null, 2));
  } catch {
    // Losing the device list is better than failing the pairing flow.
  }
}

/** Create a single-use pairing token valid for 5 minutes. */
export function createPairingToken(elderId: string): string {
  const token = crypto.randomUUID();
  tokens.set(token, {
    token,
    elderId,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return token;
}

/** Validate and consume a pairing token. Returns elderId if valid. */
export function consumePairingToken(token: string): string | null {
  const record = tokens.get(token);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    tokens.delete(token);
    return null;
  }
  tokens.delete(token); // single-use
  return record.elderId;
}

/** Create a long-lived elder session (180 days). Returns the session id, which
 *  is also placed in the cookie so revocation can be checked later. */
export function createElderSession(elderId: string, deviceInfo?: string, sid?: string): string {
  hydrate();
  const sessionId = sid ?? crypto.randomUUID();
  sessions.set(sessionId, {
    elderId,
    token: sessionId,
    sid: sessionId,
    createdAt: Date.now(),
    deviceInfo,
  });
  persist();
  return sessionId;
}

/** Remember a device that already holds a valid signed cookie.
 *
 *  This covers phones paired before the session list was persisted, and any
 *  future loss of the store: the cookie is proof the device was paired, so the
 *  caregiver's list heals itself instead of showing nothing.
 *  Revoked sessions are never adopted back. */
export function adoptElderSession(sid: string | undefined, elderId: string, deviceInfo = "Paired via QR"): void {
  if (!sid) return;
  hydrate();
  if (sessions.has(sid) || revoked.has(sid)) return;
  sessions.set(sid, { elderId, token: sid, sid, createdAt: Date.now(), deviceInfo });
  persist();
}

/** Verify an elder session token. */
export function verifyElderSession(token: string | undefined): ElderSession | null {
  if (!token) return null;
  hydrate();
  const session = sessions.get(token);
  if (!session) return null;
  // 180 day expiry
  if (Date.now() > session.createdAt + 180 * 24 * 60 * 60 * 1000) {
    sessions.delete(token);
    persist();
    return null;
  }
  return session;
}

/** Revoke an elder session (by session token). The cookie JWT cannot be unsigned,
 *  so the session id joins a deny-list that route handlers check. */
export function revokeElderSession(sessionToken: string): boolean {
  hydrate();
  const session = sessions.get(sessionToken);
  if (!session) return false;
  revoked.add(session.sid);
  sessions.delete(sessionToken);
  persist();
  return true;
}

/** True when this device's session was removed by the caregiver. */
export function isElderSessionRevoked(sid: string | undefined): boolean {
  if (!sid) return false;
  hydrate();
  return revoked.has(sid);
}

/** List all active sessions for an elder. */
export function listElderSessions(elderId: string): ElderSession[] {
  hydrate();
  const result: ElderSession[] = [];
  for (const session of sessions.values()) {
    if (session.elderId === elderId) result.push(session);
  }
  return result;
}
