import path from 'node:path';
import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import {currentAdmin,requireCsrf} from '../lib/auth.js';
import {audit} from '../lib/audit.js';
import {components,saveStatusConfig,statusConfig,statusSnapshot} from '../services/status.js';

export const statusRouter=Router(),statusManageRouter=Router();
const snapshots=new Map<number,{expires:number;value:ReturnType<typeof statusSnapshot>}>();
statusRouter.get('/',(_req,res)=>res.sendFile(path.resolve('public/status.html')));
statusRouter.get('/api',rateLimit({windowMs:60_000,limit:30,standardHeaders:true,legacyHeaders:false}),async(req,res)=>{
  const days=Number(req.query.days??7);if(![7,30,90].includes(days))return res.status(400).json({error:'Invalid range'});
  let cached=snapshots.get(days);if(!cached||cached.expires<Date.now()){cached={expires:Date.now()+15_000,value:statusSnapshot(days)};snapshots.set(days,cached);}
  try{res.set('Cache-Control','no-store').json(await cached.value);}catch(error){snapshots.delete(days);throw error;}
});
statusManageRouter.use(async(req,res,next)=>{if(!await currentAdmin(req))return res.status(403).json({error:'僅限全域管理員'});res.set('Cache-Control','no-store');next();});
statusManageRouter.get('/',async(_req,res)=>res.json(await statusConfig()));
const ids=z.enum(components.map(c=>c.id) as [typeof components[number]['id'],...typeof components[number]['id'][]]);
const notice=z.object({id:z.string().uuid(),kind:z.enum(['incident','maintenance']),title:z.string().trim().min(1).max(160),body:z.string().trim().min(1).max(4000),components:z.array(ids).min(1).max(components.length),severity:z.enum(['degraded','outage']),state:z.enum(['scheduled','investigating','monitoring','resolved']),start:z.iso.datetime(),end:z.iso.datetime().nullable()}).strict().refine(n=>!n.end||Date.parse(n.end)>Date.parse(n.start));
statusManageRouter.put('/',requireCsrf(currentAdmin),async(req,res)=>{
  const body=z.object({expectedVersion:z.number().int().nonnegative(),enabled:z.boolean(),notices:z.array(notice).max(100)}).strict().parse(req.body);
  if(new Set(body.notices.map(n=>n.id)).size!==body.notices.length)return res.status(400).json({error:'Duplicate notice'});
  const result=await saveStatusConfig(body.expectedVersion,{enabled:body.enabled,notices:body.notices});
  snapshots.clear();
  await audit({action:'STATUS_CONFIG_UPDATED',actorType:'PULSE_ADMIN',actorId:(await currentAdmin(req))!.adminUserId,ip:req.ip,details:{version:result.version,enabled:result.enabled,noticeCount:result.notices.length}});
  res.json(result);
});
for(const router of [statusRouter,statusManageRouter])router.use((error:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>{
  const status=error instanceof z.ZodError?400:error&&typeof error==='object'&&'status'in error&&error.status===409?409:503;
  res.status(status).json({error:status===409?'設定已更新，請重新載入':status===400?'Invalid status settings':'Status data unavailable'});
});
