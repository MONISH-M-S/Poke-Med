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
