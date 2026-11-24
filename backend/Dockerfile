# SafeStride backend image for a Hugging Face Docker Space.
# Build from the backend folder: docker build -t safestride-api backend
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    STREET_GRAPH_PATH=/app/cache/oakland_walk.graphml

# Hugging Face runs Spaces as user 1000, so the app files belong to that user.
RUN useradd --create-home --uid 1000 app
WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY --chown=app:app . .
USER app

# Download the Oakland walking graph once while the image builds, so the
# server starts from the cached file instead of calling OpenStreetMap.
RUN python street_graph.py

EXPOSE 7860

# One worker keeps a single copy of the street graph in memory, and threads
# handle concurrent requests. The long timeout covers the first request
# while the crime scores load.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 8 --timeout 180 app:app"]
