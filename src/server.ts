import 'dotenv/config';
import {statusRouter,statusManageRouter} from './routes/status.js';
import {observeStatus,startStatusMonitor} from './services/status.js';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'socket.io';
import { z } from 'zod';
import sharp from 'sharp';
import multer from 'multer';import {fileTypeFromBuffer} from 'file-type';
import { discordOAuthConfigured, env, trustedHosts } from './config/env.js';
import { connectDatabase, prisma } from './lib/db.js';
import { logger } from './lib/logger.js';
import { decryptSecret, lookupHash, maskedIp, normalizeKey, randomToken, tokenHash, verifySecret } from './lib/security.js';
import { createSession, currentAdmin, currentOrganization, currentTeam, requireCsrf } from './lib/auth.js';
import {ensureMapCatalog} from './services/map-sync.js';
import { audit } from './lib/audit.js';
import { metadataHtml, pageMetadata } from './lib/metadata.js';
import { overlayDto, vetoSnapshot } from './services/snapshot.js';
import { confirmRandomResult, confirmTeamReady, processVetoTimeout, submitMapAction, submitSide } from './services/veto-service.js';
import { manageRouter } from './routes/manage.js';
import { createBackup } from './services/backup.js';
import { purgeExpiredDeleted } from './services/recycle-bin.js';

const app=express(), server=http.createServer(app), io=new Server(server,{maxHttpBufferSize:100_000});
app.set('trust proxy',1); app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false,crossOriginResourcePolicy:false}));
app.use(express.json({limit:'64kb'})); app.use(cookieParser());
app.use((req,res,next)=>{const host=(req.hostname||'').toLowerCase();if(env.NODE_ENV==='production'&&!trustedHosts.has(host))return res.status(421).send('Untrusted host');next();});
app.use('/api/auth',rateLimit({windowMs:15*60_000,limit:30,skipSuccessfulRequests:true,standardHeaders:true,legacyHeaders:false,handler:(_req,res)=>res.status(429).json({error:'登入嘗試過於頻繁，請稍候 15 分鐘後再試'})}));
app.use(observeStatus);
app.use('/status',statusRouter);
app.use('/api/manage/status',origin,statusManageRouter);
app.get('/admin/status',async(req,res)=>{if(!await currentAdmin(req))return res.status(403).send('僅限全域管理員');res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}).sendFile(path.resolve('public/status-manage.html'));});
app.get('/status-manage.html',(_req,res)=>res.sendStatus(404));
app.get(['/manage.html','/team.html','/admin.html','/admin-home.html','/key-admin.html'],(_req,res)=>res.status(404).end());
app.use(express.static(path.resolve('public'),{index:false}));
app.use('/uploads',express.static(path.resolve('storage/uploads'),{index:false,fallthrough:false,maxAge:'1h'}));

async function origin(req:express.Request,res:express.Response,next:express.NextFunction){const value=req.get('origin');if(value){try{const candidate=new URL(value),configured=new URL(env.PUBLIC_BASE_URL),trusted=trustedHosts.has(candidate.hostname.toLowerCase()),samePort=!candidate.port||candidate.port===String(env.PORT),sameRequestHost=candidate.host.toLowerCase()===(req.get('host')||'').toLowerCase();if(candidate.origin!==configured.origin&&!(trusted&&samePort)&&!sameRequestHost)return res.status(403).json({error:'Origin rejected'})}catch{return res.status(403).json({error:'Origin rejected'})}}next();}
function safeError(res:express.Response,error:unknown){const e=error as Error&{status?:number};logger.warn({err:e.message},'Request rejected');return res.status(e.status||500).json({error:e.status?e.message:'伺服器處理失敗'});}
const manageSession=async(req:express.Request)=>await currentAdmin(req)||await currentOrganization(req),upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}});
const discordChoiceCookie='veto_discord_choice',discordChoiceCsrfCookie='veto_discord_choice_csrf';
const discordChoiceOptions={httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax' as const,maxAge:10*60_000,path:'/'};
function signDiscordChoice(discordUserId:string){const payload=Buffer.from(JSON.stringify({discordUserId,expiresAt:Date.now()+10*60_000})).toString('base64url'),signature=crypto.createHmac('sha256',env.SESSION_SECRET).update(payload).digest('base64url');return`${payload}.${signature}`}
function readDiscordChoice(req:express.Request){const raw=String(req.cookies?.[discordChoiceCookie]||''),[payload,signature]=raw.split('.');if(!payload||!signature)return null;const expected=crypto.createHmac('sha256',env.SESSION_SECRET).update(payload).digest(),received=Buffer.from(signature,'base64url');if(expected.length!==received.length||!crypto.timingSafeEqual(expected,received))return null;try{const value=z.object({discordUserId:z.string().regex(/^\d{17,20}$/),expiresAt:z.number()}).parse(JSON.parse(Buffer.from(payload,'base64url').toString()));return value.expiresAt>Date.now()?value:null}catch{return null}}
function clearDiscordChoice(res:express.Response){res.clearCookie(discordChoiceCookie,{...discordChoiceOptions,maxAge:undefined});res.clearCookie(discordChoiceCsrfCookie,{secure:env.NODE_ENV==='production',sameSite:'lax',path:'/'})}
async function discordScopeOptions(discordUserId:string){const isPulse=discordUserId===env.PULSE_DISCORD_USER_ID,organizations=await prisma.organization.findMany({where:{deletedAt:null,status:'ACTIVE',OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}],...(isPulse?{}:{discordMembers:{some:{discordUserId}}})},select:{id:true,name:true,iconPath:true},orderBy:{name:'asc'}});return[...(isPulse?[{type:'pulse' as const,name:'Pulse Studio',avatar:'/branding/PulseVeto_MainIcon.png'}]:[]),...organizations.map(item=>({type:'organization' as const,name:item.name,avatar:item.iconPath,organizationId:item.id}))]}

