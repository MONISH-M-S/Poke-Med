// Brand -> active salt(s). A small curated override for the demo brands;
// the 253,973-product index in generated/ handles everything else.
// Anything found in neither falls back to a single-salt guess and is marked
// for review.
import { indexedSalts, suggestIndexedBrand } from "./drug-index";
import { normalizeBrand } from "./drug-names";

export { normalizeBrand };

export const BRAND_SALTS: Record<string, string[]> = {
  metformin: ["metformin"],
  glycomet: ["metformin"],
  glucophage: ["metformin"],
  amlodipine: ["amlodipine"],
  amlokind: ["amlodipine"],
  amlong: ["amlodipine"],
  atorvastatin: ["atorvastatin"],
  atorva: ["atorvastatin"],
  storvas: ["atorvastatin"],
  ecosprin: ["aspirin"],
  disprin: ["aspirin"],
  aspirin: ["aspirin"],
  crocin: ["paracetamol"],
  dolo: ["paracetamol"],
  calpol: ["paracetamol"],
  paracetamol: ["paracetamol"],
  ibuprofen: ["ibuprofen"],
  brufen: ["ibuprofen"],
  combiflam: ["ibuprofen", "paracetamol"],
  augmentin: ["amoxicillin", "clavulanate"],
  amoxicillin: ["amoxicillin"],
  azee: ["azithromycin"],
  azithromycin: ["azithromycin"],
  pan: ["pantoprazole"],
  pantoprazole: ["pantoprazole"],
  "pan-d": ["pantoprazole", "domperidone"],
  telma: ["telmisartan"],
  telmisartan: ["telmisartan"],
  amlongh: ["amlodipine", "hydrochlorothiazide"],
  losar: ["losartan"],
  losartan: ["losartan"],
  metoprolol: ["metoprolol"],
  metolar: ["metoprolol"],
  warfarin: ["warfarin"],
  warf: ["warfarin"],
  clopidogrel: ["clopidogrel"],
  clopilet: ["clopidogrel"],
  omeprazole: ["omeprazole"],
  omez: ["omeprazole"],
  sertraline: ["sertraline"],
  daxid: ["sertraline"],
  tramadol: ["tramadol"],
  ultracet: ["tramadol", "paracetamol"],
  ciprofloxacin: ["ciprofloxacin"],
  cipro: ["ciprofloxacin"],
  clarithromycin: ["clarithromycin"],
  claribid: ["clarithromycin"],
  simvastatin: ["simvastatin"],
  simvotin: ["simvastatin"],
  spironolactone: ["spironolactone"],
  aldactone: ["spironolactone"],
  digoxin: ["digoxin"],
  lanoxin: ["digoxin"],
  amiodarone: ["amiodarone"],
  lithium: ["lithium"],
  methotrexate: ["methotrexate"],
  tizanidine: ["tizanidine"],
  lisinopril: ["lisinopril"],
  ramipril: ["ramipril"],
  diclofenac: ["diclofenac"],
  voveran: ["diclofenac"],
  naproxen: ["naproxen"],
  levothyroxine: ["levothyroxine"],
  thyronorm: ["levothyroxine"],
  glimepiride: ["glimepiride"],
  amaryl: ["glimepiride"],
};

export function saltsFor(brand: string): { salts: string[]; known: boolean } {
  const key = normalizeBrand(brand);
  if (!key) return { salts: [], known: false };

  // 1. Curated demo brands win on an exact match.
  if (BRAND_SALTS[key]) return { salts: BRAND_SALTS[key], known: true };

  // 2. The generated Indian product index — exact keys, including variants
  //    such as "ecosprin-av", beat a curated prefix below.
  const indexed = indexedSalts(key);
  if (indexed) return indexed;

  // 3. A curated token inside a longer name ("dolo" in "dolo650").
  for (const [name, salts] of Object.entries(BRAND_SALTS)) {
    if (key.startsWith(name) || key.includes(name)) return { salts, known: true };
  }

  // 4. Unknown: keep the word as a provisional salt and mark it for review.
  return { salts: [key], known: false };
}

/**
 * Suggest a known brand for an OCR spelling, never replace it.
 * Only close matches with the same first letter qualify; a wrong guess about
 * a drug name is worse than no guess, so this is displayed as a question.
 */
export function suggestBrand(brand: string): string | null {
  return suggestIndexedBrand(brand);
}

export const DRUG_CLASS: Record<string, string> = {
  ibuprofen: "NSAID",
  diclofenac: "NSAID",
  naproxen: "NSAID",
  atorvastatin: "Statin",
  simvastatin: "Statin",
  lisinopril: "ACE inhibitor",
  ramipril: "ACE inhibitor",
  omeprazole: "Proton pump inhibitor",
  pantoprazole: "Proton pump inhibitor",
  sertraline: "SSRI",
  amlodipine: "Calcium channel blocker",
  telmisartan: "ARB",
  losartan: "ARB",
};
