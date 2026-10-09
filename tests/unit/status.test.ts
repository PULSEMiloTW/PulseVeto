import {describe,it,expect} from 'vitest';
process.env.SESSION_SECRET='unit-status-session-secret-at-least-32';
process.env.KEY_ENCRYPTION_SECRET='unit-status-encryption-secret-32-chars';
import {classify,summarize,type Minute} from '../../src/services/status.js';

describe('status metrics',()=>{
  it('classifies only fixed public component IDs, never tokens or arbitrary paths',()=>{
    expect(classify('/result/private-token')).toBe('result');expect(classify('/api/public/overlay/private-token')).toBe('public');
    expect(classify('/api/manage/status')).toBeUndefined();expect(classify('/storage/secrets')).toBeUndefined();
  });
  it('keeps unobserved periods unknown and separates uptime from time coverage',()=>{
    expect(summarize([],'home',0,600000).uptime).toBeNull();
    const minutes:Minute[]=[{at:60000,metrics:{home:{checks:1,ok:1,slow:0,totalMs:100,maxMs:100,requests:2,errors:0,rejected:1,requestMs:80}}},{at:120000,metrics:{home:{checks:1,ok:0,slow:0,totalMs:5000,maxMs:5000,requests:1,errors:1,rejected:0,requestMs:20}}}];
    const stats=summarize(minutes,'home',0,600000);expect(stats.uptime).toBe(50);expect(stats.coverage).toBe(20);expect(stats.responseMs).toBe(2550);expect(stats.requestResponseMs).toBeCloseTo(100/3);expect(stats.errors).toBe(1);expect(stats.rejected).toBe(1);
    expect(summarize(minutes,'home',120000,180000).uptime).toBe(0);
  });
});