app.get('/',async(_req,res)=>res.send((await fs.promises.readFile(path.resolve('public/index.html'),'utf8')).replaceAll('http://localhost:3000',env.PUBLIC_BASE_URL.replace(/\/$/,''))));
app.get('/robots.txt',(_req,res)=>res.type('text').send('User-agent: *\nAllow: /$\nAllow: /result/\nDisallow: /api/\nDisallow: /manage/\nDisallow: /team/\nDisallow: /pulse/\nDisallow: /overlay-\n'));
app.get('/admin',async(req,res)=>{if(!await currentAdmin(req))return res.redirect('/');res.set('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet').sendFile(path.resolve('public/manage.html'));});
app.get('/bp/events/error',(_req,res)=>res.status(403).set({'X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet','Cache-Control':'no-store'}).sendFile(path.resolve('public/events-error.html')));
app.get('/auth/scope',async(req,res)=>{if(!readDiscordChoice(req))return res.redirect('/');res.set({'X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet','Cache-Control':'no-store'}).sendFile(path.resolve('public/auth-scope.html'))});
app.get('/bp/events/:organizationId',async(req,res)=>{const org=await currentOrganization(req);if(!org||org.organizationId!==String(req.params.organizationId))return res.redirect('/bp/events/error');res.set('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet').sendFile(path.resolve('public/manage.html'));});
app.get('/bp/teams/:vetoSessionId',async(req,res)=>{const team=await currentTeam(req);if(!team||team.vetoSessionId!==String(req.params.vetoSessionId))return res.redirect('/');const veto=await prisma.vetoSession.findUnique({where:{id:team.vetoSessionId},select:{teamALogo:true,teamBLogo:true}}),favicon=(team.team==='TEAM_A'?veto?.teamALogo:veto?.teamBLogo)||'/branding/PulseVeto_Favicon.png',escapedFavicon=favicon.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));res.set('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet').send((await fs.promises.readFile(path.resolve('public/team.html'),'utf8')).replace('<!--TEAM_FAVICON-->',`<link rel="icon" href="${escapedFavicon}">`));});
app.get('/manage',async(req,res)=>{const admin=await currentAdmin(req);if(admin)return res.redirect('/admin');const org=await currentOrganization(req);return res.redirect(org?`/bp/events/${encodeURIComponent(org.organizationId)}`:'/')});
app.get('/pulse',async(req,res)=>res.redirect(await currentAdmin(req)?'/admin':'/'));
app.post('/api/manage/upload/:scope',origin,requireCsrf(manageSession),upload.single('image'),async(req,res)=>{try{if(!await manageSession(req))return res.status(401).json({error:'Session expired'});const scope=z.enum(['organizations','events','teams']).parse(String(req.params.scope));if(!req.file)return res.status(400).json({error:'缺少圖片'});const type=await fileTypeFromBuffer(req.file.buffer);if(!type||!['image/png','image/jpeg','image/webp'].includes(type.mime))return res.status(400).json({error:'只接受 PNG、JPEG 或 WebP'});const name=`${crypto.randomUUID()}.${type.ext}`,dir=path.resolve('storage/uploads',scope);await fs.promises.mkdir(dir,{recursive:true});await fs.promises.writeFile(path.join(dir,name),req.file.buffer,{flag:'wx'});res.status(201).json({path:`/uploads/${scope}/${name}`})}catch(e){safeError(res,e)}});
app.use('/api/manage',manageRouter(io));

