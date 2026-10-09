import {performance} from 'node:perf_hooks';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {env} from '../config/env.js';
import type {RequestHandler} from 'express';
import {prisma} from '../lib/db.js';
import {logger} from '../lib/logger.js';

export const components = [
  {id:'home',group:'pages',path:'/',probe:'/',expected:200},
  {id:'docs',group:'pages',path:'/docs',probe:'/docs',expected:200},
  {id:'status',group:'pages',path:'/status',probe:'/status',expected:200},
  {id:'admin',group:'pages',path:'/admin',probe:'/admin',expected:302},
  {id:'hq',group:'pages',path:'/hq',probe:'/hq',expected:302},
  {id:'team',group:'pages',path:'/bp/teams/:id'},
  {id:'events',group:'pages',path:'/bp/events/:id'},
  {id:'result',group:'pages',path:'/result/:token'},
  {id:'overlay',group:'pages',path:'/overlay-*'},
  {id:'maps',group:'api',path:'/api/maps',probe:'/api/maps',expected:200},
  {id:'auth',group:'api',path:'/api/auth/*',probe:'/api/auth/discord/status',expected:200},
  {id:'manage',group:'api',path:'/api/manage/*'},
  {id:'bp',group:'api',path:'/api/team/*'},
  {id:'public',group:'api',path:'/api/public/*'},
  {id:'socket',group:'api',path:'/socket.io',probe:'/socket.io/?EIO=4&transport=polling',expected:200},
  {id:'database',group:'infra',path:''},
] as const;
export type ComponentId=typeof components[number]['id'];
type Metric={checks:number;ok:number;slow:number;totalMs:number;maxMs:number;requests:number;errors:number;rejected:number;requestMs:number};
export type Minute={at:number;metrics:Partial<Record<ComponentId,Metric>>};
export type Notice={id:string;kind:'incident'|'maintenance';title:string;body:string;components:ComponentId[];severity:'degraded'|'outage';state:'scheduled'|'investigating'|'monitoring'|'resolved';start:string;end:string|null};
export type StatusConfig={version:number;enabled:boolean;notices:Notice[]};
const configKey='status.config',prefix='status.day.',minuteMs=60_000;
const probeMarker=crypto.randomUUID();
const availableComponents=()=>components.filter(c=>c.id==='docs'?fs.existsSync('public/docs.html'):c.id==='hq'?fs.existsSync('src/hq-app.ts')||fs.existsSync('dist/src/hq-app.js'):true);
const fresh=():Metric=>({checks:0,ok:0,slow:0,totalMs:0,maxMs:0,requests:0,errors:0,rejected:0,requestMs:0});
let pending:Partial<Record<ComponentId,Metric>>={};
export function classify(path:string):ComponentId|undefined{
  if(path==='/')return 'home';if(path==='/status')return 'status';if(path==='/admin')return 'admin';
  if(/^\/docs(?:\/|$)/.test(path))return 'docs';if(/^\/hq(?:\/|$)/.test(path))return 'hq';
  if(path.startsWith('/bp/teams/'))return 'team';if(path.startsWith('/bp/events/'))return 'events';
  if(path.startsWith('/result/'))return 'result';if(path.startsWith('/overlay-'))return 'overlay';
  if(path==='/api/maps')return 'maps';if(path.startsWith('/api/auth/'))return 'auth';
  if(path.startsWith('/api/manage/status'))return undefined;
  if(path.startsWith('/api/manage/'))return 'manage';if(path.startsWith('/api/team/'))return 'bp';
  if(path.startsWith('/api/public/'))return 'public';return undefined;
}
export const observeStatus:RequestHandler=(req,res,next)=>{
  const id=classify(req.path),start=performance.now();
  if(id&&req.headers['x-pulse-status-probe']!==probeMarker)res.once('finish',()=>{
    const metric=pending[id]??=fresh(),elapsed=performance.now()-start;metric.requests++;metric.requestMs+=elapsed;
    if(res.statusCode>=500)metric.errors++;else if(res.statusCode>=400)metric.rejected++;
    if(!components.some(c=>c.id===id&&'probe'in c)&&((res.statusCode>=200&&res.statusCode<300)||res.statusCode>=500)){metric.checks++;if(res.statusCode<300)metric.ok++;if(res.statusCode<300&&elapsed>1500)metric.slow++;metric.totalMs+=elapsed;metric.maxMs=Math.max(metric.maxMs,elapsed);}
  });next();
};
export async function statusConfig():Promise<StatusConfig>{
  const row=await prisma.systemSetting.findUnique({where:{key:configKey}});
  return row?JSON.parse(row.valueJson) as StatusConfig:{version:0,enabled:true,notices:[]};
}
export async function saveStatusConfig(expectedVersion:number,input:Omit<StatusConfig,'version'>){
  return prisma.$transaction(async tx=>{
    const old=await tx.systemSetting.findUnique({where:{key:configKey}});
    const version=old?(JSON.parse(old.valueJson) as StatusConfig).version:0;
    if(version!==expectedVersion)throw Object.assign(new Error('Conflict'),{status:409});
    const value={...input,version:version+1},valueJson=JSON.stringify(value);
    if(old){const changed=await tx.systemSetting.updateMany({where:{key:configKey,valueJson:old.valueJson},data:{valueJson}});if(changed.count!==1)throw Object.assign(new Error('Conflict'),{status:409});}
    else await tx.systemSetting.create({data:{key:configKey,valueJson}});
    return value;
  });
}
export async function persistMinute(minute:Minute){
  const key=prefix+new Date(minute.at).toISOString().slice(0,10);
  await prisma.$transaction(async tx=>{
    const row=await tx.systemSetting.findUnique({where:{key}}),minutes=row?JSON.parse(row.valueJson) as Minute[]:[];
    const remaining=minutes.filter(item=>item.at!==minute.at);remaining.push(minute);
    await tx.systemSetting.upsert({where:{key},create:{key,valueJson:JSON.stringify(remaining)},update:{valueJson:JSON.stringify(remaining)}});
  });
  await prisma.systemSetting.deleteMany({where:{key:{startsWith:prefix,lt:prefix+new Date(minute.at-90*86400_000).toISOString().slice(0,10)}}});
}
export function summarize(minutes:Minute[],id:ComponentId,from:number,to:number){
  const total=fresh();let sampled=0;
  for(const item of minutes){if(item.at<from||item.at>=to)continue;const m=item.metrics[id];if(!m)continue;
    for(const k of ['checks','ok','slow','totalMs','requests','errors','rejected','requestMs'] as const)total[k]+=m[k];
    total.maxMs=Math.max(total.maxMs,m.maxMs);if(m.checks)sampled++;
  }
  return {...total,uptime:total.checks?100*total.ok/total.checks:null,coverage:Math.min(100,100*sampled/Math.max(1,Math.ceil((to-from)/minuteMs))),responseMs:total.checks?total.totalMs/total.checks:null,requestResponseMs:total.requests?total.requestMs/total.requests:null};
}
export async function statusSnapshot(days=7,now=Date.now()){
  const rows=await prisma.systemSetting.findMany({where:{key:{startsWith:prefix,gte:prefix+new Date(now-90*86400_000).toISOString().slice(0,10)}},orderBy:{key:'asc'}});
  const minutes=rows.flatMap(row=>JSON.parse(row.valueJson) as Minute[]).sort((a,b)=>a.at-b.at),config=await statusConfig();
  const byDay=new Map<string,Minute[]>();for(const minute of minutes){const key=new Date(minute.at).toISOString().slice(0,10),list=byDay.get(key)??[];list.push(minute);byDay.set(key,list);}
  const current=minutes.at(-1),stale=!current||now-current.at>150_000;
  const notices=config.notices.filter(n=>n.state!=='resolved'&&Date.parse(n.start)<=now&&(!n.end||Date.parse(n.end)>now));
  const items=availableComponents().map(c=>{
    const metric=current?.metrics[c.id],active=notices.filter(n=>n.components.includes(c.id));
    const state=!config.enabled||stale?'unknown':active.some(n=>n.kind==='maintenance')?'maintenance':active.some(n=>n.severity==='outage')?'outage':active.length?'degraded':!metric?.checks?'unknown':metric.ok<metric.checks?'outage':metric.slow?'degraded':'operational';
    return {...c,probe:undefined,expected:undefined,state,...summarize(minutes,c.id,now-days*86400_000,now),daily:Array.from({length:90},(_,i)=>{
      const start=Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate())-(89-i)*86400_000;
      const date=new Date(start).toISOString().slice(0,10);return {date,...summarize(byDay.get(date)??[],c.id,start,Math.min(start+86400_000,now))};
    }),series:minutes.filter(m=>m.at>=now-86400_000).map(m=>({at:m.at,ms:m.metrics[c.id]?.checks?(m.metrics[c.id]!.totalMs/m.metrics[c.id]!.checks):null,ok:m.metrics[c.id]?.ok??null}))};
  });
  const state=items.some(c=>c.state==='outage')?'outage':items.some(c=>c.state==='degraded')?'degraded':items.some(c=>c.state==='maintenance')?'maintenance':items.some(c=>c.state==='unknown')?'unknown':'operational';
  return {state,enabled:config.enabled,updatedAt:current?.at??null,startedAt:minutes[0]?.at??null,days,intervalSeconds:60,retentionDays:90,components:items,notices:config.notices};
}
export function startStatusMonitor(port:number){
  let running=false;
  const tick=async()=>{
    if(running)return;running=true;
    const metrics=pending;pending={};
    try{
      if(!(await statusConfig()).enabled)return;
      await Promise.all(availableComponents().map(async c=>{
        if(!('probe'in c)&&c.id!=='database')return;
        const m=metrics[c.id]??=fresh(),start=performance.now();let ok=false;
        try{if(c.id==='database'){await prisma.$queryRaw`SELECT 1`;ok=true;}
          else if('probe'in c){const response=await fetch(`http://localhost:${port}${c.probe}`,{redirect:'manual',signal:AbortSignal.timeout(5000),headers:{'x-pulse-status-probe':probeMarker,...(c.id==='hq'?{host:new URL(env.PUBLIC_BASE_URL).host}:{})}});const body=await response.text();ok=response.status===c.expected;
            if(ok&&c.id==='socket')ok=body.startsWith('0{');
            if(ok&&c.id==='maps'){const value=JSON.parse(body) as {success?:unknown;data?:unknown};ok=value.success===true&&Array.isArray(value.data);}
            if(ok&&c.id==='auth'){const value=JSON.parse(body) as {configured?:unknown};ok=typeof value.configured==='boolean';}
            if(ok&&c.id==='admin')ok=response.headers.get('location')==='/';
            if(ok&&c.id==='hq')ok=response.headers.get('location')==='/hq/login';
          }
        }catch{ /* Only aggregate availability, never persist response bodies or secrets. */ }
        const elapsed=performance.now()-start;m.checks++;if(ok)m.ok++;if(ok&&elapsed>1500)m.slow++;m.totalMs+=elapsed;m.maxMs=Math.max(m.maxMs,elapsed);
      }));
      await persistMinute({at:Math.floor(Date.now()/minuteMs)*minuteMs,metrics});
    }catch{logger.warn({category:'STATUS'},'Status sample could not be persisted');}finally{running=false;}
  };
  void tick();const timer=setInterval(()=>void tick(),minuteMs);timer.unref();return ()=>clearInterval(timer);
}
