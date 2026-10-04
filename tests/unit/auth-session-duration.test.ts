import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('authentication session duration',()=>{
  it('keeps authentication and CSRF cookies aligned at five hours',()=>{
    const auth=readFileSync(new URL('../../src/lib/auth.ts',import.meta.url),'utf8');
    expect(auth.match(/maxAge:5\*60\*60_000/g)).toHaveLength(2);
    expect(auth).toContain('expiresAt&&expiresAt.getTime()<Date.now()+authCookie.maxAge');
  });
});
