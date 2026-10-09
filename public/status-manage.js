(() => {
  const {t,name,ids}=window.pvStatus;let config,dirty=false;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const localDate=iso=>{if(!iso)return '';const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  function render(){window.pvStatus.translate();window.pvStatus.preferences();document.title='PulseVeto · '+t('manageTitle');if(!config)return;
    document.getElementById('enabled').checked=config.enabled;const host=document.getElementById('editNotices');host.replaceChildren();
    config.notices.forEach(n=>{const card=el('section');card.className='manage-panel';const heading=el('h2',n.title||t('newNotice'));card.append(heading);
      function field(key,label,type,options){const wrap=el('div'),caption=el('label',t(label)),input=el(options?'select':type==='textarea'?'textarea':'input');input.id=n.id+'-'+key;caption.htmlFor=input.id;
        if(options)options.forEach(value=>{const option=el('option',t(value));option.value=value;input.append(option);});else if(type!=='textarea')input.type=type;
        input.value=type==='datetime-local'?localDate(n[key]):n[key]||'';if(['title','body','start'].includes(key))input.required=true;if(key==='title')input.maxLength=160;if(key==='body')input.maxLength=4000;
        input.oninput=()=>{n[key]=type==='datetime-local'?(input.value?new Date(input.value).toISOString():null):input.value;dirty=true;};wrap.append(caption,input);card.append(wrap);
      }
      field('kind','kind','select',['incident','maintenance']);field('title','noticeTitle','text');field('body','body','textarea');field('severity','severity','select',['degraded','outage']);field('state','state','select',['scheduled','investigating','monitoring','resolved']);field('start','start','datetime-local');field('end','end','datetime-local');
      card.append(el('p',t('affected')));const checks=el('div');checks.className='checks';ids.forEach(id=>{const label=el('label'),check=el('input');check.type='checkbox';check.checked=n.components.includes(id);check.onchange=()=>{n.components=check.checked?[...n.components,id]:n.components.filter(c=>c!==id);dirty=true;};label.append(check,document.createTextNode(' '+name(id)));checks.append(label);});card.append(checks);
      const remove=el('button',t('remove'));remove.type='button';remove.onclick=()=>{config.notices=config.notices.filter(v=>v!==n);dirty=true;render();};card.append(remove);host.append(card);
    });
  }
  async function load(){try{const response=await fetch('/api/manage/status',{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);config=await response.json();dirty=false;document.getElementById('save').disabled=false;document.getElementById('message').textContent='';render();}catch(e){document.getElementById('message').textContent=e.message;}}
  document.getElementById('enabled').onchange=event=>{if(config){config.enabled=event.target.checked;dirty=true;}};
  document.getElementById('add').onclick=()=>{if(!config||config.notices.length>=100)return;config.notices.unshift({id:crypto.randomUUID(),kind:'incident',title:'',body:'',components:[],severity:'degraded',state:'investigating',start:new Date().toISOString(),end:null});dirty=true;render();};
  document.getElementById('reload').onclick=()=>void load();
  document.getElementById('settings').onsubmit=async event=>{event.preventDefault();if(!config)return;const save=document.getElementById('save');save.disabled=true;try{const csrf=document.cookie.match(/(?:^|; )veto_csrf=([^;]+)/)?.[1]||'',response=await fetch('/api/manage/status',{method:'PUT',headers:{'Content-Type':'application/json','x-csrf-token':decodeURIComponent(csrf)},body:JSON.stringify({expectedVersion:config.version,enabled:config.enabled,notices:config.notices})});const result=await response.json();if(!response.ok)throw new Error(result.error);config=result;dirty=false;render();document.getElementById('message').textContent=t('saved');}catch(e){document.getElementById('message').textContent=e.message;}finally{save.disabled=false;}};
  addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});document.addEventListener('pv:locale',render);document.addEventListener('DOMContentLoaded',render);render();void load();
})();
