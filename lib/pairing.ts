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

// In-memory stores (demo only — would use Redis/DB in production)
const tokens = new Map<string, PairingToken>();
const sessions = new Map<string, ElderSession>();
// Session ids whose cookie must stop working, even though the JWT is still valid.
const revoked = new Set<string>();

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
  const sessionId = sid ?? crypto.randomUUID();
  sessions.set(sessionId, {
    elderId,
    token: sessionId,
    sid: sessionId,
    createdAt: Date.now(),
    deviceInfo,
  });
  return sessionId;
}

/** Verify an elder session token. */
export function verifyElderSession(token: string | undefined): ElderSession | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  // 180 day expiry
  if (Date.now() > session.createdAt + 180 * 24 * 60 * 60 * 1000) {
    sessions.delete(token);
    return null;
  }
  return session;
}

/** Revoke an elder session (by session token). The cookie JWT cannot be unsigned,
 *  so the session id joins a deny-list that route handlers check. */
export function revokeElderSession(sessionToken: string): boolean {
  const session = sessions.get(sessionToken);
  if (!session) return false;
  revoked.add(session.sid);
  sessions.delete(sessionToken);
  return true;
}

/** True when this device's session was removed by the caregiver. */
export function isElderSessionRevoked(sid: string | undefined): boolean {
  return Boolean(sid && revoked.has(sid));
}

/** List all active sessions for an elder. */
export function listElderSessions(elderId: string): ElderSession[] {
  const result: ElderSession[] = [];
  for (const session of sessions.values()) {
    if (session.elderId === elderId) result.push(session);
  }
  return result;
}