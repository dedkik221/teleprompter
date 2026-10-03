const Settings = (() => {
  const DEFAULTS = {
    fontSize: 60,
    speed: 10,
    lineSpacing: 1.4,
    textWidth: 70,
    focusPosition: 50,
    theme: 'classic',
    customTextColor: '#e8ecf0',
    customBgColor: '#0c0d0f',
    flipX: false,
    flipY: false,
    dimmed: false,
  };

  const KEY = 'teleprompter_settings';

  let current = { ...DEFAULTS };

  function load() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) Object.assign(current, JSON.parse(saved));
    } catch {}
    return current;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(current));
  }

  function get(key) { return current[key]; }

  function set(key, value) {
    current[key] = value;
    save();
    return current;
  }

  function getAll() { return { ...current }; }

  load();

  return { get, set, getAll, load, save, DEFAULTS };
})();