app.post('/api/auth/team',origin,async(req,res)=>{try{
  const key=z.string().min(8).max(19).parse(req.body?.key),record=await prisma.teamAccessKey.findUnique({where:{lookupHash:lookupHash(key)}});
  if(!record||record.revokedAt||record.expiresAt<=new Date()||!await verifySecret(record.verificationHash,normalizeKey(key))){logger.warn({ip:maskedIp(req.ip)},'AUTH Invalid team key');return res.status(401).json({error:'授權碼無效、過期或已撤銷'});}
  const firstUse=!record.lastUsedAt,expiresAt=await createSession(res,'team',{id:record.id,vetoSessionId:record.vetoSessionId,team:record.team,welcomeRequired:firstUse},record.expiresAt);
  await prisma.teamAccessKey.update({where:{id:record.id},data:{lastUsedAt:new Date(),failedAttemptCount:0}});
  await audit({action:'AUTH_TEAM_SUCCESS',actorType:record.team,actorId:record.id,vetoSessionId:record.vetoSessionId,ip:req.ip,details:{lastFour:record.lastFour}});
  res.json({ok:true,redirect:`/bp/teams/${encodeURIComponent(record.vetoSessionId)}`,expiresAt});
}catch(e){safeError(res,e);}});

app.get('/api/auth/discord/status',(_req,res)=>res.json({configured:discordOAuthConfigured}));
app.get('/api/auth/discord/start',(req,res)=>{
  if(!discordOAuthConfigured)return res.redirect('/?discordError='+encodeURIComponent('Discord 登入尚未完成伺服器設定'));
  const state=randomToken(24);
  res.cookie('veto_discord_state',state,{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',maxAge:10*60_000,path:'/api/auth/discord'});
  const authorize=new URL('https://discord.com/oauth2/authorize');
  authorize.searchParams.set('client_id',env.DISCORD_CLIENT_ID!);
  authorize.searchParams.set('response_type','code');
  authorize.searchParams.set('redirect_uri',env.DISCORD_REDIRECT_URI!);
  authorize.searchParams.set('scope','identify');
  authorize.searchParams.set('state',state);
  res.redirect(authorize.toString());
});
app.get('/api/auth/discord/callback',async(req,res)=>{try{
  if(!discordOAuthConfigured)throw new Error('Discord OAuth is not configured');
  const code=z.string().min(1).parse(req.query.code),state=z.string().min(20).parse(req.query.state),stored=String(req.cookies?.veto_discord_state||'');
  res.clearCookie('veto_discord_state',{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',path:'/api/auth/discord'});
  const stateBuffer=Buffer.from(state),storedBuffer=Buffer.from(stored);
  if(stateBuffer.length!==storedBuffer.length||!crypto.timingSafeEqual(stateBuffer,storedBuffer))throw new Error('Discord OAuth state mismatch');
  const tokenResponse=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.DISCORD_CLIENT_ID!,client_secret:env.DISCORD_CLIENT_SECRET!,grant_type:'authorization_code',code,redirect_uri:env.DISCORD_REDIRECT_URI!})});
  if(!tokenResponse.ok)throw new Error('Discord token exchange failed');
  const token=z.object({access_token:z.string().min(1),token_type:z.string().default('Bearer')}).parse(await tokenResponse.json());
  const userResponse=await fetch('https://discord.com/api/v10/users/@me',{headers:{authorization:`${token.token_type} ${token.access_token}`}});
  if(!userResponse.ok)throw new Error('Discord user lookup failed');
  const discord=z.object({id:z.string().regex(/^\d{17,20}$/),username:z.string(),global_name:z.string().nullable().optional(),avatar:z.string().nullable().optional()}).parse(await userResponse.json());
  const displayName=discord.global_name||discord.username;
  const avatarUrl=discord.avatar?`https://cdn.discordapp.com/avatars/${discord.id}/${discord.avatar}.png?size=128`:null;
  const knownAccount=await prisma.discordAccount.findUnique({where:{discordUserId:discord.id},select:{discordUserId:true}});
  await prisma.discordAccount.upsert({where:{discordUserId:discord.id},create:{discordUserId:discord.id,username:displayName,avatarUrl},update:{username:displayName,avatarUrl,lastLoginAt:new Date(),loginCount:{increment:1}}});
  const options=await discordScopeOptions(discord.id);
  if(!options.length){
    await audit({action:'AUTH_DISCORD_ORGANIZATION_DENIED',actorType:'ANONYMOUS',ip:req.ip,details:{discordUserId:discord.id},level:'warn'});
    return res.redirect(`/bp/events/error?reason=${knownAccount?'unassigned':'not-recorded'}`);
  }
  await prisma.organizationDiscordMember.updateMany({where:{discordUserId:discord.id},data:{username:displayName,avatarUrl}});
  const choiceCsrf=randomToken(18);res.cookie(discordChoiceCookie,signDiscordChoice(discord.id),discordChoiceOptions);res.cookie(discordChoiceCsrfCookie,choiceCsrf,{secure:env.NODE_ENV==='production',sameSite:'lax',maxAge:10*60_000,path:'/'});
  res.redirect('/auth/scope');
}catch(error){logger.warn({err:(error as Error).message},'Discord authentication rejected');res.redirect('/bp/events/error')}});

