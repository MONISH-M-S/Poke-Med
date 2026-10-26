/**
 * Zod-like validation schemas — zero dependencies, just what we need.
 * Each schema has a `parse` method that throws on failure, and a `safeParse` that returns { success, data?, error? }.
 */

type Schema<T> = {
  parse: (input: unknown) => T;
  safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: string };
};

function isString(v: unknown): v is string { return typeof v === "string"; }
function isNumber(v: unknown): v is number { return typeof v === "number" && !Number.isNaN(v); }
function isBoolean(v: unknown): v is boolean { return typeof v === "boolean"; }
function isArray<T>(v: unknown, itemCheck: (x: unknown) => x is T): v is T[] {
  return Array.isArray(v) && v.every(itemCheck);
}

function string(): Schema<string> {
  return {
    parse: (v) => { if (!isString(v)) throw new Error("Expected string"); return v; },
    safeParse: (v) => isString(v) ? { success: true, data: v } : { success: false, error: "Expected string" },
  };
}

function number(): Schema<number> {
  return {
    parse: (v) => { if (!isNumber(v)) throw new Error("Expected number"); return v; },
    safeParse: (v) => isNumber(v) ? { success: true, data: v } : { success: false, error: "Expected number" },
  };
}

function boolean(): Schema<boolean> {
  return {
    parse: (v) => { if (!isBoolean(v)) throw new Error("Expected boolean"); return v; },
    safeParse: (v) => isBoolean(v) ? { success: true, data: v } : { success: false, error: "Expected boolean" },
  };
}

function array<T>(item: Schema<T>): Schema<T[]> {
  return {
    parse: (v) => { if (!Array.isArray(v)) throw new Error("Expected array"); return v.map((x) => item.parse(x)); },
    safeParse: (v) => {
      if (!Array.isArray(v)) return { success: false, error: "Expected array" };
      const out: T[] = [];
      for (const x of v) {
        const r = item.safeParse(x);
        if (!r.success) return { success: false, error: r.error };
        out.push(r.data);
      }
      return { success: true, data: out };
    },
  };
}

function object<T extends Record<string, Schema<unknown>>>(shape: T): Schema<{ [K in keyof T]: ReturnType<T[K]["parse"]> }> {
  const keys = Object.keys(shape) as (keyof T)[];
  return {
    parse: (v) => {
      if (v === null || typeof v !== "object") throw new Error("Expected object");
      const obj = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of keys) {
        const schema = shape[k];
        out[String(k)] = schema.parse(obj[String(k)]);
      }
      return out as { [K in keyof T]: ReturnType<T[K]["parse"]> };
    },
    safeParse: (v) => {
      if (v === null || typeof v !== "object") return { success: false, error: "Expected object" };
      const obj = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of keys) {
        const schema = shape[k];
        const r = schema.safeParse(obj[String(k)]);
        if (!r.success) return { success: false, error: r.error };
        out[String(k)] = r.data;
      }
      return { success: true, data: out as { [K in keyof T]: ReturnType<T[K]["parse"]> } };
    },
  };
}

function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    parse: (v) => { if (v === undefined) return undefined; return schema.parse(v); },
    safeParse: (v) => { if (v === undefined) return { success: true, data: undefined }; return schema.safeParse(v); },
  };
}

function nullable<T>(schema: Schema<T>): Schema<T | null> {
  return {
    parse: (v) => { if (v === null) return null; return schema.parse(v); },
    safeParse: (v) => { if (v === null) return { success: true, data: null }; return schema.safeParse(v); },
  };
}

function enumSchema<T extends string>(values: T[]): Schema<T> {
  return {
    parse: (v) => { if (!values.includes(v as T)) throw new Error(`Expected one of: ${values.join(", ")}`); return v as T; },
    safeParse: (v) => values.includes(v as T) ? { success: true, data: v as T } : { success: false, error: `Expected one of: ${values.join(", ")}` },
  };
}

/** Transform + refine helpers */
function transform<T, U>(schema: Schema<T>, fn: (v: T) => U): Schema<U> {
  return {
    parse: (v) => fn(schema.parse(v)),
    safeParse: (v) => { const r = schema.safeParse(v); return r.success ? { success: true, data: fn(r.data) } : r; },
  };
}

function refine<T>(schema: Schema<T>, fn: (v: T) => boolean, message: string): Schema<T> {
  return {
    parse: (v) => { const parsed = schema.parse(v); if (!fn(parsed)) throw new Error(message); return parsed; },
    safeParse: (v) => { const r = schema.safeParse(v); return r.success && !fn(r.data) ? { success: false, error: message } : r; },
  };
}

/** Pre-built schemas for our routes */
export const DoseActionSchema = object({
  doseId: string(),
  action: enumSchema(["taken", "snooze"]),
  actor: optional(enumSchema(["caregiver", "elder"])),
});

export const DemoActionSchema = object({
  action: enumSchema(["reset", "realTime", "offset", "nextDose", "nextMiss"]),
  minutes: optional(number()),
});

export const ScanTextSchema = object({
  text: string(),
});

export const FlagActionSchema = object({
  // params.id comes from URL, not body
});

export const PrescriptionCommitSchema = object({
  medicines: array(object({
    brand: string(),
    salt: array(string()),
    strength: optional(string()),
    form: optional(string()),
    doseLabel: optional(string()),
    times: optional(array(string())),
    relationToFood: optional(enumSchema(["before", "after", "with"])),
    prn: optional(boolean()),
    durationDays: optional(number()),
    rawSig: optional(string()),
  })),
  rawText: optional(string()),
});

/** Validate request body against schema, return parsed data or throw Response */
export async function validateBody<T>(req: Request, schema: Schema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ResponseError(400, "Invalid JSON body");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ResponseError(400, result.error);
  }
  return result.data;
}

/** Standard error class that carries an HTTP status */
export class ResponseError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ResponseError";
  }
}

/** Result envelope for consistent API responses */
export interface ApiResult<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiResult<T> | ApiError;

export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

export function err(message: string): ApiError {
  return { ok: false, error: message };
}