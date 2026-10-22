import { NextResponse } from "next/server";
import { parsePrescription } from "@/lib/parse/sig";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  // Path 1: text was supplied (pasted, or read by browser OCR)
  if (contentType.includes("application/json")) {
    const { text } = (await req.json()) as { text?: string };
    if (!text?.trim()) {
      return NextResponse.json({ error: "No prescription text supplied." }, { status: 400 });
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
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No image supplied." }, { status: 400 });
  }

  try {
    const rawText = await visionTranscribe(file);
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
    message:
      "No vision key is configured, so the image will be read in the browser with OCR.",
  });
}