app.get('/api/auth/discord/options',async(req,res)=>{const pending=readDiscordChoice(req);if(!pending)return res.status(401).json({error:'登入選擇已過期，請重新使用 Discord 登入'});res.set('Cache-Control','no-store').json({options:await discordScopeOptions(pending.discordUserId)})});
app.post('/api/auth/discord/select',origin,async(req,res)=>{try{const pending=readDiscordChoice(req),csrf=String(req.get('x-csrf-token')||''),storedCsrf=String(req.cookies?.[discordChoiceCsrfCookie]||'');if(!pending||!csrf||csrf!==storedCsrf)return res.status(403).json({error:'登入選擇已過期或驗證失敗'});const body=z.object({type:z.enum(['pulse','organization']),organizationId:z.string().nullable().optional()}).parse(req.body),isPulse=pending.discordUserId===env.PULSE_DISCORD_USER_ID;if(body.type==='pulse'){if(!isPulse)return res.status(403).json({error:'沒有 Pulse Studio 全域管理權限'});const admin=await prisma.adminUser.findFirst({where:{disabledAt:null},orderBy:{createdAt:'asc'}});if(!admin)return res.status(503).json({error:'Pulse administrator is not initialized'});await createSession(res,'admin',{id:admin.id});await audit({action:'AUTH_DISCORD_PULSE_SUCCESS',actorType:'PULSE_ADMIN',actorId:admin.id,ip:req.ip,details:{discordUserId:pending.discordUserId}});clearDiscordChoice(res);return res.json({redirect:'/admin'})}if(!body.organizationId)return res.status(400).json({error:'請選擇賽事單位'});const organization=await prisma.organization.findFirst({where:{id:body.organizationId,deletedAt:null,status:'ACTIVE',OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}],...(isPulse?{}:{discordMembers:{some:{discordUserId:pending.discordUserId}}})}});if(!organization)return res.status(403).json({error:'沒有此賽事單位的管理權限'});await createSession(res,'organization',{id:organization.id},organization.expiresAt||undefined);await audit({action:'AUTH_DISCORD_ORGANIZATION_SUCCESS',actorType:'ORGANIZATION',actorId:organization.id,organizationId:organization.id,ip:req.ip,details:{discordUserId:pending.discordUserId,isPulse}});clearDiscordChoice(res);res.json({redirect:`/bp/events/${encodeURIComponent(organization.id)}`})}catch(e){safeError(res,e)}});

app.post('/api/auth/organization',origin,async(req,res)=>{try{
  const key=z.string().min(6).max(64).parse(req.body?.key).trim();
  if(key.toLowerCase()===env.PULSE_ENTRY_IDENTIFIER.toLowerCase())return res.json({ok:true,requiresPulsePassword:true});
  const record=await prisma.organizationAccessKey.findUnique({where:{lookupHash:lookupHash(key)},include:{organization:true}});
  if(!record||record.revokedAt||record.expiresAt<=new Date()||record.organization.status!=='ACTIVE'||record.organization.expiresAt&&record.organization.expiresAt<=new Date()||!await verifySecret(record.verificationHash,key.replace(/-/g,''))){await audit({action:'AUTH_ORGANIZATION_FAILED',actorType:'ANONYMOUS',ip:req.ip,level:'warn'});return res.status(401).json({error:'賽事單位授權碼無效、過期或已停用'});}
  await createSession(res,'organization',{id:record.organizationId},record.expiresAt);
  await prisma.organizationAccessKey.update({where:{id:record.id},data:{lastUsedAt:new Date(),failedAttemptCount:0}});
  await audit({action:'AUTH_ORGANIZATION_SUCCESS',actorType:'ORGANIZATION',actorId:record.organizationId,organizationId:record.organizationId,ip:req.ip,details:{lastFour:record.lastFour}});
  res.json({ok:true,redirect:`/bp/events/${encodeURIComponent(record.organizationId)}`});
}catch(e){safeError(res,e);}});

app.post('/api/auth/pulse',origin,async(req,res)=>{try{
  const body=z.object({identifier:z.string(),password:z.string().min(1)}).parse(req.body);
  if(body.identifier.toLowerCase()!==env.PULSE_ENTRY_IDENTIFIER.toLowerCase())return res.status(401).json({error:'驗證失敗'});
  const admin=await prisma.adminUser.findFirst({where:{disabledAt:null},orderBy:{createdAt:'asc'}}),passwordHash=admin?.passwordHash||env.PULSE_ADMIN_PASSWORD_HASH;
  if(!passwordHash||!await verifySecret(passwordHash,body.password)){await audit({action:'AUTH_PULSE_FAILED',actorType:'ANONYMOUS',ip:req.ip,level:'warn'});return res.status(401).json({error:'Pulse Studio 管理員驗證失敗'});}
  if(!admin)return res.status(503).json({error:'請先執行 npm run admin:create 建立本機管理員'});
  await createSession(res,'admin',{id:admin.id});await audit({action:'AUTH_PULSE_SUCCESS',actorType:'PULSE_ADMIN',actorId:admin.id,ip:req.ip});res.json({ok:true,redirect:'/pulse'});
}catch(e){safeError(res,e);}});

