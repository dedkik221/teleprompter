import asyncio
import logging
import os
import socket
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .api import router as api_router
from .ws import manager
from . import storage

logger = logging.getLogger(__name__)


async def _watch_loop():
    """Periodically sync the watch directory (every 60s)."""
    while True:
        await asyncio.sleep(60)
        try:
            storage.sync_watch_dir()
        except Exception as e:
            logger.warning("Watch sync error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.sync_watch_dir()
    task = asyncio.create_task(_watch_loop())
    yield
    task.cancel()


def _get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


app = FastAPI(title="implicator.ai teleprompter", lifespan=lifespan)
app.include_router(api_router)

STATIC_DIR = Path(__file__).parent.parent / "static"


@app.get("/api/info")
async def info(request: Request):
    base_url = os.environ.get("BASE_URL", "")
    if not base_url:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
        if host:
            base_url = f"{proto}://{host}"
        else:
            port = request.url.port or 8800
            base_url = f"http://{_get_lan_ip()}:{port}"
    return {"base_url": base_url}


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/remote")
@app.get("/remote/{code}")
async def remote(code: str = ""):
    return FileResponse(STATIC_DIR / "remote.html")


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(session_id, data, websocket)
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
    except Exception:
        manager.disconnect(session_id, websocket)


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
