import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {overlayDto} from '../../src/services/snapshot.js';

describe('overlay pick and side attribution',()=>{
  it('keeps the map picker separate from the side selector',()=>{
    const dto=overlayDto({
      status:'COMPLETED',currentStep:7,version:8,
      event:{name:'測試賽事',logo:null,themeColor:'#ff4655'},
      teams:{TEAM_A:{name:'Alpha',logo:null},TEAM_B:{name:'Bravo',logo:null}},
      mapPool:[],steps:[],coinToss:null,completedAt:new Date(),
      actions:[{id:'action-1',stepNumber:3,resultOrder:1,actor:'TEAM_A',action:'PICK',map:{id:'map-1',nameEn:'Ascent',nameZhTw:'義境空島',image:''},side:{selector:'TEAM_B',selectorSide:'DEFENSE',opponentSide:'ATTACK',isDecider:false,fromCoinToss:false},result:null,at:new Date()}],
    } as any);

    expect(dto.maps[0]).toMatchObject({
      actor:'Team A',
      sideSelector:'Bravo',
      sideSelection:'DEFENSE',
      atkSide:'Team A',
    });
  });
  it('orders every overlay slot by BP step so the Decider remains last',()=>{
    const action=(stepNumber:number,action:'BAN'|'DECIDER')=>({id:`action-${stepNumber}`,stepNumber,resultOrder:action==='DECIDER'?3:null,actor:action==='DECIDER'?'SYSTEM':'TEAM_A',action,map:{id:`map-${stepNumber}`,nameEn:`Map ${stepNumber}`,nameZhTw:`地圖 ${stepNumber}`,image:''},side:null,result:null,at:new Date()});
    const dto=overlayDto({
      status:'COMPLETED',currentStep:7,version:8,
      event:{name:'測試賽事',logo:null,themeColor:'#ff4655'},
      teams:{TEAM_A:{name:'Alpha',logo:null},TEAM_B:{name:'Bravo',logo:null}},
      mapPool:[],steps:[],coinToss:null,completedAt:new Date(),
      actions:[action(7,'DECIDER'),action(6,'BAN')],
    } as any);

    expect(dto.maps.map(map=>map.action)).toEqual(['Veto','Decider']);
    expect(dto.maps.at(-1)).toMatchObject({action:'Decider',isDecider:true});
  });

  it('marks automatic map and side draws as Random for overlays',()=>{
    const dto=overlayDto({
      status:'COMPLETED',currentStep:1,version:2,
      event:{name:'測試賽事',logo:null,themeColor:'#ff4655'},
      teams:{TEAM_A:{name:'Alpha',logo:null},TEAM_B:{name:'Bravo',logo:null}},
      mapPool:[],coinToss:null,completedAt:new Date(),
      steps:[{stepNumber:1,actor:'SYSTEM',action:'PICK',resultOrder:1,sideSelectionMode:'RANDOM',sideSelector:null,completed:true}],
      actions:[{id:'action-random',stepNumber:1,resultOrder:1,actor:'SYSTEM',action:'PICK',map:{id:'map-1',nameEn:'Ascent',nameZhTw:'義境空島',image:''},side:{selector:'TEAM_B',selectorSide:'DEFENSE',opponentSide:'ATTACK',isDecider:false,fromCoinToss:false},result:null,at:new Date()}],
    } as any);

    expect(dto.maps[0]).toMatchObject({actor:'Random',sideSelector:'Random',sideSelection:'DEFENSE'});
  });

  it('keeps the responsible team attribution for timeout draws',()=>{
    const dto=overlayDto({
      status:'WAITING_FOR_RANDOM_CONFIRMATION',currentStep:0,version:2,
      event:{name:'測試賽事',logo:null,themeColor:'#ff4655'},
      teams:{TEAM_A:{name:'Alpha',logo:null},TEAM_B:{name:'Bravo',logo:null}},
      mapPool:[],coinToss:null,completedAt:null,
      steps:[{stepNumber:1,actor:'TEAM_A',action:'PICK',resultOrder:1,sideSelectionMode:'OPPONENT_SELECTS',sideSelector:'TEAM_B',completed:true}],
      actions:[{id:'action-timeout',stepNumber:1,resultOrder:1,actor:'TEAM_A',action:'PICK',timeoutRandom:true,map:{id:'map-1',nameEn:'Ascent',nameZhTw:'義境空島',image:''},side:null,result:null,at:new Date()}],
    } as any);

    expect(dto.maps[0]).toMatchObject({actor:'Team A',action:'Pick'});
  });

  it.each([['tc','tc'],['tc-i','tc-i'],['cn','tc'],['cn-i','tc-i'],['en','en'],['en-i','en-i']])('renders selector fields in the %s overlay',(_variant,fileVariant)=>{
    const html=readFileSync(new URL(`../../public/overlay-vct-${fileVariant}.html`,import.meta.url),'utf8');
    expect(html).toContain("m.sideSelector === 'Random'");
    expect(html).toContain("m.actor === 'Random'");
    expect(html).toContain("m.sideSelection === 'DEFENSE'");
    expect(html).not.toContain("var sidePickerName = m.atkSide");
  });

  it('localizes Random in the current-action overlay',()=>{
    const current=readFileSync(new URL('../../public/overlay-current.html',import.meta.url),'utf8');
    expect(current).toContain("value==='Random'?'隨機':value");
    expect(current).toContain("s.teamB:'隨機'");
  });

  it('keeps Result and Overlay logo fallbacks intentionally separate',()=>{
    const result=readFileSync(new URL('../../public/result.js',import.meta.url),'utf8');
    const overlay=readFileSync(new URL('../../public/overlay-vct-tc.html',import.meta.url),'utf8');
    expect(result).toContain("const fallbackLogo='/branding/valorant-icon.png'");
    expect(overlay).toContain('state.vctLogo || "/assets/icon_vct.png"');
  });

  it('loads the score editor on the hierarchy management page',()=>{
    const manage=readFileSync(new URL('../../public/manage.html',import.meta.url),'utf8');
    const score=readFileSync(new URL('../../public/manage-score.js',import.meta.url),'utf8');
    const scoreStyles=readFileSync(new URL('../../public/manage-score.css',import.meta.url),'utf8');
    expect(manage).toContain('/manage-score.js?v=20260831-3');
    expect(score).toContain('[data-action="access-veto"]');
    expect(score).not.toContain('/theme.css');
    expect(score).toContain('/manage-score.css?v=20260831-2');
    expect(scoreStyles).toContain('height:min(760px,calc(100vh - 48px))');
    expect(scoreStyles).toContain('scrollbar-gutter:stable');
    expect(scoreStyles).toContain('#scoreContent{flex:1 1 auto}');
  });
});
