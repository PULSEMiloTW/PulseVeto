import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
process.env.NODE_ENV='test';process.env.DATABASE_URL='file:../storage/database/integration.db';
process.env.SESSION_SECRET='integration-session-secret-at-least-32-chars';process.env.KEY_ENCRYPTION_SECRET='integration-encryption-secret-32-chars';process.env.PUBLIC_BASE_URL='http://localhost:3000';
const app=express();app.use(express.json());app.use(cookieParser());
let prisma:typeof import('../../src/lib/db.js').prisma,adminCookie:string,orgCookie:string,csrf:string;
let service:typeof import('../../src/services/status.js');
beforeAll(async()=>{
  ({prisma}=await import('../../src/lib/db.js'));service=await import('../../src/services/status.js');
  const {randomToken,tokenHash}=await import('../../src/lib/security.js'),token=randomToken();csrf=randomToken();
  const admin=await prisma.adminUser.create({data:{username:'status-integration',passwordHash:'unused-fixture'}});
  await prisma.adminSession.create({data:{id:randomToken(),adminUserId:admin.id,tokenHash:tokenHash(token),csrfHash:tokenHash(csrf),expiresAt:new Date(Date.now()+3600000)}});adminCookie='veto_admin_session='+token;
  const org=await prisma.organization.create({data:{name:'Status denied organization'}}),orgToken=randomToken();
  await prisma.organizationSession.create({data:{id:randomToken(),organizationId:org.id,tokenHash:tokenHash(orgToken),csrfHash:tokenHash(csrf),expiresAt:new Date(Date.now()+3600000)}});orgCookie='veto_organization_session='+orgToken;
  const {statusRouter,statusManageRouter}=await import('../../src/routes/status.js');app.use(service.observeStatus);app.use('/status',statusRouter);app.use('/api/manage/status',statusManageRouter);
});
afterAll(async()=>{await prisma.systemSetting.deleteMany({where:{key:{startsWith:'status.'}}});await prisma.$disconnect();});
describe('status publication and management',()=>{
  it('shows unknown without history, exposes only aggregate data and validates range',async()=>{
    const response=await request(app).get('/status/api');expect(response.status).toBe(200);expect(response.body.state).toBe('unknown');expect(response.body.components.every((c:{uptime:null})=>c.uptime===null)).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain('tokenHash');expect(JSON.stringify(response.body)).not.toContain('passwordHash');expect((await request(app).get('/status/api?days=365')).status).toBe(400);
  });
  it('requires global administrator and CSRF and rejects stale or invalid updates',async()=>{
    for(const cookie of ['',orgCookie])expect((await request(app).get('/api/manage/status').set('Cookie',cookie)).status).toBe(403);
    expect((await request(app).put('/api/manage/status').set('Cookie',adminCookie).send({expectedVersion:0,enabled:true,notices:[]})).status).toBe(403);
    const save=()=>request(app).put('/api/manage/status').set('Cookie',adminCookie).set('x-csrf-token',csrf);
    expect((await save().send({expectedVersion:0,enabled:true,notices:[]})).status).toBe(200);
    expect((await save().send({expectedVersion:0,enabled:false,notices:[]})).status).toBe(409);
    expect((await save().send({expectedVersion:1,enabled:true,notices:[{title:'bad'}]})).status).toBe(400);
  });
  it('persists real samples, leaves gaps unknown and publishes incident state without rewriting uptime',async()=>{
    const now=Date.now(),metric={checks:1,ok:1,slow:0,totalMs:75,maxMs:75,requests:4,errors:0,rejected:1,requestMs:120};
    await service.persistMinute({at:Math.floor(now/60000)*60000,metrics:{home:metric}});
    let snapshot=await service.statusSnapshot(7,now);const home=snapshot.components.find(c=>c.id==='home')!;expect(home.uptime).toBe(100);expect(home.coverage).toBeLessThan(1);expect(home.state).toBe('operational');expect(snapshot.components.find(c=>c.id==='team')!.state).toBe('unknown');
    await service.saveStatusConfig(1,{enabled:true,notices:[{id:'cdf3c916-b749-4190-a637-06386e7f7adb',kind:'incident',title:'Public incident',body:'Public details',components:['home'],severity:'outage',state:'investigating',start:new Date(now-1000).toISOString(),end:null}]});
    snapshot=await service.statusSnapshot(7,now);expect(snapshot.state).toBe('outage');expect(snapshot.components.find(c=>c.id==='home')!.uptime).toBe(100);
    expect((await service.statusSnapshot(7,now+180000)).components.every(c=>c.state==='unknown')).toBe(true);
    await service.saveStatusConfig(2,{enabled:false,notices:[]});expect((await service.statusSnapshot(7,now)).state).toBe('unknown');
  });
});
