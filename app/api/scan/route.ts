import { NextResponse } from "next/server";
import { parsePrescription } from "@/lib/parse/sig";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A prescription photo is a few hundred KB. Anything large is refused before
 *  it is read into memory, base64-encoded, or sent to a vision model. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 100_000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];

const PROMPT = `Transcribe the medicine lines on this prescription exactly as written, for a pharmacist to check.
Rules:
- Output one medicine per line, in the order written. Keep the line breaks.
- Start at the first medicine. Leave out the clinic letterhead, patient name, diagnosis, advice and signature.
- Preserve the doctor's shorthand exactly: 1-0-1, OD, BD, TDS, QID, HS, SOS, STAT, PC, AC, x 30 days, 8hrly.
- Keep brand names, strengths and routes as written, including IV, IM and Inj.
- If a word is unreadable, write [illegible] in its place. Never guess a drug name.
- Do not explain, translate, summarise or add advice.`;

async function visionTranscribe(file: File): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mime = file.type || "image/jpeg";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || null;
}

/**
 * Optional local OCR microservice (services/ocr). Handwriting needs a model,
 * and a 0.2B-parameter Donut will not fit in a Vercel function — so it runs
 * separately and this route falls back cleanly when it is not configured.
 */
async function serviceTranscribe(file: File): Promise<string | null> {
  const base = process.env.OCR_SERVICE_URL?.replace(/\/+$/, "");
  if (!base) return null;

  try {
    const form = new FormData();
    const buffer = Buffer.from(await file.arrayBuffer());
    form.append(
      "file",
      new Blob([buffer], { type: file.type || "image/jpeg" }),
      file.name || "prescription.jpg",
    );

    const headers: Record<string, string> = {};
    const secret = process.env.OCR_SHARED_SECRET;
    if (secret) headers["x-ocr-key"] = secret;

    const res = await fetch(`${base}/ocr`, {
      method: "POST",
      body: form,
      headers,
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { text?: string };
    return data.text?.trim() || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  const declaredLength = Number(req.headers.get("content-length") ?? 0);

  // Refuse an oversized body before formData/json buffers it into memory.
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "That upload is too large. Try a photo under 8 MB." }, { status: 413 });
  }

  // Path 1: text was supplied (pasted, or read by browser OCR)
  if (contentType.includes("application/json")) {
    let body: { text?: unknown };
    try {
      body = (await req.json()) as { text?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "No prescription text supplied." }, { status: 400 });
    }
    if (text.length > MAX_TEXT_CHARS) {
      return NextResponse.json({ error: "That text is too long to read." }, { status: 413 });
    }
    const { medicines, ignored } = parsePrescription(text);
    return NextResponse.json({
      mode: "text",
      rawText: text,
      medicines,
      ignored,
      message:
        medicines.length === 0
          ? "We could not find a medicine line in that text. Try one medicine per line."
          : null,
    });
  }

  // Path 2: an image was uploaded
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No image supplied." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Try one under 8 MB." }, { status: 413 });
  }
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return NextResponse.json({ error: "That file is not an image we can read." }, { status: 415 });
  }

  try {
    const rawText = (await serviceTranscribe(file)) ?? (await visionTranscribe(file));
    if (rawText) {
      const { medicines, ignored } = parsePrescription(rawText);
      return NextResponse.json({
        mode: "vision",
        rawText,
        medicines,
        ignored,
        message:
          medicines.length === 0
            ? "The vision service returned text, but no medicine line was recognised. Check the text below."
            : null,
      });
    }
  } catch {
    // fall through to the honest message below
  }

  return NextResponse.json({
    mode: "needs-text",
    rawText: "",
    medicines: [],
    ignored: [],
    message: process.env.OCR_SERVICE_URL
      ? "The prescription OCR service could not read that photo, so it will be read in the browser instead."
      : "No vision key is configured, so the image will be read in the browser with OCR.",
  });
}
