(() => {
  const error = document.getElementById('beta-error');
  document.getElementById('beta-login').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true; error.textContent = '';
    try {
      const response = await fetch('/api/auth/pulse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'closedbeta', password: 'local-closed-beta-only' }) });
      if (!response.ok) throw new Error('測試登入失敗，請重新啟動本地測試。');
      location.assign((await response.json()).redirect);
    } catch (cause) { error.textContent = cause.message; button.disabled = false; }
  });
  fetch('/__beta/data').then(async response => {
    if (!response.ok) throw new Error('測試資料載入失敗，請重新整理。');
    const matches = await response.json(), host = document.getElementById('beta-matches'); host.replaceChildren();
    for (const match of matches) {
      const section = document.createElement('p'), title = document.createElement('strong'); title.textContent = match.name; section.append(title, document.createElement('br'));
      for (const [team, key] of Object.entries(match.keys)) { const code = document.createElement('code'); code.textContent = `${team}: ${key}`; section.append(code, document.createElement('br')); }
      const link = document.createElement('a'); link.href = match.resultUrl; link.textContent = '開啟賽果 →'; section.append(link); host.append(section);
    }
  }).catch(cause => { error.textContent = cause.message; });
})();
