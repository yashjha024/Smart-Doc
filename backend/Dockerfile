FROM python:3.12-slim

WORKDIR /app

# Ghostscript gives the best PDF compression; without it the app falls back to PyMuPDF.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (see .dockerignore for what is excluded)
COPY . .

ENV PYTHONUNBUFFERED=1

# Hosts like Railway set $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
