FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 appuser

COPY server_fastapi/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY server_fastapi /app/server_fastapi

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "uvicorn ${BACKEND_ENTRY:-server_fastapi.app:app} --host 0.0.0.0 --port 8000 --proxy-headers"]
