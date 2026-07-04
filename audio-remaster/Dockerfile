# CPU-only image with the ffmpeg and DeepFilterNet backends.
# For the heavier backends (clearvoice, resemble) run natively on macOS
# instead — Docker on Apple Silicon has no GPU/MPS access.
#
#   docker build -t audio-remaster .
#   docker run --rm -v "$PWD:/data" -v remaster-models:/root/.cache \
#       audio-remaster /data/lecture.mp4 --backend deepfilternet

FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir deepfilternet soundfile numpy

WORKDIR /app
COPY remaster.py .

ENTRYPOINT ["python", "remaster.py"]
