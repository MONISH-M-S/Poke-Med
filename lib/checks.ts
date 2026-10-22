import type { DB, Flag, Medicine } from "./types";
import { PAIR_RULES, DUPLICATE_SOURCE, CLASS_SOURCE } from "./data/interactions";
import { DRUG_CLASS } from "./data/brands";

const uid = () => "flg_" + Math.random().toString(36).slice(2, 10);

function active(meds: Medicine[], personId: string) {
  return meds.filter((m) => m.personId === personId);
}

function pairKey(kind: string, ids: string[]) {
  return `${kind}:${[...ids].sort().join("+")}`;
}

/**
 * Advisory checks only. Nothing here blocks saving, and nothing here tells
 * anyone to stop a medicine — it asks a pharmacist to look.
 */
export function detectFlags(db: DB, personId: string, newMedIds: string[]): Flag[] {
  const meds = active(db.medicines, personId);
  const newMeds = meds.filter((m) => newMedIds.includes(m.id));
  const flags: Flag[] = [];
  const seen = new Set<string>();

  // 1. Same salt, two products
  const bySalt = new Map<string, Medicine[]>();
  for (const m of meds) {
    for (const salt of m.salt) {
      const list = bySalt.get(salt) ?? [];
      list.push(m);
      bySalt.set(salt, list);
    }
  }

  for (const [salt, list] of bySalt) {
    const uniqueMeds = Array.from(new Set(list.map((m) => m.id)))
      .map((id) => meds.find((m) => m.id === id)!)
      .filter(Boolean);
    if (uniqueMeds.length < 2) continue;
    if (!uniqueMeds.some((m) => newMedIds.includes(m.id))) continue;

    const names = uniqueMeds.map((m) => `${m.brand}${m.strength ? ` ${m.strength}` : ""}`);
    const key = pairKey("dup", uniqueMeds.map((m) => m.id));
    if (seen.has(key)) continue;
    seen.add(key);

    flags.push({
      id: uid(),
      personId,
      kind: "duplicate",
      severity: "high",
      title: `Possible duplicate: ${salt}`,
      explanation: `${names.join(" and ")} both contain ${salt}. Taken together, that could mean more ${salt} than intended. Please confirm with a pharmacist before the next dose.`,
      sourceName: DUPLICATE_SOURCE.name,
      sourceUrl: DUPLICATE_SOURCE.url,
      medicineIds: uniqueMeds.map((m) => m.id),
      status: "open",
      createdAt: new Date().toISOString(),
    });
  }

  // 2. Two medicines from the same class
  const byClass = new Map<string, Medicine[]>();
  for (const m of meds) {
    for (const salt of m.salt) {
      const cls = DRUG_CLASS[salt];
      if (!cls) continue;
      const list = byClass.get(cls) ?? [];
      list.push(m);
      byClass.set(cls, list);
    }
  }

  for (const [cls, list] of byClass) {
    const uniqueMeds = Array.from(new Set(list.map((m) => m.id)))
      .map((id) => meds.find((m) => m.id === id)!)
      .filter(Boolean);
    if (uniqueMeds.length < 2) continue;
    if (!uniqueMeds.some((m) => newMedIds.includes(m.id))) continue;
    const key = pairKey("class", uniqueMeds.map((m) => m.id));
    if (seen.has(key)) continue;
    seen.add(key);

    flags.push({
      id: uid(),
      personId,
      kind: "class",
      severity: "moderate",
      title: `Two ${cls} medicines`,
      explanation: `${uniqueMeds.map((m) => m.brand).join(" and ")} are both ${cls} medicines. This can be deliberate, but it is worth a pharmacist confirming that both are needed.`,
      sourceName: CLASS_SOURCE.name,
      sourceUrl: CLASS_SOURCE.url,
      medicineIds: uniqueMeds.map((m) => m.id),
      status: "open",
      createdAt: new Date().toISOString(),
    });
  }

  // 3. Curated risky pairs, including the medicines already on the list
  for (const rule of PAIR_RULES) {
    const aMeds = meds.filter((m) => m.salt.includes(rule.a));
    const bMeds = meds.filter((m) => m.salt.includes(rule.b));
    for (const a of aMeds) {
      for (const b of bMeds) {
        if (a.id === b.id) continue;
        if (!newMedIds.includes(a.id) && !newMedIds.includes(b.id)) continue;
        const key = pairKey("pair", [a.id, b.id]);
        if (seen.has(key)) continue;
        seen.add(key);

        flags.push({
          id: uid(),
          personId,
          kind: "pair",
          severity: rule.severity,
          title: rule.title,
          explanation: rule.why,
          sourceName: rule.sourceName,
          sourceUrl: rule.sourceUrl,
          medicineIds: [a.id, b.id],
          status: "open",
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return flags;
}
