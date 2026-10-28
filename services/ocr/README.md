# Prescription OCR service

Runs [`chinmays18/medical-prescription-ocr`](https://huggingface.co/chinmays18/medical-prescription-ocr)
— a Donut-base fine-tune for handwritten prescriptions (MIT, ~0.2B params,
reported 71% character / 84% word accuracy) — behind a small HTTP API.

The Next.js app stays deployable to Vercel: when `OCR_SERVICE_URL` is unset it
uses the OpenAI vision key, then the browser's Tesseract fallback. When it is
set, `/api/scan` asks this service first.

## Run it

```bash
cd services/ocr
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001
```

First request downloads the weights (~800 MB). Check readiness:

```bash
curl http://localhost:8001/health
# {"ok":true,"model":"chinmays18/medical-prescription-ocr","loaded":false}
```

## Docker

```bash
docker build -t pokemed-ocr .
docker run -p 8001:8001 pokemed-ocr
```

## Wire it to the app

In `C:\POKE-MED\.env.local`:

```env
OCR_SERVICE_URL=http://localhost:8001
# optional, if you started the service with OCR_SHARED_SECRET
OCR_SHARED_SECRET=
```

Restart `npm run dev`, upload a photo, and the route reports `mode: "vision"`
with the model's transcription.

## API

`POST /ocr` — multipart `file`, returns `{ text, model, chars }`.
`GET /health` — `{ ok, model, loaded }`.

## Limits

- English handwriting; Indian brand names and shorthand (`1-0-1`, `BD`) are
  still decoded by the existing `lib/parse/sig.ts`, not by the model.
- Not validated for clinical use — the review screen stays mandatory.
- No GPU: expect a few seconds per prescription on CPU.
