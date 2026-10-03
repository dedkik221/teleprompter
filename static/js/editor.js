const Editor = (() => {
  let scripts = [];
  let activeId = null;
  let saveTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const $list = () => $('#script-list');
  const $title = () => $('#script-title');
  const $text = () => $('#editor-text');
  const $wordCount = () => $('#word-count');
  const $estDuration = () => $('#est-duration');

  async function loadScripts(preferredId = null) {
    const resp = await fetch('/api/scripts');
    scripts = await resp.json();
    renderList();
    if (preferredId) {
      selectScript(preferredId);
    } else if (scripts.length && !activeId) {
      selectScript(scripts[0].id);
    }
  }

  function renderList() {
    const list = $list();
    list.innerHTML = '';
    for (const s of scripts) {
      const li = document.createElement('li');
      li.dataset.id = s.id;
      if (s.id === activeId) li.classList.add('active');
      const date = s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '';
      li.innerHTML = `
        <div class="script-title">${escapeHtml(s.title)}</div>
        <div class="script-meta">${s.word_count || 0} words &middot; ${date}</div>
      `;
      li.addEventListener('click', () => selectScript(s.id));
      list.appendChild(li);
    }
  }

  async function selectScript(id) {
    activeId = id;
    const resp = await fetch(`/api/scripts/${id}`);
    const script = await resp.json();
    $title().value = script.title;
    $text().innerText = script.content;
    renderList();
    updateStats();
  }

  function updateStats() {
    const text = $text().innerText.trim();
    const words = text ? text.split(/\s+/).length : 0;
    $wordCount().textContent = `${words} words`;
    const minutes = Math.ceil(words / 150);
    $estDuration().textContent = `~${minutes} min`;
  }

  async function saveCurrentScript() {
    if (!activeId) return;
    const content = $text().innerText;
    const title = $title().value.trim() || 'Untitled';
    await fetch(`/api/scripts/${activeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    // Update local metadata without reloading editor text (preserves cursor & focus)
    const idx = scripts.findIndex(s => s.id === activeId);
    if (idx !== -1) {
      scripts[idx].title = title;
      scripts[idx].word_count = content.trim() ? content.trim().split(/\s+/).length : 0;
      scripts[idx].updated_at = new Date().toISOString();
      renderList();
    }
  }

  function debounceSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await saveCurrentScript();
    }, 800);
  }

  async function createNew() {
    const resp = await fetch('/api/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Script', content: '' }),
    });
    const script = await resp.json();
    activeId = script.id;
    await loadScripts(script.id);
    $title().focus();
  }

  async function deleteCurrent() {
    if (!activeId) return;
    if (!confirm('Delete this script?')) return;
    await fetch(`/api/scripts/${activeId}`, { method: 'DELETE' });
    activeId = null;
    $text().innerText = '';
    $title().value = '';
    await loadScripts();
  }

  async function uploadFile(file) {
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch('/api/scripts/import', { method: 'POST', body: form });
    if (!resp.ok) {
      alert('Upload failed: ' + (await resp.json()).detail);
      return;
    }
    const script = await resp.json();
    activeId = script.id;
    await loadScripts(script.id);
  }

  function insertMarker() {
    if (!activeId) return;
    const label = prompt('Marker label:');
    if (!label) return;
    const sel = window.getSelection();
    const text = $text();
    if (!text.contains(sel.anchorNode)) text.focus();
    document.execCommand('insertText', false, `\n---MARKER:${label}---\n`);
    debounceSave();
  }

  function getContent() {
    return $text().innerText;
  }

  function getTitle() {
    return $title().value || 'Untitled';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    $text().addEventListener('input', () => {
      updateStats();
      debounceSave();
    });
    $title().addEventListener('input', debounceSave);
    $('#btn-new').addEventListener('click', createNew);
    $('#btn-delete').addEventListener('click', deleteCurrent);
    $('#btn-add-marker').addEventListener('click', insertMarker);
    $('#file-input').addEventListener('change', (e) => {
      if (e.target.files[0]) uploadFile(e.target.files[0]);
      e.target.value = '';
    });
    loadScripts();
  }

  return { init, getContent, getTitle, loadScripts };
})();
