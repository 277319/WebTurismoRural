FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# Aplica las migraciones pendientes antes de arrancar. nginx le reenvía las cabeceras X-Forwarded-*
# y le quita el prefijo /api: --root-path hace que /docs pida /api/openapi.json
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*' --root-path /api"]
