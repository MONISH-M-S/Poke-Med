import type { ExtractedMedicine, FoodRel } from "../types";
import { saltsFor, suggestBrand } from "../data/brands";

/**
 * Doctor shorthand -> real times.
 *
 * Deliberately deterministic. The vision model only reads the page; every dose
 * decision is made by rules that can be unit-tested and explained.
 */

const BASE3 = ["08:00", "13:00", "20:00"];
const BASE4 = ["08:00", "13:00", "17:00", "21:00"];
const BASE2 = ["08:00", "20:00"];

export interface ParsedSig {
  times: string[];
  prn: boolean;
  relationToFood: FoodRel;
  durationDays: number | null;
  unitsPerDose: number;
  confidence: number;
  notes: string[];
  decidedBy: string;
}

function shift(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function slotValue(token: string): number {
  if (token === "½") return 0.5;
  if (token === "¼") return 0.25;
  return Number(token);
}

function everyNHours(n: number): string[] {
  const out: string[] = [];
  for (let h = 8; h <= 21; h += n) {
    out.push(`${String(h).padStart(2, "0")}:00`);
  }
  return out.length ? out : ["08:00"];
}

/** "7 AM", "7:30 pm", "19.00" -> "07:00" / "19:30". */
function clockTimes(text: string): string[] {
  const out = new Set<string>();
  const re = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/gi;
  for (const match of text.matchAll(re)) {
    let hour = Number(match[1]);
    const minutes = Number(match[2] ?? 0);
    const pm = /^p/i.test(match[3]);
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
    if (hour > 23 || minutes > 59) continue;
    out.add(`${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
  }
  return [...out].sort();
}

export function parseSig(raw: string): ParsedSig {
  const notes: string[] = [];
  // OCR-friendly normalisation: "1 / 2" is a half tablet, not a blood pressure.
  const text = raw.replace(/(^|[\s(-])1\s*\/\s*2(?=[\s)-]|$)/g, "$1½").trim();

  // Food relationship
  let relationToFood: FoodRel = null;
  const upper = ` ${text.toUpperCase().replace(/[^A-Z0-9½¼]+/g, " ").trim()} `;
  if (/\bPC\b|AFTER FOOD|AFTER MEAL|POST PRANDIAL/.test(upper)) relationToFood = "after";
  else if (/\bAC\b|BEFORE FOOD|BEFORE MEAL|EMPTY STOMACH|PRE PRANDIAL/.test(upper)) relationToFood = "before";
  else if (/WITH FOOD/.test(upper)) relationToFood = "with";

  // As needed — never turned into fixed slots
  const prn = /\bSOS\b|\bS O S\b|\bPRN\b|\bAS NEEDED\b|\bWHEN REQUIRED\b/.test(upper);
  const bedtime = /\bHS\b|AT NIGHT|\bBEDTIME\b/.test(upper);

  // Duration: x 30 days / x30d / for 5 days / x 1 week
  let durationDays: number | null = null;
  const dur = text.match(
    /(?:x|×|for)\s*(\d+)\s*(days?|d|weeks?|w|wks?)?\b(?!\s*(?:mg|mcg|ml|g)\b)/i,
  );
  if (dur) {
    const n = Number(dur[1]);
    const unit = (dur[2] ?? "d").toLowerCase();
    durationDays = unit.startsWith("w") ? n * 7 : n;
  }

  if (prn) {
    return {
      times: [],
      prn: true,
      relationToFood,
      durationDays,
      unitsPerDose: 1,
      confidence: 0.9,
      notes: ["As needed — not scheduled at fixed times."],
      decidedBy: "SOS/PRN",
    };
  }

  // Dose pattern: 1-0-1, 1-1-1, ½-0-½, 2-0-2-0
  const pattern = text.match(
    /(?:^|[\s(])((?:\d+(?:\.\d+)?|½|¼)(?:\s*-\s*(?:\d+(?:\.\d+)?|½|¼)){1,3})(?=[\s)]|$)/,
  );
  let times: string[] = [];
  let unitsPerDose = 1;
  let confidence = 0.55;
  let decidedBy = "";

  // A date like 17-7-24 is not a dose pattern.
  const dose =
    pattern && pattern[1].split(/\s*-\s*/).map(slotValue).every((p) => p <= 4)
      ? pattern[1]
      : null;

  if (dose) {
    const parts = dose.split(/\s*-\s*/).map(slotValue);
    const base = parts.length === 4 ? BASE4 : parts.length === 3 ? BASE3 : BASE2;
    times = parts
      .map((value, i) => (value > 0 ? (base[i] ?? BASE3[i]) : null))
      .filter((t): t is string => Boolean(t));
    const positive = parts.filter((p) => p > 0);
    unitsPerDose = positive.length ? Math.max(...positive) : 1;
    confidence = 0.97;
    decidedBy = `dose pattern ${dose.replace(/\s/g, "")}`;
    if (bedtime && times.length === 1) {
      times = ["21:00"];
      decidedBy += " + HS";
    }
  } else if (/\bQ\s*\d+\s*H\b/.test(upper)) {
    const m = upper.match(/\bQ\s*(\d+)\s*H\b/);
    times = everyNHours(Number(m?.[1] ?? 8));
    confidence = 0.92;
    decidedBy = `every ${m?.[1]} hours`;
  } else if (/\bQID\b|FOUR TIMES/.test(upper)) {
    times = [...BASE4];
    confidence = 0.95;
    decidedBy = "QID";
  } else if (/\bTDS\b|\bTID\b|THRICE|THREE TIMES/.test(upper)) {
    times = [...BASE3];
    confidence = 0.95;
    decidedBy = "TDS";
  } else if (/\bBD\b|\bBID\b|TWICE/.test(upper)) {
    times = [...BASE2];
    confidence = 0.95;
    decidedBy = "BD";
  } else if (/\bHS\b|AT NIGHT|BEDTIME/.test(upper)) {
    times = ["21:00"];
    confidence = 0.93;
    decidedBy = "HS";
  } else if (/\bOD\b|ONCE DAILY|\bDAILY\b/.test(upper)) {
    times = ["08:00"];
    confidence = 0.92;
    decidedBy = "OD";
  } else if (/\bSTAT\b/.test(upper)) {
    times = ["08:00"];
    durationDays = 1;
    confidence = 0.8;
    decidedBy = "STAT (single dose)";
  } else {
    times = ["08:00"];
    confidence = 0.35;
    decidedBy = "defaulted to morning";
    notes.push("Timing unclear — please confirm.");
  }

  // "8 hourly" and "q8h" are common on Indian prescriptions.
  if (!dose && times.length === 1 && /\b(?:Q\s*\d+\s*H|\d+\s*(?:HRLY|HOURLY|HRS?|HR))\b/.test(upper)) {
    const m = upper.match(/\bQ?\s*(\d+)\s*(?:H|HR|HRS|HRLY|HOURLY)\b/);
    const hours = Number(m?.[1] ?? 0);
    if (hours >= 4 && hours <= 24) {
      times = everyNHours(hours);
      confidence = 0.9;
      decidedBy = `every ${hours} hours`;
    }
  }

  // A number in front of the frequency is the dose count: "2 BD", "1 OD".
  if (!dose) {
    const unit = upper.match(/\b([1-4])\s*(?:TAB(?:LET)?S?|CAP(?:SULE)?S?)?\s*(?:OD|BD|TDS|TID|QID|HS)\b/);
    if (unit) unitsPerDose = Number(unit[1]);
  }

  // A written clock time beats a guessed slot: "1 OD AC 7 AM" is 7 AM, not 8.
  const explicit = clockTimes(text);
  if (explicit.length > 0 && explicit.length >= times.length) {
    times = explicit;
    confidence = Math.max(confidence, 0.9);
    decidedBy = `written time ${explicit.join(", ")}`;
  }

  if (relationToFood === "after") times = times.map((t) => shift(t, 30));
  if (relationToFood === "before") times = times.map((t) => shift(t, -30));

  if (durationDays !== null && durationDays <= 0) durationDays = null;

  return { times, prn: false, relationToFood, durationDays, unitsPerDose, confidence, notes, decidedBy };
}

export function doseLabelFor(units: number, form: string): string {
  const f = form.toLowerCase();
  const unit = f.startsWith("cap") ? "capsule" : f.startsWith("tab") ? "tablet" : f.startsWith("syp") ? "dose" : "dose";
  if (f.startsWith("syp")) return "5 ml";
  if (units === 0.5) return `½ ${unit}`;
  if (units === 0.25) return `¼ ${unit}`;
  return `${units} ${unit}${units === 1 ? "" : "s"}`;
}

const HEADER = /doctor|clinic|hospital|patient|age|sex|date|address|phone|diagnosis|advice|follow|signature|registration|reg\.?\s*no|rx|prescription/i;

const PARENTERAL = /\b(?:IV|I\.V\.?|IM|I\.M\.?|INJ|INJECTION|INFUSION|INTRAVENOUS|INTRAMUSCULAR)\b/i;
const SUPPLY = /\b(?:SYRINGE|NEEDLE|CANNULA|PLASTER|GLOVES|SWAB|SCALP\s*VEIN|IV\s*SET|DRIP\s*SET)\b/i;
const FLUID = /\b(?:NORMAL\s+SALINE|SALINE|RINGER|DEXTROSE|DNS|D5)\b/i;

export interface IgnoredLine {
  line: string;
  reason: string;
}

export interface ParsedPrescription {
  medicines: ExtractedMedicine[];
  ignored: IgnoredLine[];
}

/**
 * Parse lines into medicines, and keep a record of things we deliberately did
 * not schedule. Hospital drips and consumables must never land on a home
 * schedule just because OCR found them.
 */
export function parsePrescription(text: string): ParsedPrescription {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ExtractedMedicine[] = [];
  const ignored: IgnoredLine[] = [];

  for (const line of lines) {
    if (line.length < 5) continue;
    if (HEADER.test(line) && !/\d+\s*(mg|mcg|ml)/i.test(line)) continue;

    const hasStrengthEarly = /\d+(?:\.\d+)?\s*(mg|mcg|g|ml|iu)\b/i.test(line);
    const formMatch = line.match(
      /\b(tab|tablet|cap|capsule|syp|syrup|inj|injection|drops?|oint|gel|cream|inhaler|spray|sachet|powder)\b\.?/i,
    );

    // Non-oral routes and supplies: surface them, never schedule them.
    if (PARENTERAL.test(line)) {
      ignored.push({ line, reason: "given by a clinician (IV/IM) — not a home dose" });
      continue;
    }
    if (SUPPLY.test(line)) {
      ignored.push({ line, reason: "medical supply, not a medicine" });
      continue;
    }
    if (FLUID.test(line) && (/ml\b/i.test(line) || PARENTERAL.test(line))) {
      ignored.push({ line, reason: "IV fluid — not scheduled at home" });
      continue;
    }

    if (!formMatch && !hasStrengthEarly) continue;

    const afterForm = formMatch
      ? line.slice((formMatch.index ?? 0) + formMatch[0].length)
      : line;

    const brandMatch = afterForm.match(/^[\s.\-]*([A-Za-z][A-Za-z0-9\-/]*)/);
    if (!brandMatch) continue;
    const brand = brandMatch[1].replace(/[-/]+$/, "");
    if (brand.length < 2) continue;
    if (/^(mg|ml|mcg|tablet|capsule|syrup|od|bd|tds)$/i.test(brand)) continue;

    const formEnd = formMatch ? (formMatch.index ?? 0) + formMatch[0].length : 0;
    const brandEnd = formEnd + (brandMatch.index ?? 0) + brandMatch[0].length;

    const strengthMatch = line.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu)\b/i);
    let strength = strengthMatch ? `${strengthMatch[1]} ${strengthMatch[2].toLowerCase()}` : undefined;
    let strengthFromName = false;
    if (!strength) {
      // "Cap. Pan 40" means 40 mg in Indian practice.
      const trailing = line.slice(brandEnd);
      const bare = trailing.match(/^\s*(?:[:-]\s*)?(\d{2,4})\b(?!\s*-)/);
      if (bare) {
        strength = `${bare[1]} mg`;
        strengthFromName = true;
      }
    }

    const sig = parseSig(line);
    const { salts, known } = saltsFor(brand);
    const notes = [...sig.notes];
    if (strengthFromName) notes.push(`Strength read as ${strength} from the name — check it.`);
    if (!known) {
      const suggestion = suggestBrand(brand);
      notes.push(
        suggestion
          ? `Not in our brand list. Did you mean “${suggestion[0].toUpperCase() + suggestion.slice(1)}”? Check the spelling.`
          : "Brand not in our list — check the salt before saving.",
      );
    }

    const form = formMatch ? formMatch[1].toLowerCase() : "tablet";

    out.push({
      brand: brand[0].toUpperCase() + brand.slice(1),
      salt: salts,
      strength,
      form,
      doseLabel: doseLabelFor(sig.unitsPerDose, form),
      times: sig.times,
      relationToFood: sig.relationToFood,
      prn: sig.prn,
      durationDays: sig.durationDays,
      rawSig: line,
      confidence: Math.min(sig.confidence, known ? 1 : 0.6),
      notes,
    });
  }

  // Merge obvious duplicates on the same line set
  const seen = new Set<string>();
  const medicines = out.filter((m) => {
    const key = `${m.brand.toLowerCase()}|${m.strength ?? ""}|${m.rawSig.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { medicines, ignored };
}

export function parsePrescriptionText(text: string): ExtractedMedicine[] {
  return parsePrescription(text).medicines;
}
