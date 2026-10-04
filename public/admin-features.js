const featureWords={
  'zh-TW':{flows:'BP 流程',newFlow:'新增流程',flowName:'流程名稱',step:'步驟',actor:'操作隊伍',action:'操作',selector:'選邊隊伍',random:'隨機抽選',none:'無',ban:'禁用',pick:'選擇',flowHint:'系統會從所有尚未使用的地圖隨機抽選；設為「無」會停用該步驟及之後的流程。修改流程只影響之後建立的 BP。',legacy:'標準流程（自動 Decider）',chooseFlow:'請選擇 BP 流程',derived:'賽制依流程選圖數量決定',notes:'版本更新日誌',newNote:'新增版本',version:'版本',body:'更新內容',today:'今日內不再顯示',emptyNotes:'尚無更新日誌',deleteNote:'確定要刪除此版本的更新日誌嗎？刪除後無法復原。',pool:'賽事地圖池 (預設為 7 張)',poolError:'請選擇 2–20 張地圖',poolLimit:'最多可選擇 20 張地圖。',deleteFlow:'刪除此流程？已建立的 BP 不受影響。'},
  'zh-CN':{flows:'BP 流程',newFlow:'新增流程',flowName:'流程名称',step:'步骤',actor:'操作队伍',action:'操作',selector:'选边队伍',random:'随机抽选',ban:'禁用',pick:'选择',flowHint:'地图可由 Team A、Team B 或系统随机抽选；Pick 与 Decider 也可由系统随机分配攻守方。修改流程只影响之后创建的 BP。',legacy:'标准流程（自动 Decider）',chooseFlow:'请选择 BP 流程',derived:'赛制由流程选图数量决定',notes:'版本更新日志',newNote:'新增版本',version:'版本',body:'更新内容',today:'今日内不再显示',emptyNotes:'暂无更新日志',deleteNote:'确定要删除此版本的更新日志吗？删除后无法恢复。',pool:'赛事地图池 (默认为 7 张)',poolError:'请选择 2–20 张地图',poolLimit:'最多可选择 20 张地图。',deleteFlow:'删除此流程？已创建的 BP 不受影响。'},
  'en-US':{flows:'BP flows',newFlow:'Add flow',flowName:'Flow name',step:'Step',actor:'Acting team',action:'Action',selector:'Side selector',random:'Random draw',ban:'Ban',pick:'Pick',flowHint:'Maps may be chosen by Team A, Team B, or a system random draw. Pick and Decider sides may also be assigned randomly. Changes apply only to future Match BPs.',legacy:'Standard flow (automatic Decider)',chooseFlow:'Choose a BP flow',derived:'Format follows the number of picks',notes:'Release notes',newNote:'Add version',version:'Version',body:'Release details',today:'Do not show again today',emptyNotes:'No release notes yet',deleteNote:'Delete this release note? This cannot be undone.',pool:'Event map pool (default: 7 maps)',poolError:'Select 2–20 maps',poolLimit:'Select no more than 20 maps.',deleteFlow:'Delete this flow? Existing Match BPs are unaffected.'},
  'ja-JP':{flows:'BP フロー',newFlow:'フローを追加',flowName:'フロー名',step:'ステップ',actor:'操作チーム',action:'操作',selector:'サイド選択チーム',random:'ランダム抽選',ban:'BAN',pick:'PICK',flowHint:'マップは Team A、Team B、またはシステムのランダム抽選で決定できます。Pick と Decider の攻守もランダムに割り当てられます。変更は新規BPにのみ適用されます。',legacy:'標準フロー（自動Decider）',chooseFlow:'BP フローを選択',derived:'PICK数に応じた試合形式',notes:'更新履歴',newNote:'バージョンを追加',version:'バージョン',body:'更新内容',today:'今日は再表示しない',emptyNotes:'更新履歴はありません',deleteNote:'このバージョンの更新履歴を削除しますか？削除後は元に戻せません。',pool:'大会マッププール（初期設定：7マップ）',poolError:'2–20マップを選択してください',poolLimit:'最大20マップまで選択できます。',deleteFlow:'このフローを削除しますか？作成済みのBPには影響しません。'}
};
Object.assign(featureWords['zh-CN'],{none:'无'});Object.assign(featureWords['en-US'],{none:'None'});Object.assign(featureWords['ja-JP'],{none:'なし'});
function featureText(key){return (featureWords[window.pvI18n?.locale]||featureWords['zh-TW'])[key]||key}
function featureDialog(title,kind='release'){
  document.querySelector('#featureDialog')?.remove();
  const dialog=document.createElement('dialog');dialog.id='featureDialog';dialog.className=`feature-dialog release-dialog${kind==='flow'?' flow-dialog':''}`;
  const header=document.createElement('header');header.className='feature-dialog__header';
  const heading=document.createElement('h2');heading.textContent=title;
  header.append(heading);
  const close=document.createElement('button');close.type='button';close.className='feature-close';close.textContent='×';close.setAttribute('aria-label',tr('close'));close.onclick=()=>dialog.close();
  const content=document.createElement('div');content.className='feature-content';
  dialog.append(header,close,content);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();return content;
}
function featureError(container,error){let output=container.querySelector('.feature-error');if(!output){output=document.createElement('p');output.className='feature-error';output.setAttribute('role','alert');container.append(output)}output.textContent=error.message}
function flowSelectHtml(flows,event){
  return `<label class="wide">${esc(featureText('flows'))}<select name="flowId" ${event.maps.length===7&&!flows.length?'':'required'}><option value="">${esc(event.maps.length===7&&!flows.length?featureText('legacy'):featureText('chooseFlow'))}</option>${flows.map((flow,index)=>`<option value="${esc(flow.id)}" data-picks="${flow.steps.filter(step=>step.action!=='BAN').length}">${String(index+1).padStart(2,'0')} · ${esc(flow.name)}</option>`).join('')}</select><small>${esc(featureText('derived'))}</small></label>`;
}
document.addEventListener('change',event=>{
  if(!event.target.matches?.('select[name="flowId"]'))return;
  const format=document.querySelector('select[name="bestOf"]'),picks=event.target.selectedOptions[0]?.dataset.picks;
  if(!format)return;
  format.querySelector('[data-derived]')?.remove();format.disabled=Boolean(picks);
  if(picks){const option=new Option(`Bo${picks}`,picks,true,true);option.dataset.derived='true';format.add(option)}
});
async function openEventFlows(event){

  const content=featureDialog(`${event.name} · ${featureText('flows')}`,'flow');
  try{
    const flows=await api(`/events/${event.id}/flows`);
    if(!content.isConnected)return;
    content.classList.add('flow-content');
    const add=document.createElement('button');add.className='primary-btn';add.textContent=featureText('newFlow');add.onclick=()=>editEventFlow(event,null);content.append(add);
    flows.forEach((flow,index)=>{
      const row=document.createElement('article');row.className='feature-item flow-item';
      const title=document.createElement('h3');title.textContent=`${String(index+1).padStart(2,'0')} · ${flow.name}`;
      const summary=document.createElement('p');summary.textContent=flow.steps.map((step,index)=>`${index+1}. ${step.actor==='SYSTEM'?(step.action==='DECIDER'?'Decider':featureText('random')):step.actor==='TEAM_A'?'A':'B'} ${step.action==='DECIDER'?'':featureText(step.action==='BAN'?'ban':'pick')}${step.action!=='BAN'?` (${step.sideSelectionMode==='RANDOM'||step.sideSelector==='RANDOM'?featureText('random'):step.sideSelector==='TEAM_A'?'A':'B'})`:''}`).join(' → ');
      const edit=document.createElement('button');edit.textContent=tr('edit');edit.onclick=()=>editEventFlow(event,flow);
      const remove=document.createElement('button');remove.textContent=tr('delete');remove.onclick=async()=>{if(!confirm(featureText('deleteFlow')))return;try{await api(`/events/${event.id}/flows/${flow.id}`,{method:'DELETE'});await openEventFlows(event)}catch(error){featureError(content,error)}};
      row.append(title,summary,edit,remove);content.append(row);
    });
  }catch(error){featureError(content,error)}
}
function editEventFlow(event,flow){
  const content=featureDialog(`${event.name} · ${featureText(flow?'flows':'newFlow')}`,'flow'),form=document.createElement('form');
  const teams=value=>`<option value="TEAM_A" ${value==='TEAM_A'?'selected':''}>Team A</option><option value="TEAM_B" ${value==='TEAM_B'?'selected':''}>Team B</option>`;
  const sideOptions=step=>`${teams(step.sideSelector||'TEAM_A')}<option value="RANDOM" ${step.sideSelectionMode==='RANDOM'||step.sideSelector==='RANDOM'?'selected':''}>${esc(featureText('random'))}</option>`;
  form.innerHTML=`<button type="button" data-back>${esc(tr('back'))} · ${esc(featureText('flows'))}</button><p>${esc(featureText('flowHint'))}</p><label>${esc(featureText('flowName'))}<input name="name" required maxlength="100" value="${esc(flow?.name||'')}"></label><div class="flow-grid">${event.maps.map((_,index)=>{
    const last=index===event.maps.length-1,step=flow?(flow.steps[index]||{actor:'TEAM_A',action:'NONE',sideSelector:null}):{actor:last?'SYSTEM':index%2?'TEAM_B':'TEAM_A',action:last?'DECIDER':'BAN',sideSelector:'TEAM_A'};
    return `<fieldset data-action="${esc(step.action)}"><legend>${esc(featureText('step'))} ${index+1}</legend><label>${esc(featureText('actor'))}<select name="actor-${index}">${teams(step.actor)}<option value="SYSTEM" ${step.actor==='SYSTEM'?'selected':''}>${esc(last&&step.action==='DECIDER'?'Decider':featureText('random'))}</option></select></label><label>${esc(featureText('action'))}<select name="action-${index}">${last?`<option value="DECIDER" ${step.action==='DECIDER'?'selected':''}>Decider</option>`:''}<option value="BAN" ${step.action==='BAN'?'selected':''}>${esc(featureText('ban'))}</option><option value="PICK" ${step.action==='PICK'?'selected':''}>${esc(featureText('pick'))}</option>${index?`<option value="NONE" ${step.action==='NONE'?'selected':''}>${esc(featureText('none'))}</option>`:''}</select></label><label data-side-row ${['BAN','NONE'].includes(step.action)?'hidden':''}>${esc(featureText('selector'))}<select name="side-${index}">${sideOptions(step)}</select></label></fieldset>`;
  }).join('')}</div><button class="primary-btn" type="submit">${esc(tr('save'))}</button>`;
  form.querySelector('[data-back]').onclick=()=>openEventFlows(event);
  const syncFlowFields=()=>{let ended=false;form.querySelectorAll('.flow-grid fieldset').forEach(fieldset=>{const actor=fieldset.querySelector('[name^="actor-"]'),action=fieldset.querySelector('[name^="action-"]'),side=fieldset.querySelector('[name^="side-"]'),inactive=ended||action.value==='NONE';fieldset.classList.toggle('is-inactive',inactive);fieldset.dataset.action=action.value;action.disabled=ended;actor.disabled=inactive;side.disabled=inactive||action.value==='BAN';actor.querySelector('[value="SYSTEM"]').disabled=action.value==='BAN';fieldset.querySelector('[data-side-row]').hidden=['BAN','NONE'].includes(action.value);if(action.value==='NONE')ended=true})};
  form.addEventListener('change',e=>{
    const fieldset=e.target.closest('fieldset');if(!fieldset)return;
    const actor=fieldset.querySelector('[name^="actor-"]'),action=fieldset.querySelector('[name^="action-"]'),randomActor=actor.querySelector('[value="SYSTEM"]');
    if(e.target===actor&&actor.value!=='SYSTEM'&&action.value==='DECIDER')action.value='PICK';
    if(e.target===actor&&actor.value==='SYSTEM'&&action.value==='BAN')action.value='PICK';
    if(e.target===action&&action.value==='BAN'&&actor.value==='SYSTEM')actor.value='TEAM_A';
    randomActor.disabled=action.value==='BAN';syncFlowFields();
  });
  syncFlowFields();
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;try{
    const data=new FormData(form),configured=[...form.querySelectorAll('.flow-grid fieldset')].map(fieldset=>{const actor=fieldset.querySelector('[name^="actor-"]').value,action=fieldset.querySelector('[name^="action-"]').value,sideSelector=fieldset.querySelector('[name^="side-"]').value;return {actor,action,sideSelector:action!=='BAN'?sideSelector:null}}),stop=configured.findIndex(step=>step.action==='NONE'),steps=configured.slice(0,stop<0?configured.length:stop);
    await api(`/events/${event.id}/flows${flow?`/${flow.id}`:''}`,{method:flow?'PUT':'POST',body:JSON.stringify({name:data.get('name'),steps})});await openEventFlows(event);
  }catch(error){featureError(content,error);button.disabled=false}};
  content.append(form);
}
function releaseSessionKey(){return `pv:release-seen:${state?.organizationId||state?.organizations[0]?.id||'pulse'}`}
function markdownInline(value){
  let text=esc(value),tokens=[];
  text=text.replace(/`([^`]+)`/g,(_match,code)=>{tokens.push(`<code>${code}</code>`);return `\u0000${tokens.length-1}\u0000`});
  text=text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/gi,(_match,label,url)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  text=text.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>');
  text=text.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>').replace(/(^|[^_])_([^_\n]+)_/g,'$1<em>$2</em>');
  return text.replace(/\u0000(\d+)\u0000/g,(_match,index)=>tokens[Number(index)]||'');
}
function markdownHtml(markdown){
  const lines=String(markdown||'').replace(/\r\n?/g,'\n').split('\n'),html=[];let list=null,inCode=false,code=[];
  const closeList=()=>{if(list){html.push(`</${list}>`);list=null}};
  for(const line of lines){
    if(/^```/.test(line)){closeList();if(inCode){html.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);code=[]}inCode=!inCode;continue}
    if(inCode){code.push(line);continue}
    const heading=line.match(/^(#{1,4})\s+(.+)$/),unordered=line.match(/^\s*[-*+]\s+(.+)$/),ordered=line.match(/^\s*\d+[.)]\s+(.+)$/),quote=line.match(/^>\s?(.*)$/);
    if(heading){closeList();html.push(`<h${heading[1].length}>${markdownInline(heading[2])}</h${heading[1].length}>`);continue}
    if(unordered||ordered){const next=unordered?'ul':'ol';if(list!==next){closeList();list=next;html.push(`<${list}>`)}html.push(`<li>${markdownInline((unordered||ordered)[1])}</li>`);continue}
    closeList();if(quote){html.push(`<blockquote>${markdownInline(quote[1])}</blockquote>`);continue}
    if(/^\s*---+\s*$/.test(line)){html.push('<hr>');continue}
    if(!line.trim()){html.push('');continue}
    html.push(`<p>${markdownInline(line)}</p>`);
  }
  if(inCode)html.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);closeList();return html.join('\n');
}
async function openReleaseNotes(automatic=false){
  const notes=await api('/release-notes');if(automatic&&!notes.length)return false;
  const content=featureDialog(featureText('notes'));
  content.classList.add('release-notes-view');
  if(state.role==='PULSE'){const toolbar=document.createElement('div'),add=document.createElement('button');toolbar.className='release-toolbar';add.className='primary-btn release-add';add.textContent=featureText('newNote');add.onclick=()=>editReleaseNote(null);toolbar.append(add);content.append(toolbar)}
  if(!notes.length){const empty=document.createElement('p');empty.textContent=featureText('emptyNotes');content.append(empty)}
  const list=document.createElement('div');list.className='release-list';
  notes.forEach(note=>{const article=document.createElement('article');article.className='feature-item release-note';const title=document.createElement('h3'),date=document.createElement('small'),body=document.createElement('div');title.textContent=note.version;date.textContent=new Date(note.createdAt).toLocaleString(locale());body.className='release-body markdown-body';body.innerHTML=markdownHtml(note.body);article.append(title,date,body);if(state.role==='PULSE'){const actions=document.createElement('div'),edit=document.createElement('button'),remove=document.createElement('button');actions.className='release-actions';edit.textContent=tr('edit');edit.onclick=()=>editReleaseNote(note);remove.className='danger';remove.textContent=tr('delete');remove.onclick=async()=>{if(!confirm(featureText('deleteNote')))return;try{remove.disabled=true;await api(`/release-notes/${note.id}`,{method:'DELETE'});await openReleaseNotes(false)}catch(error){featureError(content,error);remove.disabled=false}};actions.append(edit,remove);article.append(actions)}list.append(article)});content.append(list);
  return true;
}
function editReleaseNote(note){
  const content=featureDialog(featureText(note?'notes':'newNote')),form=document.createElement('form');
  form.innerHTML=`<label>${esc(featureText('version'))}<input name="version" required maxlength="80" value="${esc(note?.version||'')}" ${note?'readonly':''}></label><label>${esc(featureText('body'))}<textarea name="body" required maxlength="20000" rows="14">${esc(note?.body||'')}</textarea></label><button class="primary-btn" type="submit">${esc(tr('save'))}</button>`;
  form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const data=new FormData(form);await api(`/release-notes${note?`/${note.id}`:''}`,{method:note?'PATCH':'POST',body:JSON.stringify({version:data.get('version'),body:data.get('body')})});await openReleaseNotes()}catch(error){featureError(content,error);button.disabled=false}};content.append(form);
}
let releaseChecked=false;
function initializeFeatures(){
  for(const language of Object.keys(featureWords))Object.assign(copy[language],{maps:featureWords[language].pool,exactMaps:featureWords[language].poolError,mapLimit:featureWords[language].poolLimit});
  const button=document.querySelector('#releaseNotesButton'),label=document.querySelector('#releaseNotesLabel');
  if(button)button.onclick=()=>openReleaseNotes(false).catch(error=>alert(error.message));if(label)label.textContent=featureText('notes');
  if(!releaseChecked){releaseChecked=true;const seenKey=releaseSessionKey(),sessionToken=csrf();let seen=false;try{seen=Boolean(sessionToken)&&sessionStorage.getItem(seenKey)===sessionToken}catch{}if(!seen)openReleaseNotes(true).then(opened=>{if(!opened)return;try{sessionStorage.setItem(seenKey,sessionToken)}catch{}}).catch(error=>{releaseChecked=false;console.error('Release notes unavailable',error.message)})}
}
document.addEventListener('pv:manage-loaded',initializeFeatures);
document.addEventListener('pv:locale',()=>{if(typeof state!=='undefined'&&state)initializeFeatures()});
