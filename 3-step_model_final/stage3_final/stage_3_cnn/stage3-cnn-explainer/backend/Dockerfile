FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "if [ ! -f /app/assets/best_model_final.keras ]; then echo 'ERROR: Missing model file at /app/assets/best_model_final.keras' >&2; exit 1; fi && uvicorn main:app --host 0.0.0.0 --port 8000"]
