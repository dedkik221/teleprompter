import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(os.environ.get("DATA_DIR", "./data"))
SCRIPTS_DIR = DATA_DIR / "scripts"
WATCH_DIR = os.environ.get("WATCH_DIR", "")
MANIFEST_PATH = DATA_DIR / ".watch_manifest.json"


def _ensure_dirs():
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)


def _script_path(script_id: str) -> Path:
    safe_id = script_id.replace("/", "").replace("..", "")
    return SCRIPTS_DIR / f"{safe_id}.json"


def list_scripts() -> list[dict]:
    _ensure_dirs()
    scripts = []
    for f in SCRIPTS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            scripts.append({
                "id": data["id"],
                "title": data.get("title", "Untitled"),
                "updated_at": data.get("updated_at", ""),
                "word_count": len(data.get("content", "").split()),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    scripts.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
    return scripts


def get_script(script_id: str) -> dict | None:
    _ensure_dirs()
    path = _script_path(script_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, KeyError):
        return None


def create_script(title: str = "Untitled", content: str = "") -> dict:
    _ensure_dirs()
    now = datetime.now(timezone.utc).isoformat()
    script = {
        "id": uuid.uuid4().hex[:12],
        "title": title,
        "content": content,
        "markers": [],
        "created_at": now,
        "updated_at": now,
    }
    _script_path(script["id"]).write_text(json.dumps(script, indent=2))
    return script


def update_script(script_id: str, updates: dict) -> dict | None:
    script = get_script(script_id)
    if not script:
        return None
    for key in ("title", "content", "markers"):
        if key in updates:
            script[key] = updates[key]
    script["updated_at"] = datetime.now(timezone.utc).isoformat()
    _script_path(script_id).write_text(json.dumps(script, indent=2))
    return script


def delete_script(script_id: str) -> bool:
    path = _script_path(script_id)
    if path.exists():
        path.unlink()
        return True
    return False


# --- Watch folder sync ---

def _load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_manifest(manifest: dict):
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))


def _file_fingerprint(path: Path) -> str:
    stat = path.stat()
    return hashlib.md5(f"{path.name}:{stat.st_size}:{stat.st_mtime_ns}".encode()).hexdigest()


def sync_watch_dir():
    """Scan WATCH_DIR for .txt/.md files and import new/changed ones as scripts."""
    if not WATCH_DIR:
        return
    watch = Path(WATCH_DIR)
    if not watch.is_dir():
        return

    _ensure_dirs()
    manifest = _load_manifest()
    changed = False

    for ext in ("*.txt", "*.md"):
        for fpath in watch.glob(ext):
            if fpath.name.startswith("."):
                continue
            fp = _file_fingerprint(fpath)
            entry = manifest.get(fpath.name)

            script_id = entry.get("script_id") if entry else None
            if entry and entry.get("fingerprint") == fp and script_id and _script_path(script_id).exists():
                continue  # unchanged and file exists on disk

            try:
                content = fpath.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue

            title = fpath.stem
            script_id = entry.get("script_id") if entry else None

            if script_id:
                # Update existing
                update_script(script_id, {"title": title, "content": content})
                logger.info("Updated watched script: %s", title)
            else:
                # Create new
                script = create_script(title=title, content=content)
                script_id = script["id"]
                logger.info("Imported watched script: %s", title)

            manifest[fpath.name] = {"script_id": script_id, "fingerprint": fp}
            changed = True

    if changed:
        _save_manifest(manifest)
