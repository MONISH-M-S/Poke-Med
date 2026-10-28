"""
Poke-Med local prescription OCR service.

Serves the Donut fine-tune `chinmays18/medical-prescription-ocr` (MIT) over
HTTP so the Next.js app can read handwritten prescriptions without shipping a
0.2B-parameter PyTorch model inside a serverless function.

    pip install -r requirements.txt
    uvicorn app:app --host 0.0.0.0 --port 8001

Then set in the app's .env.local:

    OCR_SERVICE_URL=http://localhost:8001

The model is loaded lazily on the first request (~800 MB download once, then
cached by Hugging Face). `GET /health` reports readiness without loading it.
"""

import io
import os
import threading

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image

MODEL_ID = os.getenv("OCR_MODEL", "chinmays18/medical-prescription-ocr")
SHARED_SECRET = os.getenv("OCR_SHARED_SECRET", "")
MAX_BYTES = 8 * 1024 * 1024

app = FastAPI(title="Poke-Med prescription OCR", version="1.0.0")

_lock = threading.Lock()
_state: dict = {}


def _load():
    """Load the processor and model once, on the first request."""
    if "model" in _state:
        return _state

    with _lock:
        if "model" in _state:
            return _state

        import torch
        from transformers import DonutProcessor, VisionEncoderDecoderModel

        device = "cuda" if torch.cuda.is_available() else "cpu"
        processor = DonutProcessor.from_pretrained(MODEL_ID)
        model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID)
        model.to(device)
        model.eval()

        _state.update(model=model, processor=processor, device=device, torch=torch)
        return _state


def _clean(text: str) -> str:
    for token in ("<s_ocr>", "</s>", "<pad>", "<s>"):
        text = text.replace(token, " ")
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_ID, "loaded": "model" in _state}


@app.post("/ocr")
async def ocr(file: UploadFile = File(...), x_ocr_key: str | None = Header(default=None)):
    if SHARED_SECRET and x_ocr_key != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Bad OCR key.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 8 MB.")

    try:
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=415, detail="That file is not an image we can read.")

    state = _load()
    processor = state["processor"]
    model = state["model"]
    torch = state["torch"]
    device = state["device"]

    pixel_values = processor(images=image, return_tensors="pt").pixel_values.to(device)
    decoder_input_ids = processor.tokenizer("<s_ocr>", return_tensors="pt").input_ids.to(device)

    with torch.no_grad():
        generated = model.generate(
            pixel_values,
            decoder_input_ids=decoder_input_ids,
            max_length=512,
            num_beams=1,
            early_stopping=True,
        )

    text = _clean(processor.batch_decode(generated, skip_special_tokens=True)[0])
    return {"text": text, "model": MODEL_ID, "chars": len(text)}