app.post('/api/auth/logout',origin,async(req,res)=>{const team=req.cookies?.veto_team_session,org=req.cookies?.veto_organization_session,admin=req.cookies?.veto_admin_session;if(team)await prisma.teamSession.updateMany({where:{tokenHash:tokenHash(team)},data:{revokedAt:new Date()}});if(org)await prisma.organizationSession.updateMany({where:{tokenHash:tokenHash(org)},data:{revokedAt:new Date()}});if(admin)await prisma.adminSession.updateMany({where:{tokenHash:tokenHash(admin)},data:{revokedAt:new Date()}});for(const name of ['veto_team_session','veto_organization_session','veto_admin_session','veto_csrf'])res.clearCookie(name,{path:'/'});res.status(204).end();});
app.get('/team',async(req,res)=>{const team=await currentTeam(req);return res.redirect(team?`/bp/teams/${encodeURIComponent(team.vetoSessionId)}`:'/')});
app.get('/api/team/snapshot',async(req,res)=>{const auth=await currentTeam(req);if(!auth)return res.status(401).json({error:'Session expired'});const resultToken=await prisma.publicToken.findFirst({where:{vetoSessionId:auth.vetoSessionId,type:'RESULT',revokedAt:null},select:{encryptedToken:true}});res.json({...await vetoSnapshot(auth.vetoSessionId),viewer:{team:auth.team,expiresAt:auth.expiresAt,welcomeRequired:auth.welcomeRequired},resultUrl:resultToken?.encryptedToken?`/result/${encodeURIComponent(decryptSecret(resultToken.encryptedToken))}`:null});});
app.post('/api/team/intro-seen',origin,requireCsrf(currentTeam),async(req,res)=>{const auth=await currentTeam(req);if(!auth)return res.status(401).json({error:'Session expired'});await prisma.teamSession.update({where:{id:auth.id},data:{welcomeRequired:false}});res.status(204).end()});
app.post('/api/team/ready',origin,requireCsrf(currentTeam),async(req,res)=>{try{const auth=await currentTeam(req);if(!auth)return res.status(401).json({error:'Session expired'});const body=z.object({expectedVersion:z.number().int()}).parse(req.body),result=await confirmTeamReady({sessionId:auth.vetoSessionId,team:auth.team,expectedVersion:body.expectedVersion}),snap=await vetoSnapshot(auth.vetoSessionId);await audit({action:'TEAM_READY',actorType:auth.team,actorId:auth.id,vetoSessionId:auth.vetoSessionId,ip:req.ip,details:{started:result.started}});io.to(`veto:${auth.vetoSessionId}`).emit('veto:changed',{version:snap.version});io.to(`veto:${auth.vetoSessionId}`).emit('state_changed',overlayDto(snap));res.json(snap)}catch(e){safeError(res,e)}});
app.post('/api/team/action',origin,requireCsrf(currentTeam),async(req,res)=>{try{const auth=await currentTeam(req);if(!auth)return res.status(401).json({error:'Session expired'});const body=z.object({mapId:z.string(),expectedVersion:z.number().int()}).parse(req.body);const result=await submitMapAction({sessionId:auth.vetoSessionId,team:auth.team,mapId:body.mapId,expectedVersion:body.expectedVersion}),snap=await vetoSnapshot(auth.vetoSessionId),primary=snap.actions.find(a=>a.stepNumber===result.primary.stepNumber);await audit({action:`VETO_${result.primary.action}`,actorType:auth.team,actorId:auth.id,vetoSessionId:auth.vetoSessionId,ip:req.ip,details:{map:primary?.map.nameEn,step:result.primary.stepNumber}});if(result.autoDecider){const decider=snap.actions.at(-1);await audit({action:'VETO_DECIDER',actorType:'SYSTEM',vetoSessionId:auth.vetoSessionId,ip:req.ip,details:{map:decider?.map.nameEn,step:decider?.stepNumber}})}if(result.coinTossWinner)await audit({action:'COIN_TOSS',actorType:'SYSTEM',vetoSessionId:auth.vetoSessionId,ip:req.ip,details:{winner:result.coinTossWinner}});io.to(`veto:${auth.vetoSessionId}`).emit('veto:changed',{version:snap.version});io.to(`veto:${auth.vetoSessionId}`).emit('state_changed',overlayDto(snap));res.json(snap);}catch(e){safeError(res,e);}});
app.post('/api/team/side',origin,requireCsrf(currentTeam),async(req,res)=>{try{const auth=await currentTeam(req);if(!auth)return res.status(401).json({error:'Session expired'});const body=z.object({side:z.enum(['ATTACK','DEFENSE']),expectedVersion:z.number().int()}).parse(req.body);const result=await submitSide({sessionId:auth.vetoSessionId,team:auth.team,side:body.side,expectedVersion:body.expectedVersion}),snap=await vetoSnapshot(auth.vetoSessionId),selected=snap.actions.find(action=>action.id===result.selectedActionId);await audit({action:'SIDE_SELECTED',actorType:auth.team,actorId:auth.id,vetoSessionId:auth.vetoSessionId,ip:req.ip,details:{map:selected?.map.nameEn,side:body.side}});if(result.autoDecider){const decider=snap.actions.at(-1);await audit({action:'VETO_DECIDER',actorType:'SYSTEM',vetoSessionId:auth.vetoSessionId,ip:req.ip,details:{map:decider?.map.nameEn,step:decider?.stepNumber}})}if(result.coinTossWinner)await audit({action:'COIN_TOSS',actorType:'SYSTEM',vetoSessionId:auth.vetoSessionId,ip:req.ip,details:{winner:result.coinTossWinner}});if(result.complete){await audit({action:'VETO_COMPLETED',actorType:'SYSTEM',vetoSessionId:auth.vetoSessionId,ip:req.ip});void createBackup(`completed-${auth.vetoSessionId}`).catch(error=>logger.error({err:error},'Automatic completion backup failed'))}io.to(`veto:${auth.vetoSessionId}`).emit('veto:changed',{version:snap.version});io.to(`veto:${auth.vetoSessionId}`).emit('state_changed',overlayDto(snap));res.json(snap);}catch(e){safeError(res,e);}});

