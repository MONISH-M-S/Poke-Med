import fs from "node:fs";
import path from "node:path";
import type { DB } from "./types";
import { buildSeed } from "./seed";
import { setClockOffset } from "./clock";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

type Cache = { db: DB | null };
const g = globalThis as unknown as { __pokemed?: Cache };
const cache: Cache = (g.__pokemed ??= { db: null });

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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
  return db;
}

export function writeDB(db: DB) {
  ensureDir();
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  cache.db = db;
}

export function mutate<T>(fn: (db: DB) => T): T {
  const db = readDB();
  const result = fn(db);
  writeDB(db);
  return result;
}

export function resetDB(): DB {
  ensureDir();
  const seeded = buildSeed();
  writeDB(seeded);
  setClockOffset(0);
  return seeded;
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
