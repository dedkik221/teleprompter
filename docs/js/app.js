const App = (() => {
  const $ = (sel) => document.querySelector(sel);

  function init() {
    Editor.init();
    syncSettingsUI();

    $('#btn-start-prompter').addEventListener('click', enterPrompter);

    // Settings sliders
    $('#set-font-size').addEventListener('input', (e) => {
      Settings.set('fontSize', parseInt(e.target.value));
      $('#val-font-size').textContent = e.target.value;
    });
    $('#set-speed').addEventListener('input', (e) => {
      Settings.set('speed', parseInt(e.target.value));
      $('#val-speed').textContent = e.target.value;
    });
    $('#set-line-spacing').addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 10;
      Settings.set('lineSpacing', val);
      $('#val-line-spacing').textContent = val.toFixed(1);
    });
    $('#set-text-width').addEventListener('input', (e) => {
      Settings.set('textWidth', parseInt(e.target.value));
      $('#val-text-width').textContent = e.target.value;
    });
    $('#set-focus-pos').addEventListener('input', (e) => {
      Settings.set('focusPosition', parseInt(e.target.value));
      $('#val-focus-pos').textContent = e.target.value;
    });

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Settings.set('theme', btn.dataset.theme);
        document.body.dataset.theme = btn.dataset.theme;
      });
    });

    // Custom colors
    $('#set-text-color').addEventListener('input', (e) => {
      Settings.set('customTextColor', e.target.value);
      Settings.set('theme', 'custom');
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      document.body.dataset.theme = 'custom';
      document.documentElement.style.setProperty('--custom-text', e.target.value);
    });
    $('#set-bg-color').addEventListener('input', (e) => {
      Settings.set('customBgColor', e.target.value);
      Settings.set('theme', 'custom');
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      document.body.dataset.theme = 'custom';
      document.documentElement.style.setProperty('--custom-bg', e.target.value);
    });
  }

  function syncSettingsUI() {
    const s = Settings.getAll();
    $('#set-font-size').value = s.fontSize;
    $('#val-font-size').textContent = s.fontSize;
    $('#set-speed').value = s.speed;
    $('#val-speed').textContent = s.speed;
    $('#set-line-spacing').value = Math.round(s.lineSpacing * 10);
    $('#val-line-spacing').textContent = s.lineSpacing.toFixed(1);
    $('#set-text-width').value = s.textWidth;
    $('#val-text-width').textContent = s.textWidth;
    $('#set-focus-pos').value = s.focusPosition;
    $('#val-focus-pos').textContent = s.focusPosition;

    // Activate correct theme button
    document.querySelectorAll('.theme-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === s.theme);
    });
    document.body.dataset.theme = s.theme;

    $('#set-text-color').value = s.customTextColor;
    $('#set-bg-color').value = s.customBgColor;
    if (s.theme === 'custom') {
      document.documentElement.style.setProperty('--custom-text', s.customTextColor);
      document.documentElement.style.setProperty('--custom-bg', s.customBgColor);
    }
  }

  function enterPrompter() {
    const text = Editor.getContent();
    if (!text.trim()) {
      alert('No script content to display.');
      return;
    }
    document.body.dataset.view = 'prompter';
    $('#editor-view').classList.add('hidden');
    $('#prompter-view').classList.remove('hidden');
    Prompter.enter(text);
  }

  function exitPrompter() {
    Prompter.exit();
    document.body.dataset.view = 'editor';
    $('#prompter-view').classList.add('hidden');
    $('#editor-view').classList.remove('hidden');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { enterPrompter, exitPrompter };
})();