app.post('/api/team/random-confirm',origin,requireCsrf(currentTeam),async(req,res)=>{try{const auth=await currentTeam(req);if(!auth)return res.status(401).json({error:'Session expired'});const body=z.object({expectedVersion:z.number().int()}).parse(req.body),result=await confirmRandomResult({sessionId:auth.vetoSessionId,team:auth.team,expectedVersion:body.expectedVersion}),snap=await vetoSnapshot(auth.vetoSessionId),confirmed=snap.actions.find(action=>action.id===result.actionId);await audit({action:'RANDOM_RESULT_CONFIRMED',actorType:auth.team,actorId:auth.id,vetoSessionId:auth.vetoSessionId,ip:req.ip,details:{map:confirmed?.map.nameEn,step:confirmed?.stepNumber}});if(result.complete){await audit({action:'VETO_COMPLETED',actorType:'SYSTEM',vetoSessionId:auth.vetoSessionId,ip:req.ip});void createBackup(`completed-${auth.vetoSessionId}`).catch(error=>logger.error({err:error},'Automatic completion backup failed'))}io.to(`veto:${auth.vetoSessionId}`).emit('veto:changed',{version:snap.version});io.to(`veto:${auth.vetoSessionId}`).emit('state_changed',overlayDto(snap));res.json(snap)}catch(e){safeError(res,e)}});

