import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { blobEnabled, blobRead, blobWrite } from "./blob";
import { withMutex } from "./mutex";

/**
 * One-time links to a read-only medication report.
 *
 * Only a SHA-256 hash of each token is stored, so a leaked token file cannot be
 * replayed. The raw token exists only in the QR code and the browser URL.
 * Links are deliberately short-lived and are consumed on an explicit POST from
 * the landing page, so a QR scanner's link preview does not burn the link.
 */
export const REPORT_SHARE_TTL_MS = 10 * 60 * 1000;
const RETAIN_USED_MS = 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

interface ReportToken {
  /** SHA-256 hex digest of the bearer token. Never the token itself. */
  hash: string;
  elderId: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
}

type Store = { tokens: ReportToken[] };

const STORE_FILE = path.join(process.cwd(), "data", "report-shares.json");
const STORE_KEY = "pokemed/report-shares.json";
const useBlob = blobEnabled();

async function load(): Promise<Store> {
  let raw: Partial<Store> | null = null;
  if (useBlob) {
    raw = await blobRead<Partial<Store>>(STORE_KEY);
  } else {
    try {
      raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) as Partial<Store>;
    } catch {
      raw = null;
    }
  }
  return { tokens: raw?.tokens ?? [] };
}

async function save(store: Store): Promise<void> {
  if (useBlob) {
    await blobWrite(STORE_KEY, store);
    return;
  }
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function prune(store: Store, nowMs: number): void {
  store.tokens = store.tokens.filter(
    (token) => token.expiresAt > nowMs || (token.usedAt && token.usedAt > nowMs - RETAIN_USED_MS),
  );
}

/** Create a 256-bit bearer token. Returns the raw token exactly once. */
export async function createReportShare(elderId: string): Promise<{ token: string; expiresAt: number }> {
  return withMutex(async () => {
    const nowMs = Date.now();
    const token = randomBytes(32).toString("base64url");
    const store = await load();
    prune(store, nowMs);
    const expiresAt = nowMs + REPORT_SHARE_TTL_MS;
    store.tokens.push({ hash: hashToken(token), elderId, createdAt: nowMs, expiresAt });
    await save(store);
    return { token, expiresAt };
  });
}

/** Check a link without consuming it. Used by the QR landing page. */
export async function peekReportShare(token: string): Promise<boolean> {
  if (!TOKEN_PATTERN.test(token)) return false;
  const store = await load();
  const nowMs = Date.now();
  const record = store.tokens.find((item) => item.hash === hashToken(token));
  return Boolean(record && !record.usedAt && nowMs <= record.expiresAt);
}

/** Atomically consume a link. The second caller always gets null. */
export async function consumeReportShare(token: string): Promise<string | null> {
  return withMutex(async () => {
    if (!TOKEN_PATTERN.test(token)) return null;
    const store = await load();
    const nowMs = Date.now();
    const record = store.tokens.find((item) => item.hash === hashToken(token));
    if (!record || record.usedAt || nowMs > record.expiresAt) return null;
    record.usedAt = nowMs;
    await save(store);
    return record.elderId;
  });
}
