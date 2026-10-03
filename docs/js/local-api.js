// Browser-only backend for the GitHub Pages build.
// Emulates /api/scripts* with localStorage; the phone remote needs the server and is disabled here.
(() => {
  const KEY = 'teleprompter_scripts';
  const SAMPLE = "Добрый день! Сегодня мы поговорим о том, как AI меняет медиа-производство.\n\n===\n\nПервый блок: автоматический монтаж. Мы используем транскрипцию, LLM-рассуждение и генерацию EDL. Это позволяет сократить время чернового монтажа с часов до минут.\n\n===\n\nВторой блок: аудиоанализ. WhisperX даёт миллисекундную точность таймкодов. Audio Atlas находит синхронные точки на разных дорожках.\n\n===\n\nТретий блок: визуальный контроль. LLM видит только транскрипт, но может запросить кадр через visual_tool, если нужно оценить композицию или дубль.\n\n===\n\nЧетвёртый блок: самооценка. После рендера LLM проверяет свой монтаж по трём критериям: хронология событий, динамика сцен, чистота аудиодорожки.\n\n===\n\nВопросы?\n";

  const now = () => new Date().toISOString();
  const newId = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const t = now();
    const seed = { id: newId(), title: 'Пример лекции', content: SAMPLE, markers: [], created_at: t, updated_at: t };
    const db = { [seed.id]: seed };
    save(db);
    return db;
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
  }
  function create(title, content) {
    const db = load();
    const t = now();
    const s = { id: newId(), title: title || 'Untitled', content: content || '', markers: [], created_at: t, updated_at: t };
    db[s.id] = s;
    save(db);
    return s;
  }
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  async function handle(path, opts) {
    const method = (opts.method || 'GET').toUpperCase();
    const db = load();
    if (path === '/api/info') return json({ base_url: location.origin });
    if (path === '/api/scripts' && method === 'GET') {
      const list = Object.values(db).map(s => ({ id: s.id, title: s.title, updated_at: s.updated_at, word_count: words(s.content) }));
      list.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
      return json(list);
    }
    if (path === '/api/scripts' && method === 'POST') {
      const body = JSON.parse(opts.body || '{}');
      return json(create(body.title, body.content));
    }
    if (path === '/api/scripts/import' && method === 'POST') {
      const file = opts.body.get('file');
      if (!file || !file.name.endsWith('.txt')) return json({ detail: 'Only .txt files are accepted' }, 400);
      if (file.size > 1000000) return json({ detail: 'File too large (max 1MB)' }, 400);
      const text = (await file.text()).replace(/<[^>]+>/g, '');
      return json(create(file.name.replace(/\.[^.]+$/, ''), text));
    }
    const m = path.match(/^\/api\/scripts\/([^/]+)$/);
    if (m) {
      const s = db[m[1]];
      if (!s) return json({ detail: 'Script not found' }, 404);
      if (method === 'GET') return json(s);
      if (method === 'PUT') {
        const body = JSON.parse(opts.body || '{}');
        for (const k of ['title', 'content', 'markers']) if (body[k] != null) s[k] = body[k];
        s.updated_at = now();
        save(db);
        return json(s);
      }
      if (method === 'DELETE') {
        delete db[m[1]];
        save(db);
        return json({ ok: true });
      }
    }
    return json({ detail: 'Not found' }, 404);
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = (input, opts = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api/')) return handle(url, opts);
    return realFetch(input, opts);
  };

  // No server here: give the prompter an inert socket so it does not retry forever.
  const RealWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    if (String(url).includes('/ws/')) {
      return { readyState: 3, send() {}, close() {}, onmessage: null, onclose: null };
    }
    return new RealWS(url, protocols);
  };
  window.WebSocket.OPEN = 1;
  window.WebSocket.CLOSED = 3;
})();
