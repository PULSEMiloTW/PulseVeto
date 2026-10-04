(()=>{
  const labels={
    'zh-TW':{ban:'禁用',pick:'選擇',decider:'決勝'},
    'zh-CN':{ban:'禁用',pick:'选择',decider:'决胜'},
    'en-US':{ban:'BAN',pick:'PICK',decider:'DECIDER'},
    'ja-JP':{ban:'バン',pick:'ピック',decider:'決定マップ'}
  };
  const render=()=>{const current=labels[window.pvI18n?.locale]||labels['zh-TW'];document.querySelectorAll('[data-card-label]').forEach(element=>{element.textContent=current[element.dataset.cardLabel]})};
  document.addEventListener('pv:locale',render);render();
})();
