"""WebSocket connection manager for real-time trade updates."""
import json
from typing import Optional
from fastapi import WebSocket


class ConnectionManager:
    _instance: Optional["ConnectionManager"] = None
    _connections: dict[str, WebSocket] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._connections = {}
        return cls._instance

    async def connect(self, account_id: str, websocket: WebSocket):
        self._connections[account_id] = websocket

    def disconnect(self, account_id: str):
        self._connections.pop(account_id, None)

    async def send_to_account(self, account_id: str, data: dict):
        ws = self._connections.get(account_id)
        if ws:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                self.disconnect(account_id)

    async def broadcast(self, data: dict):
        disconnected = []
        for account_id, ws in self._connections.items():
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                disconnected.append(account_id)
        for aid in disconnected:
            self.disconnect(aid)

    async def handle_message(self, account_id: str, data: dict):
        msg_type = data.get("type")
        if msg_type == "ping":
            await self.send_to_account(account_id, {"type": "pong"})
        elif msg_type == "subscribe":
            pass
