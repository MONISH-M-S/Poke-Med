"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SAMPLE_RX } from "@/lib/samples";
import { compressImage } from "@/lib/image";
import type { ExtractedMedicine } from "@/lib/types";

type ScanResult = {
  mode: string;
  rawText: string;
  medicines: ExtractedMedicine[];
  message: string | null;
};

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "reading" | "ocr" | "parsing">(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onPick(f: File | null) {
    setError(null);
    setMessage(null);
    setFile(f);
    if (!f) {
      setPreview(null);
      return;
    }
    try {
      setPreview(await compressImage(f));
    } catch {
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

  async function browserOCR(f: File, onProgress: (p: number) => void): Promise<string> {    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") onProgress(m.progress);
      },
    });
    try {
      const { data } = await worker.recognize(f);
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
    return (await res.json()) as ScanResult;
  }

  function store(result: ScanResult, image: string | null) {
    sessionStorage.setItem(
      "pokemed.scan",
      JSON.stringify({ ...result, image, source: file?.name ?? "typed" }),
    );
    router.push("/review");
  }

  async function readImage() {
    if (!file) {
      setError("Choose a photo first, or type the prescription below.");
      return;
    }
    setError(null);
    setMessage(null);
    setBusy("reading");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const first = (await res.json()) as ScanResult;

      let result = first;
      if (first.mode === "needs-text") {
        setBusy("ocr");
        setProgress(0);
        let ocrText = "";
        try {
          ocrText = await browserOCR(file, setProgress);
        } catch {
          throw new Error(
            "Browser OCR could not load (it needs an internet connection the first time). Paste the text below instead.",
          );
        }
        if (!ocrText.trim()) {
          throw new Error("That photo was hard to read. Paste the text below and we'll parse it.");
        }
        setText(ocrText);
        setBusy("parsing");
        result = await postText(ocrText);
        result.message =
          result.medicines.length === 0
            ? "The photo was read, but no medicine line was recognised. Edit the text below and try again."
            : `Read with browser OCR. Check every line before saving.`;
      }

      if (result.medicines.length === 0) {
        setMessage(result.message ?? "No medicines were recognised. You can type them below.");
        if (result.rawText) setText(result.rawText);
        return;
      }

      store(result, preview);
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
      store(result, preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that text.");
    } finally {
      setBusy(null);
    }
  }

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

          <label
            htmlFor="rx-file"
            className="mt-4 flex min-h-[210px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper px-4 py-6 text-center hover:border-brand-500"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Prescription preview" className="max-h-[230px] w-auto rounded-lg object-contain" />
            ) : (
              <>
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
              </>
            )}
            <input
              id="rx-file"
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={readImage} disabled={busy !== null}>
              {busy === "reading" ? "Reading photo…" : busy === "ocr" ? "Reading text…" : "Read prescription"}
            </button>
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
