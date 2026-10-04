import type {Request,Response,NextFunction} from 'express';
import { prisma } from './db.js';
import { randomToken, tokenHash } from './security.js';

export const authCookie={httpOnly:true,sameSite:'lax' as const,secure:process.env.NODE_ENV==='production',maxAge:5*60*60_000,path:'/'};
export const csrfCookie={httpOnly:false,sameSite:'strict' as const,secure:process.env.NODE_ENV==='production',maxAge:5*60*60_000,path:'/'};
const clearAuthCookie={httpOnly:true,sameSite:'lax' as const,secure:process.env.NODE_ENV==='production',path:'/'};

export async function createSession(res:Response,kind:'admin'|'organization'|'team',owner:{id:string;vetoSessionId?:string;team?:'TEAM_A'|'TEAM_B';welcomeRequired?:boolean},expiresAt?:Date) {
  const raw=randomToken(),csrf=randomToken(24),expiry=expiresAt&&expiresAt.getTime()<Date.now()+authCookie.maxAge?expiresAt:new Date(Date.now()+authCookie.maxAge);
  if(kind==='admin')await prisma.adminSession.create({data:{id:randomToken(18),adminUserId:owner.id,tokenHash:tokenHash(raw),csrfHash:tokenHash(csrf),expiresAt:expiry}});
  if(kind==='organization')await prisma.organizationSession.create({data:{id:randomToken(18),organizationId:owner.id,tokenHash:tokenHash(raw),csrfHash:tokenHash(csrf),expiresAt:expiry}});
  if(kind==='team')await prisma.teamSession.create({data:{id:randomToken(18),vetoSessionId:owner.vetoSessionId!,team:owner.team!,tokenHash:tokenHash(raw),csrfHash:tokenHash(csrf),expiresAt:expiry,welcomeRequired:Boolean(owner.welcomeRequired)}});
  for(const other of ['admin','organization','team'] as const)if(other!==kind)res.clearCookie(`veto_${other}_session`,clearAuthCookie);
  res.cookie(`veto_${kind}_session`,raw,authCookie);res.cookie('veto_csrf',csrf,csrfCookie);
  return expiry;
}

export async function currentAdmin(req:Request){const raw=req.cookies?.veto_admin_session;if(!raw)return null;return prisma.adminSession.findFirst({where:{tokenHash:tokenHash(raw),revokedAt:null,expiresAt:{gt:new Date()},admin:{disabledAt:null}},include:{admin:true}})}
export async function currentOrganization(req:Request){const raw=req.cookies?.veto_organization_session;if(!raw)return null;const now=new Date();return prisma.organizationSession.findFirst({where:{tokenHash:tokenHash(raw),revokedAt:null,expiresAt:{gt:now},organization:{deletedAt:null,status:'ACTIVE',OR:[{expiresAt:null},{expiresAt:{gt:now}}]}},include:{organization:true}})}
export async function currentTeam(req:Request){const raw=req.cookies?.veto_team_session;if(!raw)return null;const now=new Date();return prisma.teamSession.findFirst({where:{tokenHash:tokenHash(raw),revokedAt:null,expiresAt:{gt:now},vetoSession:{deletedAt:null,event:{deletedAt:null,organization:{deletedAt:null,status:'ACTIVE',OR:[{expiresAt:null},{expiresAt:{gt:now}}]}}}}})}

export function requireCsrf(session:(req:Request)=>Promise<{csrfHash:string}|null>){return async(req:Request,res:Response,next:NextFunction)=>{const value=req.get('x-csrf-token');const record=await session(req);if(!record||!value||tokenHash(value)!==record.csrfHash)return res.status(403).json({error:'CSRF validation failed'});next()}}
