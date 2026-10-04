import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const readPublic=(path:string)=>readFileSync(new URL(`../../public/${path}`,import.meta.url),'utf8');

describe('team random-result confirmation UI',()=>{
  const page=readPublic('team.html'),script=readPublic('team.js'),styles=readPublic('team-random-confirm.css');

  it('shows a persistent modal and posts confirmation through the protected team API',()=>{
    expect(page).toContain('id="randomModal"');
    expect(page).toContain('id="randomConfirm"');
    expect(script).toContain("state.status==='WAITING_FOR_RANDOM_CONFIRMATION'");
    expect(script).toContain("submit('/api/team/random-confirm',{expectedVersion:state.version})");
  });

  it('renders random maps, random sides, and each team confirmation state',()=>{
    expect(script).toContain("step.actor==='SYSTEM'");
    expect(script).toContain("step.sideSelectionMode==='RANDOM'");
    expect(script).toContain('confirmation.teamAConfirmed');
    expect(script).toContain('confirmation.teamBConfirmed');
    expect(styles).toContain('.random-confirm-status');
  });

  it('ships all four supported locales',()=>{
    for(const locale of ['zh-TW','zh-CN','en-US','ja-JP'])expect(script).toContain(`'${locale}':{WAITING_FOR_RANDOM_CONFIRMATION:`);
  });
});
