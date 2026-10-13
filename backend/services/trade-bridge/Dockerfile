FROM python:3.12-slim

WORKDIR /app

COPY backend/services/trade-bridge/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/packages/common /app/packages/common
RUN pip install -e /app/packages/common

COPY backend/services/trade-bridge /app/services/trade_bridge

ENV PYTHONPATH=/app

CMD ["python", "-m", "services.trade_bridge.src.main"]
