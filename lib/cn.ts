/** Tiny className utility — no dependency, just what we need. */
export function cn(...args: (string | undefined | null | false | Record<string, boolean>)[]): string {
  const out: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === "string") {
      out.push(arg);
    } else if (typeof arg === "object") {
      for (const [k, v] of Object.entries(arg)) {
        if (v) out.push(k);
      }
    }
  }
  return out.join(" ");
}