for(const theme of ['vct-en','vct-en-i','vct-tc','vct-tc-i','vct-cn','vct-cn-i']) app.get(`/overlay-${theme}/:token`,async(req,res)=>{const t=await prisma.publicToken.findFirst({where:{tokenHash:tokenHash(req.params.token),type:'OVERLAY',revokedAt:null}});if(!t)return res.status(404).send('Overlay not found');const fileTheme=theme.replace('vct-cn','vct-tc');res.set('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet').sendFile(path.resolve(`public/overlay-${fileTheme}.html`));});
for(const view of ['full','map-pool','result'])app.get(`/overlay/${view}/:token`,async(req,res)=>{const t=await prisma.publicToken.findFirst({where:{tokenHash:tokenHash(String(req.params.token)),type:'OVERLAY',revokedAt:null},include:{vetoSession:true}});if(!t)return res.status(404).send('Overlay not found');const theme=['vct-en','vct-en-i','vct-tc','vct-tc-i'].includes(t.vetoSession.overlayTheme)?t.vetoSession.overlayTheme:'vct-tc';res.set('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet').sendFile(path.resolve(`public/overlay-${theme}.html`))});
app.get('/overlay/current/:token',async(req,res)=>{const t=await prisma.publicToken.findFirst({where:{tokenHash:tokenHash(String(req.params.token)),type:'OVERLAY',revokedAt:null}});if(!t)return res.status(404).send('Overlay not found');res.set('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet').sendFile(path.resolve('public/overlay-current.html'))});
app.get('/api/public/overlay/:token',async(req,res)=>{const t=await prisma.publicToken.findFirst({where:{tokenHash:tokenHash(req.params.token),type:'OVERLAY',revokedAt:null}});if(!t)return res.status(404).json({error:'Not found'});res.json(overlayDto(await vetoSnapshot(t.vetoSessionId)));});
app.get('/api/maps',async(_req,res)=>res.json({success:true,data:(await prisma.map.findMany({where:{enabled:true},orderBy:{nameEn:'asc'}})).map(m=>({uuid:m.id,name:m.nameEn,nameZh:m.nameZhTw,nameZhCn:m.nameZhCn,splash:m.localImagePath||m.splashUrl}))}));
type PublicResultLocale='zh-TW'|'zh-CN'|'en-US'|'ja-JP';
const resultCopy:Record<PublicResultLocale,{htmlLang:string;ogLocale:string;title:string;description:(event:string)=>string;label:string;footer:string}>={
  'zh-TW':{htmlLang:'zh-Hant',ogLocale:'zh_TW',title:'Ban/Pick 結果',description:event=>`查看 ${event} 的 VALORANT 地圖 Ban/Pick 與選邊結果。`,label:'BAN / PICK 結果',footer:'VALORANT 賽事地圖 Ban/Pick'},
  'zh-CN':{htmlLang:'zh-Hans',ogLocale:'zh_CN',title:'Ban/Pick 结果',description:event=>`查看 ${event} 的 VALORANT 地图 Ban/Pick 与选边结果。`,label:'BAN / PICK 结果',footer:'VALORANT 赛事地图 Ban/Pick'},
  'en-US':{htmlLang:'en-US',ogLocale:'en_US',title:'Ban/Pick Result',description:event=>`View the VALORANT map Ban/Pick and side-selection result for ${event}.`,label:'BAN / PICK RESULT',footer:'VALORANT COMPETITIVE MAP VETO'},
  'ja-JP':{htmlLang:'ja-JP',ogLocale:'ja_JP',title:'BAN/PICK 結果',description:event=>`${event} のVALORANTマップBAN/PICKとサイド選択結果を確認できます。`,label:'BAN / PICK 結果',footer:'VALORANT 競技マップVETO'}
};
function publicResultLocale(req:express.Request):PublicResultLocale{const value=String(req.query.lang||req.cookies?.pv_locale||'');return value==='zh-CN'||value==='en-US'||value==='ja-JP'?value:'zh-TW'}
app.get('/result/:token',async(req,res)=>{const token=String(req.params.token),locale=publicResultLocale(req),copy=resultCopy[locale],t=await prisma.publicToken.findFirst({where:{tokenHash:tokenHash(token),type:'RESULT',revokedAt:null},include:{vetoSession:{include:{event:true}}}});if(!t)return res.status(404).sendFile(path.resolve('public/private-result.html'));const m=pageMetadata({title:`${t.vetoSession.teamAName} vs ${t.vetoSession.teamBName}｜${copy.title}`,description:copy.description(t.vetoSession.event.name),path:req.path,image:`/result/${encodeURIComponent(token)}/og.png?lang=${locale}`,locale:copy.ogLocale});res.set('Content-Language',locale).send((await fs.promises.readFile(path.resolve('public/result.html'),'utf8')).replace('<html lang="zh-Hant">',`<html lang="${copy.htmlLang}">`).replace('<!--METADATA-->',metadataHtml(m)));});
app.get('/result/:token/og.png',async(req,res)=>{const locale=publicResultLocale(req),copy=resultCopy[locale],t=await prisma.publicToken.findFirst({where:{tokenHash:tokenHash(String(req.params.token)),type:'RESULT',revokedAt:null},include:{vetoSession:{include:{event:true}}}});if(!t)return res.status(404).end();const e=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!)),logo=(await fs.promises.readFile(path.resolve('public/branding/PulseVeto_MainIcon.png'))).toString('base64'),svg=`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pulse" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5865f2"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient><pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#5865f2" stroke-opacity=".055"/></pattern></defs><rect width="1200" height="630" fill="#f7f8fc"/><rect width="1200" height="630" fill="url(#grid)"/><circle cx="105" cy="55" r="260" fill="#5865f2" opacity=".07"/><circle cx="1135" cy="570" r="310" fill="#8b5cf6" opacity=".08"/><rect x="42" y="38" width="1116" height="554" rx="30" fill="white" stroke="#dde2ec" stroke-width="2"/><rect x="42" y="38" width="10" height="554" rx="5" fill="url(#pulse)"/><image href="data:image/png;base64,${logo}" x="82" y="70" width="230" height="62" preserveAspectRatio="xMinYMid meet"/><text x="1115" y="106" text-anchor="end" fill="#707887" font-family="Arial" font-size="19" letter-spacing="3">MATCH BP</text><text x="600" y="212" text-anchor="middle" fill="#707887" font-family="Arial" font-size="25">${e(t.vetoSession.event.name)}</text><text x="600" y="330" text-anchor="middle" fill="#171a22" font-family="Arial" font-weight="700" font-size="58">${e(t.vetoSession.teamAName)}  VS  ${e(t.vetoSession.teamBName)}</text><rect x="385" y="378" width="430" height="58" rx="29" fill="url(#pulse)"/><text x="600" y="416" text-anchor="middle" fill="white" font-family="Arial" font-weight="700" font-size="25" letter-spacing="2">${e(copy.label)}</text><text x="600" y="522" text-anchor="middle" fill="#707887" font-family="Arial" font-size="22">${e(copy.footer)}</text><circle cx="535" cy="554" r="5" fill="#5865f2"/><rect x="552" y="550" width="113" height="8" rx="4" fill="url(#pulse)"/></svg>`;res.set({'Content-Type':'image/png','Content-Language':locale,'Cache-Control':'public, max-age=300'}).send(await sharp(Buffer.from(svg)).png().toBuffer())});
app.get('/api/public/result/:token',async(req,res)=>{const t=await prisma.publicToken.findFirst({where:{tokenHash:tokenHash(req.params.token),type:'RESULT',revokedAt:null}});if(!t)return res.status(404).json({error:'Not found'});res.json(await vetoSnapshot(t.vetoSessionId));});

