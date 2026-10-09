(() => {
  const labels={'zh-TW':'狀態頁管理','zh-CN':'状态页管理','en-US':'Status management','ja-JP':'稼働状況の管理'};
  const publicLabels={'zh-TW':['系統狀態','系統狀態（另開分頁）'],'zh-CN':['系统状态','系统状态（在新标签页打开）'],'en-US':['Service status','Service status (opens in a new tab)'],'ja-JP':['稼働状況','稼働状況（新しいタブで開く）']};
  const sidebar=document.querySelector('.admin-sidebar');if(!sidebar)return;
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='/status-nav.css';document.head.append(stylesheet);
  const publicLink=document.createElement('a');publicLink.className='sidebar-status-link';publicLink.href='/status';publicLink.target='_blank';publicLink.rel='noopener noreferrer';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d','M3 12h4l3-7 4 14 3-7h4');svg.append(path);
  const text=document.createElement('span'),arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');publicLink.append(svg,text,arrow);
  const help=sidebar.querySelector('.sidebar-help');if(help)help.prepend(publicLink);else{const box=document.createElement('div');box.className='sidebar-status-links';box.append(publicLink);sidebar.querySelector('.sidebar-release')?.before(box);}
  const updatePublic=()=>{const [label,description]=publicLabels[window.pvI18n?.locale]||publicLabels['zh-TW'];text.textContent=label;publicLink.setAttribute('aria-label',description);publicLink.title=description;};updatePublic();document.addEventListener('pv:locale',updatePublic);
  if(location.pathname!=='/admin')return;
  const button=document.createElement('button');button.type='button';button.id='navStatus';button.hidden=true;
  button.onclick=()=>location.assign('/admin/status');document.querySelector('.sidebar-nav')?.append(button);
  const update=()=>{button.textContent='◉ '+(labels[window.pvI18n?.locale]||labels['zh-TW']);};update();document.addEventListener('pv:locale',update);
  fetch('/api/manage/status').then(r=>{button.hidden=!r.ok;}).catch(()=>{});
})();
