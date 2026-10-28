"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SAMPLE_RX } from "@/lib/samples";
import { compressImage } from "@/lib/image";
import type { ExtractedMedicine } from "@/lib/types";

type IgnoredLine = { line: string; reason: string };

type ScanResult = {
  mode: string;
  rawText: string;
  medicines: ExtractedMedicine[];
  ignored?: IgnoredLine[];
  message: string | null;
};

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Prepare a canvas for OCR. A crop is upscaled and given a grayscale contrast
 * stretch: prescription photos are usually small, unevenly lit phone snaps.
 */
async function ocrCanvas(file: File, crop: Rect | null): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const sx = crop ? Math.round(crop.x * bitmap.width) : 0;
  const sy = crop ? Math.round(crop.y * bitmap.height) : 0;
  const sw = crop ? Math.max(16, Math.round(crop.w * bitmap.width)) : bitmap.width;
  const sh = crop ? Math.max(16, Math.round(crop.h * bitmap.height)) : bitmap.height;

  const scale = crop ? Math.min(4, Math.max(2, 1600 / sw)) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  if (crop) {
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    const histogram = new Uint32Array(256);
    const lum = new Uint8ClampedArray(canvas.width * canvas.height);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const value = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      lum[p] = value;
      histogram[value] += 1;
    }

    const pick = (fraction: number) => {
      let seen = 0;
      for (let v = 0; v < 256; v += 1) {
        seen += histogram[v];
        if (seen >= lum.length * fraction) return v;
      }
      return 255;
    };

    const low = pick(0.02);
    const high = pick(0.98);
    const span = Math.max(1, high - low);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const stretched = Math.max(0, Math.min(255, Math.round(((lum[p] - low) / span) * 255)));
      data[i] = stretched;
      data[i + 1] = stretched;
      data[i + 2] = stretched;
    }
    ctx.putImageData(frame, 0, 0);
  }

  return canvas;
}

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const fileValue = useRef<File | null>(null);
  const previewValue = useRef<string | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragRect = useRef<Rect | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<Rect | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "reading" | "ocr" | "parsing">(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onPick(f: File | null) {
    setError(null);
    setMessage(null);
    fileValue.current = f;
    setFile(f);
    setCrop(null);
    setDrag(null);
    dragRect.current = null;
    if (!f) {
      previewValue.current = null;
      setPreview(null);
      return;
    }
    try {
      const next = await compressImage(f);
      // Keep the ref in step with the state: a fast second click can run
      // readImage before React has committed setPreview, and that used to
      // store the scan with no photo.
      previewValue.current = next;
      setPreview(next);
    } catch {
      previewValue.current = null;
      setPreview(null);
    }
  }

  async function loadSamplePhoto() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/sample-prescription.png");
      if (!res.ok) throw new Error("The sample photo is missing.");
      const blob = await res.blob();
      await onPick(new File([blob], "sample-prescription.png", { type: "image/png" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the sample photo.");
    }
  }

  async function browserOCR(f: File, area: Rect | null, onProgress: (p: number) => void): Promise<string> {
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") onProgress(m.progress);
      },
    });
    try {
      const canvas = await ocrCanvas(f, area);
      await worker.setParameters({
        // A dragged box is one block of lines; a whole page is sparse text.
        tessedit_pageseg_mode: area ? PSM.SINGLE_BLOCK : PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
      });
      let { data } = await worker.recognize(canvas);
      if (!data.text.trim() && !area) {
        // Some landscape photos contain no block for the auto layout engine.
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
        ({ data } = await worker.recognize(canvas));
      }
      return data.text;
    } finally {
      await worker.terminate();
    }
  }

  async function postText(value: string) {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value }),
    });
    const data = (await res.json()) as ScanResult & { error?: string };
    if (!res.ok || !Array.isArray(data.medicines)) {
      throw new Error(data.error || "Could not read that text.");
    }
    return data;
  }

  function store(result: ScanResult, image: string | null) {
    sessionStorage.setItem(
      "pokemed.scan",
      JSON.stringify({ ...result, image, source: fileValue.current?.name ?? "typed" }),
    );
    router.push("/review");
  }

  async function readImage() {
    const photo = fileValue.current;
    if (!photo) {
      setError("Choose a photo first, or type the prescription below.");
      return;
    }
    setError(null);
    setMessage(null);
    setBusy("reading");
    try {
      const form = new FormData();
      form.append("file", photo);
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const first = (await res.json()) as ScanResult & { error?: string };
      if (!res.ok || !Array.isArray(first.medicines)) {
        throw new Error(first.error || "Could not read that photo.");
      }

      let result = first;
      if (first.mode === "needs-text") {
        // Try the dragged box first; if it yields nothing, try the whole page.
        const passes: (Rect | null)[] = crop ? [crop, null] : [null];
        let best: { text: string; result: ScanResult } | null = null;

        for (const area of passes) {
          setBusy("ocr");
          setProgress(0);
          let ocrText = "";
          try {
            ocrText = await browserOCR(photo, area, setProgress);
          } catch {
            if (area === crop) continue;
            throw new Error(
              "Browser OCR could not load (it needs an internet connection the first time). Paste the text below instead.",
            );
          }
          if (!ocrText.trim()) continue;

          setBusy("parsing");
          const parsed = await postText(ocrText);
          if (!best || parsed.medicines.length > best.result.medicines.length) {
            best = { text: ocrText, result: parsed };
          }
          if (parsed.medicines.length > 0) break;
        }

        if (!best) {
          throw new Error("That photo was hard to read. Paste the text below and we'll parse it.");
        }

        setText(best.text);
        result = best.result;

        const ignoredNote =
          result.ignored && result.ignored.length > 0
            ? ` ${result.ignored.length} hospital-only or non-medicine line${
                result.ignored.length === 1 ? " was" : "s were"
              } not scheduled.`
            : "";

        result.message =
          result.medicines.length === 0
            ? "The photo was read, but no medicine line was recognised. This usually means handwriting or a blurry photo — edit the text below and try again." +
              ignoredNote
            : `Read with browser OCR. Check every line before saving.${ignoredNote}`;
      }

      if (result.medicines.length === 0) {
        setMessage(result.message ?? "No medicines were recognised. You can type them below.");
        if (result.rawText) setText(result.rawText);
        return;
      }

      store(result, previewValue.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while reading the photo.");
    } finally {
      setBusy(null);
    }
  }

  async function readText() {
    if (!text.trim()) {
      setError("Type or paste the prescription first.");
      return;
    }
    setError(null);
    setBusy("parsing");
    try {
      const result = await postText(text);
      if (result.medicines.length === 0) {
        setMessage(result.message ?? "No medicine line found. Try one medicine per line.");
        return;
      }
      store(result, previewValue.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that text.");
    } finally {
      setBusy(null);
    }
  }

  function fraction(event: React.PointerEvent<HTMLDivElement>) {
    const element = previewRef.current;
    if (!element) return { x: 0, y: 0 };
    const box = element.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    };
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!preview) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = fraction(event);
    dragStart.current = point;
    dragRect.current = { x: point.x, y: point.y, w: 0, h: 0 };
    setDrag(dragRect.current);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const point = fraction(event);
    const start = dragStart.current;
    const rect = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    };
    dragRect.current = rect;
    setDrag(rect);
  }

  function endDrag() {
    const rect = dragRect.current;
    if (rect && rect.w > 0.04 && rect.h > 0.02) setCrop(rect);
    dragStart.current = null;
    dragRect.current = null;
    setDrag(null);
  }

  const shown = drag ?? crop;

  return (
    <div className="container-app py-8">
      <div className="max-w-2xl">
        <p className="label">Step 1 of 3</p>
        <h1 className="h1 mt-1">Add a prescription</h1>
        <p className="muted mt-2">
          Photograph the prescription, or type it in. We read the medicine, dose and timing, and you confirm every
          line before anything is saved.
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Photo */}
        <section className="card p-5 sm:p-6">
          <h2 className="h2">Photo</h2>
          <p className="muted mt-1">Printed prescriptions work best. Handwriting is read on a best-effort basis.</p>

          <div className="mt-4 flex min-h-[210px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-paper px-4 py-5">
            {preview ? (
              <>
                <div
                  className="relative inline-block touch-none select-none"
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    id="rx-preview"
                    ref={previewRef}
                    src={preview}
                    alt="Prescription preview"
                    draggable={false}
                    className="block max-h-[260px] w-auto rounded-lg bg-white object-contain"
                  />
                  {shown && (
                    <div
                      className="pointer-events-none absolute rounded border-2 border-brand-600 bg-brand-600/10"
                      style={{
                        left: `${shown.x * 100}%`,
                        top: `${shown.y * 100}%`,
                        width: `${shown.w * 100}%`,
                        height: `${shown.h * 100}%`,
                      }}
                    />
                  )}
                </div>
                <p className="mt-2 text-center text-[11px] leading-snug text-muted">
                  {crop ? (
                    <>
                      Reading just the box.{" "}
                      <button
                        type="button"
                        onClick={() => setCrop(null)}
                        className="font-semibold text-brand-700 underline underline-offset-2"
                      >
                        Read the whole page
                      </button>
                    </>
                  ) : (
                    <>Drag a box around the medicine lines — small print reads much better.</>
                  )}
                </p>
              </>
            ) : (
              <label
                htmlFor="rx-file"
                className="flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-brand-700 shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1-1.6h5.6L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </span>
                <span className="text-sm font-semibold text-ink">Choose a photo</span>
                <span className="text-xs text-muted">JPG or PNG, taken straight on</span>
              </label>
            )}

            <input
              id="rx-file"
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={readImage} disabled={busy !== null}>
              {busy === "reading" ? "Reading photo…" : busy === "ocr" ? "Reading text…" : "Read prescription"}
            </button>
            {file && (
              <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                Change photo
              </button>
            )}
            {file && (
              <button className="btn-ghost" onClick={() => onPick(null)} disabled={busy !== null}>
                Clear
              </button>
            )}
            <button className="btn-ghost" onClick={loadSamplePhoto} disabled={busy !== null}>
              Load sample photo
            </button>
          </div>

          {busy === "ocr" && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">Reading the photo in your browser…</p>
            </div>
          )}
          {busy === "parsing" && <p className="mt-2 text-xs text-muted">Finding the medicines…</p>}

          <p className="mt-4 text-[11px] leading-snug text-muted">
            The photo is read on this device or by the configured vision service. No real patient data should be used
            in this prototype.
          </p>
        </section>

        {/* Text */}
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="h2">Or type it</h2>
            <button
              className="text-sm font-semibold text-brand-700 hover:underline"
              onClick={() => {
                setText(SAMPLE_RX);
                setError(null);
              }}
            >
              Use a sample
            </button>
          </div>
          <p className="muted mt-1">
            One medicine per line, shorthand and all. <code className="rounded bg-paper px-1">1-0-1 PC</code> works
            exactly like on paper.
          </p>
          <textarea
            className="field mt-3 h-[210px] font-mono text-[13px] leading-6"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Tab. Metformin 500mg   1-0-1 PC   x 30 days\nTab. Amlodipine 5mg    1-0-0 AC   x 30 days"}
            spellCheck={false}
          />
          <button className="btn-primary mt-3" onClick={readText} disabled={busy !== null}>
            Read these lines
          </button>
        </section>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-alert">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warn">{message}</div>
      )}

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
        PokéMed reads what is written and builds a schedule. It does not decide whether a medicine is right for
        anyone. Decision support, not medical advice.
      </p>
    </div>
  );
}
