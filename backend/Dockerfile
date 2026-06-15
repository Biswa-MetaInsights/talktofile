FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as non-root.
RUN useradd -m -u 10001 appuser && chown -R appuser /app
USER appuser

EXPOSE 9099

# IMPORTANT: exactly ONE worker. Sessions, FAISS indexes and guest accounts live
# in process memory, so multiple workers would not share state. Scale vertically.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9099", "--workers", "1"]
