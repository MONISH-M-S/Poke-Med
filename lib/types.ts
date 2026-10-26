export type Role = "elder" | "caregiver";
export type DoseStatus = "due" | "taken" | "missed";
export type FoodRel = "before" | "after" | "with" | null;

export interface Person {
  id: string;
  role: Role;
  name: string;
  age?: number;
  city?: string;
  linkedTo?: string;
  language: "en" | "ta" | "hi";
  /** scrypt hash — PINs are never stored in plain text. */
  pinHash?: string;
}

export interface Medicine {
  id: string;
  personId: string;
  brand: string;
  salt: string[];
  strength?: string;
  form: string;
  doseLabel: string;
  times: string[]; // "HH:MM"
  relationToFood: FoodRel;
  prn: boolean;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  rawSig: string;
  addedBy: "seed" | "scan";
  createdAt: string;
}

export interface DoseEvent {
  id: string;
  personId: string;
  medicineId: string;
  scheduledAt: string; // ISO
  status: DoseStatus;
  actedAt?: string;
  actedBy?: "elder" | "caregiver" | "system";
}

export interface Flag {
  id: string;
  personId: string;
  kind: "duplicate" | "class" | "pair";
  severity: "high" | "moderate";
  title: string;
  explanation: string;
  sourceName: string;
  sourceUrl: string;
  medicineIds: string[];
  status: "open" | "sent";
  createdAt: string;
}

export interface Alert {
  id: string;
  personId: string;
  doseId?: string;
  message: string;
  createdAt: string;
  acknowledged: boolean;
}

export interface Prescription {
  id: string;
  personId: string;
  imagePath?: string;
  rawText: string;
  status: "extracted" | "saved";
  createdAt: string;
}

export interface Nudge {
  /** Real time (epoch ms), not the demo clock — a nudge is "now" on both screens. */
  at: number;
  from: string;
}

export interface DB {
  version: 1;
  people: Person[];
  medicines: Medicine[];
  doses: DoseEvent[];
  flags: Flag[];
  alerts: Alert[];
  prescriptions: Prescription[];
  clockOffsetMinutes: number;
  lastNudge?: Nudge;
}

export interface ExtractedMedicine {
  brand: string;
  salt: string[];
  strength?: string;
  form: string;
  doseLabel: string;
  times: string[];
  relationToFood: FoodRel;
  prn: boolean;
  durationDays: number | null;
  rawSig: string;
  confidence: number;
  notes: string[];
}

export interface DoseView {
  id: string;
  medicineId: string;
  brand: string;
  strength?: string;
  form: string;
  doseLabel: string;
  time: string; // "8:00 AM"
  dateKey: string;
  scheduledAt: string;
  status: DoseStatus;
  bucket: "Morning" | "Afternoon" | "Night";
  relationToFood: FoodRel;
  actedAt?: string;
  actedBy?: string;}

export interface DayStat {
  date: string;
  label: string;
  taken: number;
  missed: number;
  total: number;
}

export interface AppState {
  now: string;
  offsetMinutes: number;
  elder: Person;
  caregiver: Person;
  medicines: Medicine[];
  today: DoseView[];
  week: {
    percent: number;
    taken: number;
    missed: number;
    total: number;
    days: DayStat[];
    missedList: DoseView[];
  };
  flags: Flag[];
  alerts: Alert[];
  nextDose: DoseView | null;
  /** Set when the caregiver pressed "Send a nudge" in the last five minutes. */
  nudge?: Nudge;
}
