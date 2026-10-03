# implicator.ai teleprompter

> **Онлайн-версия (без сервера):** https://dedkik221.github.io/teleprompter/
> Папка `docs/` — сборка для GitHub Pages: тексты хранятся в браузере (localStorage), пульт с телефона там отключён (ему нужен сервер).
> Полная версия с пультом — `docker compose up -d`, порт 8800.


A self-hosted, browser-based teleprompter with easy remote control via phone — built for creators who want full control over their tools.

![Python](https://img.shields.io/badge/python-3.11+-c4956a?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/fastapi-0.109+-c4956a?style=flat-square&logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-c4956a?style=flat-square)

---

## Features

**Core Teleprompter**
- Smooth auto-scrolling via `requestAnimationFrame` + GPU-composited `translateY` — no jank, any refresh rate
- Adjustable speed with a power-curve that gives fine control at low speeds
- Draggable focus line with reading guide overlays
- Mirror/flip (X and Y axes) for beam-splitter setups
- Fullscreen mode, dim controls, elapsed time clock
- Script markers for section navigation
- Configurable keyboard shortcuts

**Script Management**
- Create, edit, rename, delete scripts in the browser
- Upload `.txt` files
- Watch folder auto-import — drop files in a directory, they appear as scripts (pairs perfectly with Syncthing, Dropbox, or any file sync tool)
- Server-side persistence as JSON files

**Remote Control**
- Control the prompter from your phone via WebSocket
- QR code for instant pairing — scan and go
- Auto-detects the server's LAN IP so the QR works across devices
- Play/pause, speed, font size, flip, dim — all from the remote

**5 Color Themes**
- Classic (white on black)
- Amber (warm gold on black)
- Paper (warm cream)
- High Contrast (yellow on black)
- Sepia — plus fully custom text/background color pickers

**Design**
- Warm "Studio" aesthetic — DM Sans, Newsreader serif, JetBrains Mono
- Burnished copper accent palette
- Refined sliders, grain texture, custom scrollbars

---

## Quick Start

```bash
# Clone
git clone https://github.com/marcus-cali/teleprompter.git
cd teleprompter

# Install
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run
uvicorn app.main:app --host 0.0.0.0 --port 8800
```

Open **http://localhost:8800** in your browser.

To access from other devices on your network, use your machine's LAN IP (e.g., `http://192.168.x.x:8800`).

---

## Configuration

All configuration is via environment variables. Create a `.env` file or set them directly:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8800` | Server port |
| `DATA_DIR` | `./data` | Where scripts are stored (JSON files) |
| `WATCH_DIR` | *(empty)* | Folder to watch for `.txt`/`.md` auto-import |
| `BASE_URL` | *(auto-detected)* | Override the LAN URL shown in QR codes |

### Watch Folder (Auto-Import)

Point `WATCH_DIR` at a folder synced by Syncthing, Dropbox, or similar:

```bash
WATCH_DIR=/path/to/your/scripts uvicorn app.main:app --host 0.0.0.0 --port 8800
```

Any `.txt` or `.md` files in that folder will automatically appear as scripts. The app checks for new/changed files every 60 seconds.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `→` / `Page Down` | Speed up |
| `←` / `Page Up` | Speed down |
| `↑` | Font size up |
| `↓` | Font size down |
| `R` | Reset to top |
| `F` | Toggle fullscreen |
| `M` | Mirror (flip X) |
| `D` | Dim controls |
| `Esc` | Exit to editor |
| `1`–`9` | Jump to marker 1–9 |

The focus line is **draggable** — grab it and move it up or down to reposition where you read.

---

## Deployment

The app is designed to run on a lightweight Linux server (VM, container, or bare metal).

### Proxmox LXC / Any Linux Server

```bash
# On the server
apt update && apt install -y python3 python3-venv
useradd -r -s /bin/false teleprompter
mkdir -p /opt/teleprompter/data
chown -R teleprompter:teleprompter /opt/teleprompter

# Deploy from your machine
DEPLOY_HOST=root@your-server-ip ./scripts/deploy.sh
```

A systemd unit file is included at `systemd/teleprompter.service`. Copy it and enable:

```bash
cp /opt/teleprompter/systemd/teleprompter.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now teleprompter
```

Create `/etc/teleprompter.env`:
```
DATA_DIR=/opt/teleprompter/data
WATCH_DIR=/opt/teleprompter/watch
```

### Reverse Proxy (Optional)

If you want HTTPS or external access, put it behind Nginx, Caddy, or Nginx Proxy Manager. Make sure WebSocket support is enabled for the `/ws/` path.

---

## Project Structure

```
teleprompter/
├── app/
│   ├── main.py          # FastAPI app, routes, WebSocket, lifespan
│   ├── api.py           # REST API: script CRUD + file upload
│   ├── storage.py       # JSON file storage + watch folder sync
│   └── ws.py            # WebSocket session manager
├── static/
│   ├── index.html       # Main SPA (editor + prompter)
│   ├── remote.html      # Mobile remote control
│   ├── css/
│   │   ├── main.css     # Editor layout, warm dark theme
│   │   ├── prompter.css # Prompter display, overlays, HUD, themes
│   │   └── remote.css   # Mobile remote styles
│   └── js/
│       ├── app.js       # View switching, settings UI
│       ├── editor.js    # Script sidebar, editing, markers
│       ├── prompter.js  # Scroll engine, keyboard, WebSocket, QR
│       └── settings.js  # localStorage persistence
├── systemd/
│   └── teleprompter.service
├── scripts/
│   └── deploy.sh
└── requirements.txt
```

---

## Tech Stack

- **Backend**: Python / FastAPI / uvicorn
- **Frontend**: Vanilla HTML, CSS, JavaScript — no build step, no framework
- **Scroll engine**: `requestAnimationFrame` + `transform: translateY()` — GPU-composited, delta-time normalized
- **Remote control**: Native WebSocket (no Socket.IO dependency)
- **Storage**: JSON files on disk
- **Typography**: DM Sans, Newsreader, JetBrains Mono (Google Fonts)

---

## License

MIT
