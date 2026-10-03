const Prompter = (() => {
  const $ = (sel) => document.querySelector(sel);

  let position = 0;
  let playing = false;
  let lastTimestamp = null;
  let animFrameId = null;
  let clockInterval = null;
  let clockSeconds = 0;
  let ws = null;
  let sessionId = null;
  let lanBaseUrl = null;

  const MARKER_RE = /---MARKER:(.+?)---/g;

  function getSpeed() { return Settings.get('speed'); }
  function getFontSize() { return Settings.get('fontSize'); }

  // --- Scroll Engine ---
  // Speed curve: power 1.5 gives finer gradations at low speeds.
  // speed 4 ≈ 8 px/sec, speed 10 ≈ 22 px/sec, speed 20 ≈ 56 px/sec, speed 50 ≈ 213 px/sec.
  function speedToPx(speed) {
    return 0.05 + Math.pow(speed / 50, 1.5) * 3.5;
  }

  function tick(timestamp) {
    if (!playing) return;
    if (lastTimestamp !== null) {
      const delta = (timestamp - lastTimestamp) / 16.667;
      const pxPerFrame = speedToPx(getSpeed());
      position += pxPerFrame * delta;
    }
    lastTimestamp = timestamp;

    const content = $('#prompter-content');
    content.style.transform = `translateY(-${position}px)`;

    const maxScroll = content.scrollHeight - window.innerHeight;
    const progress = Math.min(position / maxScroll * 100, 100);
    document.getElementById('prompter-view').style.setProperty('--progress', progress + '%');

    if (position >= maxScroll) {
      pause();
      return;
    }
    animFrameId = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    playing = true;
    lastTimestamp = null;
    animFrameId = requestAnimationFrame(tick);
    $('#hud-play').textContent = 'Pause';
    $('#hud-play').classList.add('playing');
    startClock();
    sendState();
  }

  function pause() {
    playing = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = null;
    $('#hud-play').textContent = 'Play';
    $('#hud-play').classList.remove('playing');
    stopClock();
    sendState();
  }

  function togglePlay() {
    playing ? pause() : play();
  }

  function reset() {
    pause();
    position = 0;
    $('#prompter-content').style.transform = 'translateY(0)';
    document.getElementById('prompter-view').style.setProperty('--progress', '0%');
    clockSeconds = 0;
    updateClockDisplay();
    sendState();
  }

  // --- Clock ---
  function startClock() {
    if (clockInterval) return;
    clockInterval = setInterval(() => {
      clockSeconds++;
      updateClockDisplay();
    }, 1000);
  }

  function stopClock() {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  function updateClockDisplay() {
    const h = String(Math.floor(clockSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((clockSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(clockSeconds % 60).padStart(2, '0');
    $('#hud-clock').textContent = `${h}:${m}:${s}`;
  }

  // --- Content Setup ---
  function loadContent(text) {
    const content = $('#prompter-content');
    const lines = text.split('\n');
    content.innerHTML = '';

    const markers = [];
    for (const line of lines) {
      const match = line.match(/^---MARKER:(.+?)---$/);
      if (match) {
        const el = document.createElement('div');
        el.className = 'prompter-marker';
        el.textContent = match[1];
        el.dataset.markerLabel = match[1];
        content.appendChild(el);
        markers.push({ label: match[1], element: el });
      } else {
        const el = document.createElement('div');
        el.textContent = line || '\u00A0';
        content.appendChild(el);
      }
    }

    buildMarkerNav(markers);
  }

  function buildMarkerNav(markers) {
    const nav = $('#prompter-markers');
    nav.innerHTML = '';
    markers.forEach((m, i) => {
      const btn = document.createElement('button');
      btn.textContent = `${i + 1}. ${m.label}`;
      btn.addEventListener('click', () => jumpToMarker(m.element));
      nav.appendChild(btn);
    });
  }

  function jumpToMarker(el) {
    const rect = el.getBoundingClientRect();
    const content = $('#prompter-content');
    const currentTransform = getComputedStyle(content).transform;
    let currentY = 0;
    if (currentTransform && currentTransform !== 'none') {
      const matrix = new DOMMatrix(currentTransform);
      currentY = -matrix.m42;
    }
    position = currentY + rect.top - window.innerHeight * (Settings.get('focusPosition') / 100);
    if (position < 0) position = 0;
    content.style.transform = `translateY(-${position}px)`;
    sendState();
  }

  // --- Display Settings ---
  function applySettings() {
    const s = Settings.getAll();
    const content = $('#prompter-content');
    const view = $('#prompter-view');

    content.style.fontSize = s.fontSize + 'px';
    content.style.lineHeight = s.lineSpacing;
    content.style.width = s.textWidth + '%';

    // Focus position drives overlays, padding, and the focus line
    const fp = s.focusPosition; // percent from top (10–90)
    const bandHalf = 12; // half-height of the clear reading band in vh
    content.style.paddingTop = fp + 'vh';
    content.style.paddingBottom = (100 - fp) + 'vh';

    $('#prompter-overlay-top').style.height = Math.max(0, fp - bandHalf) + '%';
    $('#prompter-overlay-bottom').style.height = Math.max(0, (100 - fp) - bandHalf) + '%';
    const fl = $('#prompter-focus-line');
    fl.style.top = fp + '%';
    fl.style.marginTop = '-16px';

    view.classList.toggle('flip-x', s.flipX);
    view.classList.toggle('flip-y', s.flipY);
    view.classList.toggle('dimmed', s.dimmed);

    if (s.theme === 'custom') {
      document.documentElement.style.setProperty('--custom-bg', s.customBgColor);
      document.documentElement.style.setProperty('--custom-text', s.customTextColor);
    }
    document.body.dataset.theme = s.theme;

    $('#hud-speed-val').textContent = s.speed;
    $('#hud-font-val').textContent = s.fontSize;
  }

  function adjustSpeed(delta) {
    let speed = Settings.get('speed') + delta;
    speed = Math.max(1, Math.min(50, speed));
    Settings.set('speed', speed);
    applySettings();
    sendState();
  }

  function adjustFontSize(delta) {
    let size = Settings.get('fontSize') + delta;
    size = Math.max(20, Math.min(120, size));
    Settings.set('fontSize', size);
    applySettings();
  }

  function toggleFlipX() {
    Settings.set('flipX', !Settings.get('flipX'));
    applySettings();
  }

  function toggleFlipY() {
    Settings.set('flipY', !Settings.get('flipY'));
    applySettings();
  }

  function toggleDim() {
    Settings.set('dimmed', !Settings.get('dimmed'));
    applySettings();
  }

  function rewind(lines = 5) {
    pause();
    const lineHeight = Settings.get('fontSize') * parseFloat(Settings.get('lineSpacing'));
    const backPx = lineHeight * lines;
    position = Math.max(0, position - backPx);
    $('#prompter-content').style.transform = `translateY(-${position}px)`;
    const maxScroll = $('#prompter-content').scrollHeight - window.innerHeight;
    const progress = Math.min(position / maxScroll * 100, 100);
    document.getElementById('prompter-view').style.setProperty('--progress', progress + '%');
    sendState();
  }

  function toggleFullscreen() {
    const view = $('#prompter-view');
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      view.requestFullscreen().catch(() => {});
    }
  }

  // --- WebSocket Remote ---
  function generateSessionId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  function connectWebSocket() {
    sessionId = generateSessionId();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws/${sessionId}`);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleRemoteCommand(msg);
      } catch {}
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
  }

  function handleRemoteCommand(msg) {
    switch (msg.type) {
      case 'play': play(); break;
      case 'pause': pause(); break;
      case 'toggle': togglePlay(); break;
      case 'reset': reset(); break;
      case 'rewind': rewind(5); break;
      case 'speed': Settings.set('speed', msg.value); applySettings(); break;
      case 'speed_up': adjustSpeed(1); break;
      case 'speed_down': adjustSpeed(-1); break;
      case 'font_up': adjustFontSize(4); break;
      case 'font_down': adjustFontSize(-4); break;
      case 'flip_x': toggleFlipX(); break;
      case 'flip_y': toggleFlipY(); break;
      case 'dim': toggleDim(); break;
      case 'request_state': sendState(); break;
    }
  }

  function sendState() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const content = $('#prompter-content');
    const maxScroll = content.scrollHeight - window.innerHeight;
    ws.send(JSON.stringify({
      type: 'state',
      playing,
      speed: Settings.get('speed'),
      fontSize: Settings.get('fontSize'),
      progress: maxScroll > 0 ? position / maxScroll : 0,
      position,
    }));
  }

  let hudWakeTimer = null;
  function onHudWake() {
    const hud = $('#prompter-hud');
    if (!hud) return;
    hud.classList.add('hud-active');
    clearTimeout(hudWakeTimer);
    hudWakeTimer = setTimeout(() => {
      hud.classList.remove('hud-active');
    }, 3500);
  }

  function showRemoteModal() {
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    let base = location.origin;
    if (isLocalhost && lanBaseUrl && !lanBaseUrl.includes('10.0.4.')) {
      base = lanBaseUrl;
    }
    const url = `${base}/remote/${sessionId}`;
    $('#remote-url').value = url;
    $('#session-code').textContent = sessionId;
    const container = $('#qr-container');
    container.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(container, { text: url, width: 180, height: 180 });
    }
    $('#remote-modal').classList.remove('hidden');
  }

  // --- Keyboard ---
  function handleKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (document.body.dataset.view !== 'prompter') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        adjustSpeed(1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        adjustSpeed(-1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        adjustFontSize(4);
        break;
      case 'ArrowDown':
        e.preventDefault();
        adjustFontSize(-4);
        break;
      case 'KeyR':
        e.preventDefault();
        reset();
        break;
      case 'Backspace':
      case 'KeyZ':
        e.preventDefault();
        rewind(5);
        break;
      case 'KeyF':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'KeyM':
        e.preventDefault();
        toggleFlipX();
        break;
      case 'KeyD':
        e.preventDefault();
        toggleDim();
        break;
      case 'Escape':
        e.preventDefault();
        App.exitPrompter();
        break;
      default:
        if (e.code >= 'Digit1' && e.code <= 'Digit9') {
          const idx = parseInt(e.code.replace('Digit', '')) - 1;
          const btns = document.querySelectorAll('#prompter-markers button');
          if (btns[idx]) btns[idx].click();
        }
    }
  }

  // --- Draggable Focus Line ---
  let dragging = false;

  function onDragStart(e) {
    e.preventDefault();
    dragging = true;
  }

  function onDragMove(e) {
    if (!dragging) return;
    const y = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    let pct = (y / window.innerHeight) * 100;
    pct = Math.max(10, Math.min(90, Math.round(pct)));
    Settings.set('focusPosition', pct);
    applySettings();
  }

  function onDragEnd() {
    dragging = false;
  }

  // --- Init & Enter/Exit ---
  function enter(text) {
    reset();
    loadContent(text);
    applySettings();
    connectWebSocket();

    // Fetch LAN IP for remote QR code
    fetch('/api/info').then(r => r.json()).then(d => { lanBaseUrl = d.base_url; }).catch(() => {});
    document.addEventListener('keydown', handleKey);

    // Focus line drag
    const fl = $('#prompter-focus-line');
    fl.addEventListener('mousedown', onDragStart);
    fl.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchend', onDragEnd);

    $('#hud-play').addEventListener('click', togglePlay);
    $('#hud-reset').addEventListener('click', reset);
    $('#hud-rewind').addEventListener('click', () => rewind(5));
    $('#hud-flip-x').addEventListener('click', toggleFlipX);
    $('#hud-flip-y').addEventListener('click', toggleFlipY);
    $('#hud-dim').addEventListener('click', toggleDim);
    $('#hud-fullscreen').addEventListener('click', toggleFullscreen);
    $('#hud-exit').addEventListener('click', () => App.exitPrompter());
    $('#hud-remote').addEventListener('click', showRemoteModal);
    document.addEventListener('mousemove', onHudWake);
    document.addEventListener('touchstart', onHudWake);
    $('#modal-close').addEventListener('click', () => $('#remote-modal').classList.add('hidden'));
  }

  function exit() {
    pause();
    dragging = false;
    if (ws) { ws.close(); ws = null; }
    document.removeEventListener('keydown', handleKey);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchend', onDragEnd);
    document.removeEventListener('mousemove', onHudWake);
    document.removeEventListener('touchstart', onHudWake);
    if (document.fullscreenElement) document.exitFullscreen();
  }

  return { enter, exit, togglePlay, reset, rewind, adjustSpeed, adjustFontSize, sendState };
})();
