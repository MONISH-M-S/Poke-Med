/**
 * Drug-name normalisation — the TypeScript mirror of scripts/lib/drug-names.mjs.
 * Keep the two in sync: the build script normalises the datasets, the runtime
 * normalises whatever is already stored in the database.
 */

const SALT_SUFFIXES = new Set([
  "hydrochloride",
  "hydrobromide",
  "sodium",
  "potassium",
  "calcium",
  "magnesium",
  "dihydrate",
  "monohydrate",
  "anhydrous",
  "besylate",
  "mesylate",
  "maleate",
  "tartrate",
  "bitartrate",
  "citrate",
  "succinate",
  "fumarate",
  "sulfate",
  "sulphate",
  "phosphate",
  "acetate",
  "propionate",
  "valerate",
  "pivalate",
  "palmitate",
  "stearate",
  "lactate",
  "gluconate",
  "carbonate",
  "bicarbonate",
  "nitrate",
  "chloride",
  "bromide",
  "iodide",
  "oxide",
  "hydroxide",
  "ip",
  "bp",
  "usp",
]);

const SYNONYMS: Record<string, string> = {
  acetaminophen: "paracetamol",
  paracetamol: "paracetamol",
  amoxycillin: "amoxicillin",
  amoxicillin: "amoxicillin",
  clavulanic: "clavulanate",
  "clavulanic acid": "clavulanate",
  clavulanate: "clavulanate",
  salbutamol: "salbutamol",
  albuterol: "salbutamol",
  levosalbutamol: "levosalbutamol",
  levalbuterol: "levosalbutamol",
  frusemide: "furosemide",
  furosemide: "furosemide",
  adrenaline: "epinephrine",
  epinephrine: "epinephrine",
  noradrenaline: "norepinephrine",
  norepinephrine: "norepinephrine",
  glyceryl: "nitroglycerin",
  nitroglycerin: "nitroglycerin",
  rifampicin: "rifampin",
  rifampin: "rifampin",
  lignocaine: "lidocaine",
  lidocaine: "lidocaine",
  pethidine: "meperidine",
  meperidine: "meperidine",
  hyoscine: "scopolamine",
  scopolamine: "scopolamine",
  thyroxine: "levothyroxine",
  levothyroxine: "levothyroxine",
  "vitamin b1": "thiamine",
  thiamine: "thiamine",
  "vitamin b6": "pyridoxine",
  pyridoxine: "pyridoxine",
  "vitamin b12": "cyanocobalamin",
  cyanocobalamin: "cyanocobalamin",
  "vitamin c": "ascorbic acid",
  "ascorbic acid": "ascorbic acid",
  "vitamin d3": "cholecalciferol",
  cholecalciferol: "cholecalciferol",
  "vitamin d2": "ergocalciferol",
  ergocalciferol: "ergocalciferol",
  "folic acid": "folic acid",
  folate: "folic acid",
  methylcobalamin: "methylcobalamin",
  "ferrous ascorbate": "ferrous ascorbate",
  "ferrous fumarate": "ferrous fumarate",
  "ferrous sulphate": "ferrous sulfate",
  "ferrous sulfate": "ferrous sulfate",
};

export function canonicalSalt(value: string): string {
  let s = String(value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";

  const words = s.split(" ");
  while (words.length > 1 && SALT_SUFFIXES.has(words[words.length - 1])) {
    const next = words.slice(0, -1);
    if (next.join(" ").length < 4) break;
    words.pop();
  }
  s = words.join(" ");

  return SYNONYMS[s] ?? s;
}

/** Same key the OCR parser produces for a brand token. */
export function normalizeBrand(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9-]/g, "").trim();
}

/** Stable key for a pair, independent of argument order. */
export function pairKey(a: string, b: string): string {
  return [canonicalSalt(a), canonicalSalt(b)].sort().join("|");
}
