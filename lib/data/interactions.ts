export interface PairRule {
  a: string;
  b: string;
  severity: "high" | "moderate";
  title: string;
  why: string;
  sourceName: string;
  sourceUrl: string;
}

const label = (drug: string) =>
  `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(drug)}`;

/**
 * A short, curated list — not a drug database. Every entry names the label
 * section it comes from so a pharmacist can check it.
 * Review these against current labeling before presenting.
 */
export const PAIR_RULES: PairRule[] = [
  {
    a: "ibuprofen",
    b: "aspirin",
    severity: "high",
    title: "Ibuprofen with low-dose aspirin",
    why: "Ibuprofen can interfere with aspirin's antiplatelet effect and both increase the risk of stomach bleeding. A pharmacist should advise on timing or an alternative.",
    sourceName: "FDA prescribing information — ibuprofen, Drug Interactions",
    sourceUrl: label("ibuprofen"),
  },
  {
    a: "ibuprofen",
    b: "warfarin",
    severity: "high",
    title: "Ibuprofen with warfarin",
    why: "NSAIDs add bleeding risk on top of warfarin and can irritate the stomach lining. Needs pharmacist review before use.",
    sourceName: "FDA prescribing information — warfarin, Drug Interactions",
    sourceUrl: label("warfarin"),
  },
  {
    a: "aspirin",
    b: "warfarin",
    severity: "high",
    title: "Aspirin with warfarin",
    why: "Two medicines that both thin the blood. Bleeding risk is substantially higher together.",
    sourceName: "FDA prescribing information — warfarin, Drug Interactions",
    sourceUrl: label("warfarin"),
  },
  {
    a: "warfarin",
    b: "metronidazole",
    severity: "high",
    title: "Warfarin with metronidazole",
    why: "Metronidazole can raise the INR, increasing bleeding risk. Usually needs an INR check and a dose review.",
    sourceName: "FDA prescribing information — warfarin, Drug Interactions",
    sourceUrl: label("warfarin"),
  },
  {
    a: "atorvastatin",
    b: "clarithromycin",
    severity: "high",
    title: "Atorvastatin with clarithromycin",
    why: "Clarithromycin raises atorvastatin levels, which can cause muscle injury. A pharmacist may advise pausing the statin for the antibiotic course.",
    sourceName: "FDA prescribing information — atorvastatin, Drug Interactions",
    sourceUrl: label("atorvastatin"),
  },
  {
    a: "simvastatin",
    b: "clarithromycin",
    severity: "high",
    title: "Simvastatin with clarithromycin",
    why: "This combination is contraindicated in the labeling because of the risk of severe muscle injury.",
    sourceName: "FDA prescribing information — simvastatin, Contraindications",
    sourceUrl: label("simvastatin"),
  },
  {
    a: "lisinopril",
    b: "spironolactone",
    severity: "moderate",
    title: "ACE inhibitor with spironolactone",
    why: "Both raise potassium. Kidney function and potassium may need checking.",
    sourceName: "FDA prescribing information — spironolactone, Drug Interactions",
    sourceUrl: label("spironolactone"),
  },
  {
    a: "ramipril",
    b: "spironolactone",
    severity: "moderate",
    title: "ACE inhibitor with spironolactone",
    why: "Both raise potassium. Kidney function and potassium may need checking.",
    sourceName: "FDA prescribing information — spironolactone, Drug Interactions",
    sourceUrl: label("spironolactone"),
  },
  {
    a: "sertraline",
    b: "tramadol",
    severity: "high",
    title: "SSRI with tramadol",
    why: "Together they increase the risk of serotonin syndrome and seizures.",
    sourceName: "FDA prescribing information — tramadol, Warnings",
    sourceUrl: label("tramadol"),
  },
  {
    a: "clopidogrel",
    b: "omeprazole",
    severity: "moderate",
    title: "Clopidogrel with omeprazole",
    why: "Omeprazole can reduce the effect of clopidogrel. A pharmacist can suggest a different stomach medicine.",
    sourceName: "FDA prescribing information — clopidogrel, Drug Interactions",
    sourceUrl: label("clopidogrel"),
  },
  {
    a: "ciprofloxacin",
    b: "tizanidine",
    severity: "high",
    title: "Ciprofloxacin with tizanidine",
    why: "Ciprofloxacin raises tizanidine levels sharply. This combination is contraindicated in the labeling.",
    sourceName: "FDA prescribing information — tizanidine, Contraindications",
    sourceUrl: label("tizanidine"),
  },
  {
    a: "lithium",
    b: "ibuprofen",
    severity: "high",
    title: "Lithium with ibuprofen",
    why: "NSAIDs can raise lithium levels into a toxic range.",
    sourceName: "FDA prescribing information — lithium, Drug Interactions",
    sourceUrl: label("lithium"),
  },
  {
    a: "methotrexate",
    b: "ibuprofen",
    severity: "high",
    title: "Methotrexate with ibuprofen",
    why: "NSAIDs can reduce methotrexate clearance and increase toxicity.",
    sourceName: "FDA prescribing information — methotrexate, Drug Interactions",
    sourceUrl: label("methotrexate"),
  },
  {
    a: "digoxin",
    b: "amiodarone",
    severity: "high",
    title: "Digoxin with amiodarone",
    why: "Amiodarone raises digoxin levels. A dose review is usually needed.",
    sourceName: "FDA prescribing information — digoxin, Drug Interactions",
    sourceUrl: label("digoxin"),
  },
  {
    a: "amlodipine",
    b: "simvastatin",
    severity: "moderate",
    title: "Amlodipine with simvastatin",
    why: "Labeling limits the simvastatin dose when taken with amlodipine because of muscle injury risk.",
    sourceName: "FDA prescribing information — simvastatin, Dose Limitations",
    sourceUrl: label("simvastatin"),
  },
  {
    a: "paracetamol",
    b: "warfarin",
    severity: "moderate",
    title: "Regular paracetamol with warfarin",
    why: "Taking paracetamol regularly can raise the INR. Occasional doses are usually fine, but regular use should be reviewed.",
    sourceName: "FDA prescribing information — warfarin, Drug Interactions",
    sourceUrl: label("warfarin"),
  },
];

export const DUPLICATE_SOURCE = {
  name: "MedlinePlus — Acetaminophen (patient information)",
  url: "https://medlineplus.gov/druginfo/meds/a681004.html",
};

export const CLASS_SOURCE = {
  name: "FDA prescribing information — therapeutic duplication (drug class)",
  url: "https://dailymed.nlm.nih.gov/dailymed/",
};
