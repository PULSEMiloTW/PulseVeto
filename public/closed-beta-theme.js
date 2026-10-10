(() => {
  if (/^\/overlay(?:[-/]|$)/.test(location.pathname)) return;
  const root = document.documentElement;
  root.dataset.pvBeta = '';
  let enabled = new URLSearchParams(location.search).get('theme') !== 'original';
  const stylesheet = document.querySelector('link[data-beta-styles]');
  const labels = {
    'zh-TW': ['封閉測試', '測試入口', '原版主題', '新版主題', '切換明暗', '跳至主要內容'],
    'zh-CN': ['封闭测试', '测试入口', '原版主题', '新版主题', '切换明暗', '跳至主要内容'],
    'en-US': ['Closed beta', 'Test hub', 'Original theme', 'New theme', 'Toggle light/dark', 'Skip to content'],
    'ja-JP': ['クローズドベータ', 'テスト一覧', '元のテーマ', '新テーマ', '明暗切替', '本文へ移動'],
  };
  let saved = 'light';
  try { saved = localStorage.getItem('pv_hq_theme') || 'light'; } catch {}
  root.dataset.hqTheme ||= saved === 'dark' ? 'dark' : 'light';
  function apply() {
    if (enabled) root.dataset.pvBeta = ''; else delete root.dataset.pvBeta;
    // Keep the preview toolbar styled while disabling only the page-specific theme rules.
    if (stylesheet) stylesheet.disabled = false;
    const copy = labels[window.pvI18n?.locale] || labels['zh-TW'];
    title.textContent = copy[0]; hub.textContent = copy[1];
    toggle.textContent = copy[enabled ? 2 : 3];
    toggle.setAttribute('aria-pressed', String(enabled));
    mode.textContent = copy[4]; skip.textContent = copy[5];
    const language = document.querySelector('.pv-language-trigger:not(.pv-theme-trigger):not(#statusTheme):not(#hqAccount)');
    if (language && enabled) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
      path.setAttribute('d', 'M3 5h12M9 3v2m4 0c-1 6-4 9-9 11M5 8c1 3 4 6 7 8m2 5 4-11 4 11m-6-4h4');
      svg.append(path); language.replaceChildren(svg);
    }
  }
  const bar = document.createElement('nav'); bar.className = 'beta-tools'; bar.setAttribute('aria-label', 'Closed beta preview');
  const title = document.createElement('strong');
  const hub = document.createElement('a'); hub.href = '/__beta';
  const toggle = document.createElement('button'); toggle.type = 'button';
  toggle.addEventListener('click', () => {
    enabled = !enabled;
    const url = new URL(location.href); url.searchParams.set('theme', enabled ? 'beta' : 'original');
    history.replaceState(null, '', url); apply();
  });
  const mode = document.createElement('button'); mode.type = 'button';
  mode.addEventListener('click', () => {
    const existing = document.querySelector('.pv-theme-trigger, #statusTheme');
    if (existing) existing.click();
    else {
      root.dataset.hqTheme = root.dataset.hqTheme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('pv_hq_theme', root.dataset.hqTheme); } catch {}
    }
  });
  const skip = document.createElement('a'); skip.className = 'beta-skip';
  const main = document.querySelector('main');
  if (main) { if (!main.id) main.id = 'beta-main'; skip.href = `#${main.id}`; main.tabIndex = -1; }
  bar.append(title, hub, toggle, mode); if (main) bar.prepend(skip);
  document.body.prepend(bar);
  document.addEventListener('pv:locale', apply); apply();
})();
