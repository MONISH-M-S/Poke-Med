/**
 * Make sure this machine has its own cookie-signing secret.
 *
 * The repository must never ship a working secret: with a published value,
 * anyone can mint a valid session cookie. So the first `npm run dev`/`build`/
 * `start` writes a random one to .env.local (git-ignored). Next loads that file
 * for both the Node runtime and the edge middleware, so the two agree.
 *
 * An AUTH_SECRET already in the environment always wins.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), ".env.local");

if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim()) {
  process.exit(0);
}

let existing = "";
try {
  existing = fs.readFileSync(file, "utf8");
} catch {
  // No .env.local yet — that is the normal first run.
}

const line = /^\s*AUTH_SECRET\s*=(.*)$/m;
const match = existing.match(line);

if (match && match[1].trim().replace(/^["']|["']$/g, "").length > 0) {
  process.exit(0); // The file already holds a secret; leave it alone.
}

const secret = randomBytes(32).toString("hex");

if (match) {
  fs.writeFileSync(file, existing.replace(line, `AUTH_SECRET=${secret}`));
} else {
  const header =
    "# Generated locally by scripts/ensure-secret.mjs. Signs session cookies.\n" +
    "# Do not commit this file; delete it to rotate the secret (signs everyone out).\n";
  const separator = existing && !existing.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(file, `${existing}${separator}${header}AUTH_SECRET=${secret}\n`);
}

console.log("[pokemed] Generated a session secret in .env.local");
