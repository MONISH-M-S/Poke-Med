// Brand -> active salt(s). Deliberately small and curated for the demo.
// Anything not here falls back to a single-salt guess and is marked for review.
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

export function normalizeBrand(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9-]/g, "").trim();
}

export function saltsFor(brand: string): { salts: string[]; known: boolean } {
  const key = normalizeBrand(brand);
  if (BRAND_SALTS[key]) return { salts: BRAND_SALTS[key], known: true };
  // Try a single-word token inside the brand (e.g. "Dolo 650" already stripped).
  for (const [name, salts] of Object.entries(BRAND_SALTS)) {
    if (key.startsWith(name) || key.includes(name)) return { salts, known: true };
  }
  return { salts: [key], known: false };
}

/** Levenshtein distance, capped so long OCR garbage stays cheap. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, j) => j);
  let curr = new Array<number>(cols).fill(0);

  for (let i = 1; i < rows; i += 1) {
    curr[0] = i;
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[cols - 1];
}

/**
 * Suggest a known brand for an OCR spelling, never replace it.
 * Only close matches with the same first letter qualify; a wrong guess about
 * a drug name is worse than no guess, so this is displayed as a question.
 */
export function suggestBrand(brand: string): string | null {
  const key = normalizeBrand(brand);
  if (key.length < 4) return null;

  const allowed = key.length >= 7 ? 2 : 1;
  let best: { name: string; d: number } | null = null;

  for (const name of Object.keys(BRAND_SALTS)) {
    if (name[0] !== key[0]) continue;
    if (Math.abs(name.length - key.length) > allowed) continue;
    const d = distance(key, name);
    if (d <= allowed && (!best || d < best.d)) best = { name, d };
  }

  return best?.name ?? null;
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
