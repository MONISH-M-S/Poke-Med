import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DB } from "./types";
import { buildSeed } from "./seed";
import { setClockOffset } from "./clock";
import { hashSecret } from "./auth-hash";
import { DEMO_CAREGIVER_PIN } from "./demo-auth";
import { withMutex } from "./mutex";
import { blobEnabled, blobRead, blobWrite } from "./blob";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const DB_KEY = "pokemed/db.json";

const useBlob = blobEnabled();
/** Short cache so one request reading the DB three times costs one fetch. */
const CACHE_MS = 1000;

type Cache = { db: DB | null; at: number };
const g = globalThis as unknown as { __pokemed?: Cache };
const cache: Cache = (g.__pokemed ??= { db: null, at: 0 });

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Databases created before sign-in existed have no PIN hash for the caregiver.
 * Fill it once, and drop any leftover hash on the elder: that door is closed —
 * an elder device is added by scanning a QR code, never by typing a PIN.
 */
function migrateAuth(db: DB): boolean {
  let changed = false;
  for (const person of db.people) {
    if (person.role === "elder") {
      if (person.pinHash) {
        delete person.pinHash;
        changed = true;
      }
      continue;
    }
    if (!person.pinHash) {
      person.pinHash = hashSecret(DEMO_CAREGIVER_PIN);
      changed = true;
    }
  }
  return changed;
}

async function loadFresh(): Promise<DB> {
  if (useBlob) {
    const stored = await blobRead<DB>(DB_KEY);
    if (stored) return stored;
    // A missing blob is a real first run. Anything else throws in blobRead,
    // so a transient failure can never overwrite good data with a fresh seed.
    const seeded = buildSeed();
    await blobWrite(DB_KEY, seeded);
    return seeded;
  }

  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    const seeded = buildSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DB;
}

/** Read the database. Pass `fresh` to bypass the cache (used before a write). */
export async function readDB({ fresh = false }: { fresh?: boolean } = {}): Promise<DB> {
  if (cache.db && !fresh) {
    if (!useBlob) return cache.db;
    if (Date.now() - cache.at < CACHE_MS) return cache.db;
  }

  const db = await loadFresh();
  setClockOffset(db.clockOffsetMinutes ?? 0);

  if (migrateAuth(db)) {
    await writeDBUnlocked(db);
  } else {
    cache.db = db;
    cache.at = Date.now();
  }
  return db;
}

async function writeDBUnlocked(db: DB) {
  if (useBlob) {
    await blobWrite(DB_KEY, db);
  } else {
    ensureDir();
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }
  cache.db = db;
  cache.at = Date.now();
}

/**
 * Mutate the database with a mutex — one caller at a time in this process.
 * The callback receives the live DB object; its mutations are persisted.
 */
export async function mutate<T>(fn: (db: DB) => T): Promise<T> {
  return withMutex(async () => {
    const db = await readDB({ fresh: true });
    const result = fn(db);
    // Every write marks the demo "in use", so sign-in can tell an abandoned
    // session from one someone is still working through.
    db.lastActivityAt = Date.now();
    await writeDBUnlocked(db);
    return result;
  });
}

export async function resetDB(): Promise<DB> {
  const seeded = buildSeed();
  await writeDBUnlocked(seeded);
  setClockOffset(0);
  return seeded;
}

/**
 * Hours after which an untouched demo counts as abandoned. Long enough that
 * signing out and straight back in keeps your work; short enough that the next
 * person to open the app gets the seeded week rather than someone else's.
 */
export const DEMO_ABANDONED_AFTER_MS = 60 * 60_000;

/**
 * Return the database to its seeded state when nobody has touched it for a
 * while. Called on sign-in so a tester always lands on a known week without
 * needing the demo panel.
 *
 * A demo that has been sitting idle is useless as a demo: the seeded week is
 * built relative to "now", so yesterday's data has already drifted and the
 * clock may have been left moved. Re-seeding puts it back.
 *
 * Recent activity is deliberately left alone — wiping a session someone is
 * mid-way through would be worse than the stale state it replaces.
 */
export async function resetIfStale(): Promise<DB> {
  const db = await readDB({ fresh: true });
  // Databases written before `lastActivityAt` existed have no timestamp;
  // treat them as abandoned so they get re-seeded once.
  const last = db.lastActivityAt ?? 0;
  if (Date.now() - last < DEMO_ABANDONED_AFTER_MS) return db;
  return resetDB();
}

/** Collision-resistant, sortable IDs — uses Web Crypto (available in Node 15+). */
export function newId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 13)}`;
}
