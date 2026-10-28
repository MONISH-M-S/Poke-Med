/**
 * Shared drug-name normalisation for the data build and the runtime lookup.
 *
 * Indian product data spells generics the British/IN way ("amoxycillin",
 * "paracetamol"); DrugBank uses the US spelling ("amoxicillin",
 * "acetaminophen"). Everything is reduced to one canonical token so a pair
 * from either source lands on the same key.
 */

/** Salt / ester suffixes that do not change the active ingredient. */
const SALT_SUFFIXES = [
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
];

/** British/Indian <-> US generic spellings, plus common brand-free synonyms. */
const SYNONYMS = {
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

export function canonicalSalt(value) {
  let s = String(value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")       // drop "(500mg)" / "(as salt)"
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";

  // "diclofenac sodium" -> "diclofenac", but never reduce a drug to nothing
  const words = s.split(" ");
  while (words.length > 1 && SALT_SUFFIXES.includes(words[words.length - 1])) {
    const next = words.slice(0, -1);
    if (next.join(" ").length < 4) break;
    words.pop();
  }
  s = words.join(" ");

  return SYNONYMS[s] ?? s;
}

/** First token of a product name, used as the OCR lookup key. */
export function brandKey(productName) {
  const first = String(productName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")[0]
    ?.replace(/^-+|-+$/g, "");
  if (!first || first.length < 2) return "";
  if (/^\d/.test(first)) return "";
  if (["tab", "tablet", "cap", "capsule", "syrup", "syp", "injection"].includes(first)) return "";
  return first;
}

/** Split a composition cell into canonical salts. */
export function compositionSalts(composition) {
  const out = [];
  for (const part of String(composition ?? "").split(/\s*,\s*/)) {
    if (!part.trim()) continue;
    // "Amoxycillin (500mg)" and stray "500 mg" fragments
    const name = part.replace(/\([^)]*\)/g, " ").trim();
    const salt = canonicalSalt(name);
    if (!salt || salt.length < 3) continue;
    if (/^(not applicable|na|none|nil)$/.test(salt)) continue;
    if (!out.includes(salt)) out.push(salt);
  }
  return out;
}
