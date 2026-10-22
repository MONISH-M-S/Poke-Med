import fs from "node:fs";
import path from "node:path";
import { buildSeed } from "../lib/seed";

const file = path.join(process.cwd(), "data", "db.json");
fs.mkdirSync(path.dirname(file), { recursive: true });
if (fs.existsSync(file)) fs.rmSync(file);

const db = buildSeed();
fs.writeFileSync(file, JSON.stringify(db, null, 2));

const taken = db.doses.filter((d) => d.status === "taken").length;
const missed = db.doses.filter((d) => d.status === "missed").length;
console.log(`Seeded ${db.medicines.length} medicines, ${db.doses.length} doses (${taken} taken, ${missed} missed).`);
console.log(`Adherence: ${Math.round((taken / (taken + missed)) * 100)}%`);