io.on('connection',socket=>{
  const cookieHeader=socket.handshake.headers.cookie||'';const sessionCookie=cookieHeader.split(';').map(x=>x.trim()).find(x=>x.startsWith('veto_team_session='))?.slice('veto_team_session='.length);if(sessionCookie){const now=new Date();void prisma.teamSession.findFirst({where:{tokenHash:tokenHash(decodeURIComponent(sessionCookie)),revokedAt:null,expiresAt:{gt:now},vetoSession:{deletedAt:null,event:{deletedAt:null,organization:{deletedAt:null,status:'ACTIVE',OR:[{expiresAt:null},{expiresAt:{gt:now}}]}}}}}).then(s=>{if(s)socket.join(`veto:${s.vetoSessionId}`)})}
  const join=async(token:string,ack:(v:unknown)=>void,legacy=false)=>{const now=new Date(),team=await prisma.teamSession.findFirst({where:{tokenHash:tokenHash(token||''),revokedAt:null,expiresAt:{gt:now},vetoSession:{deletedAt:null,event:{deletedAt:null,organization:{deletedAt:null,status:'ACTIVE',OR:[{expiresAt:null},{expiresAt:{gt:now}}]}}}}});const pub=team?null:await prisma.publicToken.findFirst({where:{tokenHash:tokenHash(token||''),type:'OVERLAY',revokedAt:null}});const id=team?.vetoSessionId||pub?.vetoSessionId;if(!id)return ack({ok:false});socket.join(`veto:${id}`);socket.data.vetoSessionId=id;if(legacy){const snap=await vetoSnapshot(id);socket.emit('init_data',{session:{name:snap.event.name,expiry:'',state:overlayDto(snap)}});}ack({ok:true});};
  socket.on('join_veto',(token:string,ack=()=>{})=>void join(token,ack));
  socket.on('join_room',(token:string,ack=()=>{})=>void join(token,ack,true));
});

let timeoutSweepRunning=false;
async function sweepExpiredVetoTimers(){
  if(timeoutSweepRunning)return;timeoutSweepRunning=true;
  try{const expired=await prisma.vetoSession.findMany({where:{actionDeadlineAt:{lte:new Date()},status:{in:['ACTIVE','WAITING_FOR_SIDE_SELECTION']}},select:{id:true,status:true}});for(const item of expired){const room=`veto:${item.id}`;try{io.to(room).emit('veto:timeout-pending',{kind:item.status==='ACTIVE'?'MAP':'SIDE'});const result=await processVetoTimeout(item.id);if(!result){io.to(room).emit('veto:timeout-cancelled');continue}await audit({action:'BP_TIMEOUT_RANDOM_DRAW',actorType:'SYSTEM',vetoSessionId:item.id,details:result,level:'warn'});const snap=await vetoSnapshot(item.id);io.to(room).emit('veto:changed',{version:snap.version,timeout:true});io.to(room).emit('state_changed',overlayDto(snap))}catch(error){io.to(room).emit('veto:timeout-cancelled');logger.warn({category:'BP_TIMER',vetoSessionId:item.id,err:(error as Error).message},'BP timeout processing skipped')}}}finally{timeoutSweepRunning=false}
}

if(env.NODE_ENV!=='test'){
  await connectDatabase();
  try{const maps=await ensureMapCatalog();logger.info({category:'MAP_SYNC',source:maps.source,count:maps.count},'Map catalog ready')}
  catch(error){logger.error({category:'MAP_SYNC',err:error},'Map catalog unavailable; use Pulse Studio map sync when network is available')}
  try{const purged=await purgeExpiredDeleted();if(purged.organizations||purged.events||purged.vetoSessions)logger.info({category:'RECYCLE_BIN',...purged},'Expired deleted records purged')}catch(error){logger.error({category:'RECYCLE_BIN',err:error},'Recycle bin purge failed')}
  setInterval(()=>void purgeExpiredDeleted().catch(error=>logger.error({category:'RECYCLE_BIN',err:error},'Scheduled recycle bin purge failed')),60*60_000).unref();
  setInterval(()=>void createBackup('scheduled').catch(error=>logger.error({err:error},'Scheduled backup failed')),24*60*60_000).unref();
  setInterval(()=>void sweepExpiredVetoTimers().catch(error=>logger.error({category:'BP_TIMER',err:error},'BP timer sweep failed')),1000).unref();
  server.listen(env.PORT,()=>{startStatusMonitor(env.PORT);logger.info({category:'SYSTEM',port:env.PORT},'Server started');});
  for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,async()=>{logger.info({category:'SYSTEM'},'Server stopping');await prisma.$disconnect();server.close(()=>process.exit(0));});
}
export {app,server};
