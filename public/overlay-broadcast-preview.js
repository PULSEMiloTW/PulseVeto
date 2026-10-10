(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const demo = params.get('demo') === '1';
  const cards = document.getElementById('cards');
  const status = document.getElementById('status');
  let previous = new Map();
  let revision = -1;
  function fit() {
    document.getElementById('stage').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`;
  }
  addEventListener('resize', fit); fit();
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  function safeImage(value) {
    if (!value) return null;
    try { const url = new URL(value, location.origin); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  }
  function render(state) {
    if (!state || !Array.isArray(state.maps)) return;
    if (Number.isFinite(state.version) && state.version < revision) return;
    revision = state.version ?? revision;
    document.getElementById('event').textContent = state.eventName || 'PulseVeto';
    document.getElementById('teams').textContent = `${state.teamA || 'Team A'}  /  ${state.teamB || 'Team B'}`;
    const pool = state.mapPool || [];
    const items = [...state.maps];
    const total = Math.max(pool.length, items.length, 1);
    while (items.length < total) items.push(null);
    const rows = Math.ceil(total / 7);
    cards.style.gridTemplateColumns = `repeat(${Math.min(total, 7)},minmax(0,1fr))`;
    const next = new Map();
    items.forEach((map, index) => {
      const signature = JSON.stringify([map, state.teamA, state.teamB, rows]);
      const old = previous.get(index);
      if (old?.signature === signature) { next.set(index, old); return; }
      const kind = !map ? 'pending' : map.action === 'Veto' ? 'ban' : map.action === 'Decider' ? 'decider' : 'pick';
      const card = text('article', `card ${kind} enter`, '');
      card.style.height = `${Math.min(246, 600 / rows)}px`;
      card.style.setProperty('--delay', previous.size ? '0s' : `${index * .18}s`);
      const image = safeImage(map?.mapImage);
      if (image) { const img = document.createElement('img'); img.src = image; img.alt = ''; img.referrerPolicy = 'no-referrer'; card.append(img); }
      card.append(text('span', 'number', String(index + 1).padStart(2, '0')));
      card.append(text('span', 'action', ({pending:'等待',ban:'BAN',pick:'PICK',decider:'DECIDER'})[kind]));
      const details = text('div', 'details', '');
      details.append(text('div', 'map', map?.mapNameZh || map?.mapName || '待選地圖'));
      const actor = map?.actor === 'Team A' ? state.teamA : map?.actor === 'Team B' ? state.teamB : map?.actor === 'Random' ? '隨機' : kind === 'decider' ? '決勝圖' : '';
      details.append(text('div', 'actor', actor || '等待操作'));
      const side = map?.sideSelection === 'ATTACK' ? '進攻' : map?.sideSelection === 'DEFENSE' ? '防守' : '';
      details.append(text('div', 'side', map?.score || (side ? `${map.sideSelector || ''} · ${side}` : map?.timeoutRandom ? '超時隨機' : '')));
      card.append(details);
      next.set(index, {signature, card});
    });
    [...next].forEach(([index, item]) => {
      const existing = cards.children[index];
      if (existing !== item.card) {
        if (existing) existing.replaceWith(item.card); else cards.append(item.card);
      }
    });
    while (cards.children.length > next.size) cards.lastElementChild.remove();
    previous = next;
    status.textContent = demo ? '示範模式' : state.status === 'COMPLETED' ? 'BP 完成' : '即時 BP';
    document.getElementById('progress').textContent = `${state.maps.length} / ${total} 地圖已確認`;
  }
  if (demo) {
    const names = ['Ascent','Haven','Lotus','Bind','Split','Icebox','Sunset'];
    const state = {teamA:'PULSE BLUE',teamB:'VETO VIOLET',eventName:'邀請測試 · BO3',mapPool:names,maps:[]};
    fetch('/api/maps').then(r => r.json()).then(data => {
      const catalog = data.data || [];
      state.maps = names.map((name, i) => { const m = catalog.find(m => m.name === name || m.nameEn === name); return {mapName:name,mapImage:m?.splash || '',actor:i % 2 ? 'Team B':'Team A',action:i === 6 ? 'Decider' : [2,3].includes(i) ? 'Pick':'Veto'}; });
      render(state);
    }).catch(() => { state.maps = names.map(mapName => ({mapName,action:'Pick',actor:'Team A'})); render(state); });
    return;
  }
  if (!token) { status.textContent = '請提供 Overlay 測試連結'; return; }
  async function refresh() {
    try {
      const response = await fetch(`/api/public/overlay/${encodeURIComponent(token)}`, {cache:'no-store',referrerPolicy:'no-referrer'});
      if (!response.ok) { cards.replaceChildren(); previous.clear(); status.textContent = '連結無效或已撤銷'; return; }
      render(await response.json());
    } catch { status.textContent = '連線中斷，重試中'; }
  }
  refresh();
  setInterval(refresh, 5000);
  const socket = io();
  socket.on('connect', () => { socket.emit('join_room', token); refresh(); });
  socket.on('state_changed', () => refresh());
  socket.on('disconnect', () => { status.textContent = '重新連線中'; });
})();
