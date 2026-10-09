(() => {
  const {t,name}=window.pvStatus;let data,days=7,busy=false;
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node};
  const pct=v=>v==null?'—':v.toFixed(2)+'%',ms=v=>v==null?'—':Math.round(v)+' ms',date=v=>v?new Date(v).toLocaleString(window.pvI18n.locale):'—';
  function metric(title,value){const node=el('div');node.append(el('span',title),el('b',value));return node;}
  function render(){
    window.pvStatus.translate();window.pvStatus.preferences();document.title='PulseVeto · '+t('title');
    if(!data){document.getElementById('overall').textContent=t('noData');return;}
    document.getElementById('overall').textContent=t(data.state);document.getElementById('overallDot').className='dot '+data.state;
    document.getElementById('updated').textContent=t('updated')+' · '+date(data.updatedAt);
    document.getElementById('since').textContent=t('since')+' · '+date(data.startedAt);
    const legend=document.getElementById('legend');legend.replaceChildren();for(const state of ['operational','degraded','outage','maintenance','unknown']){const n=el('span');n.append(el('i',null,'dot '+state),el('span',t(state)));legend.append(n);}
    const summary=document.getElementById('summary');summary.replaceChildren();
    for(const [label,value] of [['components',data.components.length],['requests',data.components.reduce((n,c)=>n+c.requests,0)],['errors',data.components.reduce((n,c)=>n+c.errors,0)],['active',data.notices.filter(n=>n.state!=='resolved'&&Date.parse(n.start)<=Date.now()&&(!n.end||Date.parse(n.end)>Date.now())).length]]){const n=metric(t(label),String(value));n.className='stat';summary.append(n);}
    const host=document.getElementById('components'),open=new Set([...host.querySelectorAll('details[open]')].map(n=>n.dataset.id));host.replaceChildren();
    for(const group of ['pages','api','infra']){host.append(el('h3',t(group)));for(const c of data.components.filter(c=>c.group===group)){
      const detail=el('details',null,'component');detail.dataset.id=c.id;detail.open=open.has(c.id);const summary=el('summary'),top=el('div',null,'component-top');
      top.append(el('i',null,'dot '+c.state),el('span',group==='api'?'API':group==='infra'?'DB':'WEB','badge'),el('span',name(c.id),'component-name'),el('span',pct(c.uptime)+' / '+days+'d','component-value'),el('span','⌄','chevron'));
      summary.append(top);const bars=el('div',null,'bars');
      for(const d of c.daily){const state=d.uptime==null?'unknown':d.uptime<95?'outage':d.uptime<100||d.slow?'degraded':'operational',bar=el('span',null,'bar '+state+(d.coverage>0&&d.coverage<99?' partial':''));bar.title=d.date+' UTC · '+t('uptime')+' '+pct(d.uptime)+' · '+t('coverage')+' '+pct(d.coverage);bar.setAttribute('aria-label',bar.title);bars.append(bar);}
      const labels=el('div',null,'timeline-labels');labels.append(el('span',c.daily[0]?.date),el('span',t('today')+' UTC'));summary.append(bars,labels);
      const body=el('div',null,'component-detail'),metrics=el('div',null,'metrics');
      for(const [label,value] of [['uptime',pct(c.uptime)],['coverage',pct(c.coverage)],['response',ms(c.responseMs)],['checks',c.checks],['requests',c.requests],['errors',c.errors],['rejected',c.rejected],['requestResponse',ms(c.requestResponseMs)]])metrics.append(metric(t(label),String(value)));
      const method=el('p',t(['team','events','result','overlay','manage','bp','public'].includes(c.id)?'passive':'probe'),'method');
      body.append(metrics,method,el('p',t('latency'),'method'));
      const points=c.series.filter(p=>p.ms!=null);if(points.length){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 140');svg.setAttribute('role','img');svg.setAttribute('aria-label',t('latency'));svg.classList.add('chart');const max=Math.max(100,...points.map(p=>p.ms)),start=Date.now()-86400000;
        let segment=[];const draw=()=>{if(!segment.length)return;if(segment.length===1){const dot=document.createElementNS(ns,'circle'),[x,y]=segment[0].split(',');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','3');dot.setAttribute('fill','currentColor');svg.append(dot);}else{const line=document.createElementNS(ns,'polyline');line.setAttribute('points',segment.join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','2');svg.append(line);}segment=[];};
        let last=0;for(const p of points){if(last&&p.at-last>150000)draw();segment.push((1000*(p.at-start)/86400000).toFixed(1)+','+(130-120*p.ms/max).toFixed(1));last=p.at;}draw();
        const chartLabels=el('div',null,'chart-label');chartLabels.append(el('span','0 ms'),el('span',Math.round(max)+' ms'));body.append(chartLabels,svg);
      }else body.append(el('p',t('noData'),'empty'));
      detail.append(summary,body);host.append(detail);
    }}
    const notices=document.getElementById('noticeList');notices.replaceChildren();
    for(const n of [...data.notices].sort((a,b)=>Date.parse(b.start)-Date.parse(a.start))){const item=el('article',null,'notice');item.append(el('small',t(n.kind)+' · '+t(n.state)),el('h3',n.title),el('p',n.body),el('small',date(n.start)+(n.end?' — '+date(n.end):'')),el('p',n.components.map(name).join(' · '),'method'));notices.append(item);}
    if(!data.notices.length)notices.append(el('div',t('noData'),'empty'));
  }
  async function load(){if(busy)return;busy=true;try{const r=await fetch('/status/api?days='+days,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);data=await r.json();document.getElementById('error').textContent='';render();}catch(error){document.getElementById('error').textContent=t('unknown')+' · '+error.message;document.getElementById('overall').textContent=t('unknown');document.getElementById('overallDot').className='dot unknown';}finally{busy=false;}}
  document.getElementById('ranges').addEventListener('click',event=>{const b=event.target.closest('[data-days]');if(!b)return;days=Number(b.dataset.days);document.querySelectorAll('[data-days]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));void load();});
  document.addEventListener('pv:locale',render);document.addEventListener('DOMContentLoaded',render);render();void load();setInterval(()=>void load(),60000);
})();
