# CPU image — small enough to run on a laptop, no CUDA toolchain.
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/models \
    TRANSFORMERS_CACHE=/models

RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# CPU-only PyTorch keeps the image ~1.2 GB instead of ~6 GB.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Optional: bake the weights into the image so the first request is fast.
#   docker build --build-arg BAKE=1 ...
# (leave unset for a smaller image that downloads once into the HF cache)
ARG BAKE=0
RUN if [ "$BAKE" = "1" ]; then python -c "from transformers import DonutProcessor, VisionEncoderDecoderModel; DonutProcessor.from_pretrained('chinmays18/medical-prescription-ocr'); VisionEncoderDecoderModel.from_pretrained('chinmays18/medical-prescription-ocr')"; fi

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
