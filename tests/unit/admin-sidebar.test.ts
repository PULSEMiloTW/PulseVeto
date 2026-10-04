import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('role-aware admin sidebar',()=>{
  it('shows operator management to organization viewers while preserving role-specific hierarchy labels',()=>{
    const script=readFileSync(new URL('../../public/admin-hierarchy.js',import.meta.url),'utf8');
    const css=readFileSync(new URL('../../public/admin-fullscreen.css',import.meta.url),'utf8');
    expect(script).toContain("$('#navDiscord').hidden=false");
    expect(script).toContain("if(discordMode)return discordMemberForm()");
    expect(script).toContain("state?.role==='PULSE'?tr('organizers'):tr('events')");
    expect(css).toContain('.sidebar-nav [hidden]{display:none!important}');
  });
});
