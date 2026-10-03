import json
from fastapi import WebSocket


class SessionManager:
    def __init__(self):
        self.sessions: dict[str, set[WebSocket]] = {}

    async def connect(self, session_id: str, ws: WebSocket):
        await ws.accept()
        if session_id not in self.sessions:
            self.sessions[session_id] = set()
        self.sessions[session_id].add(ws)

    def disconnect(self, session_id: str, ws: WebSocket):
        if session_id in self.sessions:
            self.sessions[session_id].discard(ws)
            if not self.sessions[session_id]:
                del self.sessions[session_id]

    async def broadcast(self, session_id: str, message: dict, sender: WebSocket):
        if session_id not in self.sessions:
            return
        dead = []
        for ws in self.sessions[session_id]:
            if ws is sender:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.sessions[session_id].discard(ws)


manager = SessionManager()
