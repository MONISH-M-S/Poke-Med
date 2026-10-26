import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DB } from "./types";
import { buildSeed } from "./seed";
import { setClockOffset } from "./clock";
import { hashSecret } from "./auth-hash";
import { DEMO_CAREGIVER_PIN, DEMO_PIN } from "./demo-auth";
import { withMutex } from "./mutex";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

type Cache = { db: DB | null };
const g = globalThis as unknown as { __pokemed?: Cache };
const cache: Cache = (g.__pokemed ??= { db: null });

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Databases created before sign-in existed have no PIN/password hashes.
 * Fill them with the demo credentials once, then write them back.
 */
function migrateAuth(db: DB): boolean {
  let changed = false;
  for (const person of db.people) {
    if (!person.pinHash) {
      person.pinHash = hashSecret(person.role === "elder" ? DEMO_PIN : DEMO_CAREGIVER_PIN);
      changed = true;
    }
  }
  return changed;
}

export function readDB(): DB {
  if (cache.db) return cache.db;
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    const seeded = buildSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2));
    cache.db = seeded;
    setClockOffset(seeded.clockOffsetMinutes);
    return seeded;
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DB;
  cache.db = db;
  setClockOffset(db.clockOffsetMinutes ?? 0);
  if (migrateAuth(db)) writeDBUnlocked(db);
  return db;
}

function writeDBUnlocked(db: DB) {
  ensureDir();
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  cache.db = db;
}

/**
 * Mutate the database with a mutex — only one caller at a time.
 * The callback receives the live DB object; its mutations are persisted atomically.
 */
export async function mutate<T>(fn: (db: DB) => T): Promise<T> {
  return withMutex(async () => {
    const db = readDB();
    const result = fn(db);
    writeDBUnlocked(db);
    return result;
  });
}

/** Synchronous version for startup/seed — no mutex needed since it's single-threaded at boot. */
export function mutateSync<T>(fn: (db: DB) => T): T {
  const db = readDB();
  const result = fn(db);
  writeDBUnlocked(db);
  return result;
}

export function resetDB(): DB {
  ensureDir();
  const seeded = buildSeed();
  writeDBUnlocked(seeded);
  setClockOffset(0);
  return seeded;
}

/** Collision-resistant, sortable IDs — uses Web Crypto (available in Node 15+). */
export function newId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 13)}`;
}
