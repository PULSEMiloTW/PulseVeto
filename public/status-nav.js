(() => {
  const labels={'zh-TW':'狀態頁管理','zh-CN':'状态页管理','en-US':'Status management','ja-JP':'稼働状況の管理'};
  if(location.pathname!=='/admin')return;
  const button=document.createElement('button');button.type='button';button.id='navStatus';button.hidden=true;
  button.onclick=()=>location.assign('/admin/status');document.querySelector('.sidebar-nav')?.append(button);
  const update=()=>{button.textContent='◉ '+(labels[window.pvI18n?.locale]||labels['zh-TW']);};update();document.addEventListener('pv:locale',update);
  fetch('/api/manage/status').then(r=>{button.hidden=!r.ok;}).catch(()=>{});
})();
