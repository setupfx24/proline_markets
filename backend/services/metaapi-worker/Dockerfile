FROM python:3.12-slim

WORKDIR /app

COPY backend/services/metaapi-worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/packages/common /app/packages/common
RUN pip install -e /app/packages/common

COPY backend/services/metaapi-worker /app/services/metaapi_worker

ENV PYTHONPATH=/app

CMD ["python", "-m", "services.metaapi_worker.src.main"]
