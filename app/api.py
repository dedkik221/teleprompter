import re
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from . import storage


router = APIRouter(prefix="/api")


class ScriptCreate(BaseModel):
    title: str = "Untitled"
    content: str = ""


class ScriptUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    markers: list[dict] | None = None


def _sanitize_text(text: str) -> str:
    return re.sub(r'<[^>]+>', '', text)


@router.get("/scripts")
def list_scripts():
    return storage.list_scripts()


@router.post("/scripts")
def create_script(body: ScriptCreate):
    return storage.create_script(title=body.title, content=body.content)


@router.get("/scripts/{script_id}")
def get_script(script_id: str):
    script = storage.get_script(script_id)
    if not script:
        raise HTTPException(404, "Script not found")
    return script


@router.put("/scripts/{script_id}")
def update_script(script_id: str, body: ScriptUpdate):
    updates = body.model_dump(exclude_none=True)
    script = storage.update_script(script_id, updates)
    if not script:
        raise HTTPException(404, "Script not found")
    return script


@router.delete("/scripts/{script_id}")
def delete_script(script_id: str):
    if not storage.delete_script(script_id):
        raise HTTPException(404, "Script not found")
    return {"ok": True}


@router.post("/scripts/import")
async def import_script(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".txt"):
        raise HTTPException(400, "Only .txt files are accepted")
    raw = await file.read()
    if len(raw) > 1_000_000:
        raise HTTPException(400, "File too large (max 1MB)")
    content = _sanitize_text(raw.decode("utf-8", errors="replace"))
    title = file.filename.rsplit(".", 1)[0]
    return storage.create_script(title=title, content=content)
