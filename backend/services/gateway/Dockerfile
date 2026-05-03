FROM python:3.12-slim

WORKDIR /app

COPY backend/services/gateway/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/packages/common /app/packages/common
RUN pip install -e /app/packages/common

COPY backend/services/gateway /app/services/gateway

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "services.gateway.src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
