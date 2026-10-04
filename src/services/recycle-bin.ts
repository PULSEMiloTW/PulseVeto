import {EventStatus,OrganizationStatus,Prisma,VetoStatus} from '@prisma/client';
import {prisma} from '../lib/db.js';

const RETENTION_MS=7*24*60*60_000;
const deletionWindow=()=>{const deletedAt=new Date();return{deletedAt,purgeAt:new Date(deletedAt.getTime()+RETENTION_MS)}};
const organizationStatus=(value:string|null)=>Object.values(OrganizationStatus).includes(value as OrganizationStatus)?value as OrganizationStatus:OrganizationStatus.ACTIVE;
const eventStatus=(value:string|null)=>Object.values(EventStatus).includes(value as EventStatus)?value as EventStatus:EventStatus.ACTIVE;
const vetoStatus=(value:string|null)=>Object.values(VetoStatus).includes(value as VetoStatus)?value as VetoStatus:VetoStatus.DRAFT;

async function revokeVetoAccess(tx:Prisma.TransactionClient,vetoIds:string[],now:Date){
  if(!vetoIds.length)return;
  await tx.teamSession.updateMany({where:{vetoSessionId:{in:vetoIds},revokedAt:null},data:{revokedAt:now}});
  await tx.teamAccessKey.updateMany({where:{vetoSessionId:{in:vetoIds},revokedAt:null},data:{revokedAt:now}});
  await tx.publicToken.updateMany({where:{vetoSessionId:{in:vetoIds},revokedAt:null},data:{revokedAt:now}});
}
async function restoreVetoAccess(tx:Prisma.TransactionClient,vetoSessionId:string,deletedAt:Date){
  await tx.teamSession.updateMany({where:{vetoSessionId,revokedAt:deletedAt},data:{revokedAt:null}});
  await tx.teamAccessKey.updateMany({where:{vetoSessionId,revokedAt:deletedAt},data:{revokedAt:null}});
  await tx.publicToken.updateMany({where:{vetoSessionId,revokedAt:deletedAt},data:{revokedAt:null}});
}

export async function deleteOrganization(id:string){
  const org=await prisma.organization.findUnique({where:{id},include:{events:{include:{vetoSessions:true}}}});if(!org||org.deletedAt)return org;
  const window=deletionWindow(),events=org.events,vetoes=events.flatMap(event=>event.vetoSessions);
  return prisma.$transaction(async tx=>{
    await revokeVetoAccess(tx,vetoes.map(v=>v.id),window.deletedAt);
    await tx.organizationSession.updateMany({where:{organizationId:id,revokedAt:null},data:{revokedAt:window.deletedAt}});
    for(const veto of vetoes)await tx.vetoSession.update({where:{id:veto.id},data:{...window,statusBeforeDelete:veto.status,status:VetoStatus.CANCELLED}});
    for(const event of events)await tx.event.update({where:{id:event.id},data:{...window,statusBeforeDelete:event.status,status:EventStatus.ARCHIVED}});
    return tx.organization.update({where:{id},data:{...window,statusBeforeDelete:org.status,status:OrganizationStatus.ARCHIVED}});
  });
}

export async function deleteEvent(id:string){
  const event=await prisma.event.findUnique({where:{id},include:{vetoSessions:true}});if(!event||event.deletedAt)return event;
  const window=deletionWindow();
  return prisma.$transaction(async tx=>{
    await revokeVetoAccess(tx,event.vetoSessions.map(v=>v.id),window.deletedAt);
    for(const veto of event.vetoSessions)await tx.vetoSession.update({where:{id:veto.id},data:{...window,statusBeforeDelete:veto.status,status:VetoStatus.CANCELLED}});
    return tx.event.update({where:{id},data:{...window,statusBeforeDelete:event.status,status:EventStatus.ARCHIVED}});
  });
}

export async function deleteVetoSession(id:string){
  const veto=await prisma.vetoSession.findUnique({where:{id}});if(!veto||veto.deletedAt)return veto;
  const window=deletionWindow();return prisma.$transaction(async tx=>{await revokeVetoAccess(tx,[id],window.deletedAt);return tx.vetoSession.update({where:{id},data:{...window,statusBeforeDelete:veto.status,status:VetoStatus.CANCELLED}})});
}

export async function restoreOrganization(id:string){
  const org=await prisma.organization.findUnique({where:{id},include:{events:{include:{vetoSessions:true}}}});if(!org?.deletedAt)return org;
  return prisma.$transaction(async tx=>{
    for(const event of org.events.filter(e=>e.deletedAt&&e.deletedAt.getTime()===org.deletedAt!.getTime())){
      for(const veto of event.vetoSessions.filter(v=>v.deletedAt&&v.deletedAt.getTime()===org.deletedAt!.getTime())){await restoreVetoAccess(tx,veto.id,veto.deletedAt!);await tx.vetoSession.update({where:{id:veto.id},data:{deletedAt:null,purgeAt:null,status:vetoStatus(veto.statusBeforeDelete),statusBeforeDelete:null}})}
      await tx.event.update({where:{id:event.id},data:{deletedAt:null,purgeAt:null,status:eventStatus(event.statusBeforeDelete),statusBeforeDelete:null}});
    }
    return tx.organization.update({where:{id},data:{deletedAt:null,purgeAt:null,status:organizationStatus(org.statusBeforeDelete),statusBeforeDelete:null}});
  });
}

export async function restoreEvent(id:string){
  const event=await prisma.event.findUnique({where:{id},include:{organization:true,vetoSessions:true}});if(!event?.deletedAt)return event;if(event.organization.deletedAt)throw Object.assign(new Error('請先復原所屬賽事單位'),{status:409});
  return prisma.$transaction(async tx=>{
    for(const veto of event.vetoSessions.filter(v=>v.deletedAt&&v.deletedAt.getTime()===event.deletedAt!.getTime())){await restoreVetoAccess(tx,veto.id,veto.deletedAt!);await tx.vetoSession.update({where:{id:veto.id},data:{deletedAt:null,purgeAt:null,status:vetoStatus(veto.statusBeforeDelete),statusBeforeDelete:null}})}
    return tx.event.update({where:{id},data:{deletedAt:null,purgeAt:null,status:eventStatus(event.statusBeforeDelete),statusBeforeDelete:null}});
  });
}

export async function restoreVetoSession(id:string){
  const veto=await prisma.vetoSession.findUnique({where:{id},include:{event:{include:{organization:true}}}});if(!veto?.deletedAt)return veto;if(veto.event.deletedAt||veto.event.organization.deletedAt)throw Object.assign(new Error('請先復原所屬賽事單位與賽事'),{status:409});
  return prisma.$transaction(async tx=>{await restoreVetoAccess(tx,id,veto.deletedAt!);return tx.vetoSession.update({where:{id},data:{deletedAt:null,purgeAt:null,status:vetoStatus(veto.statusBeforeDelete),statusBeforeDelete:null}})});
}

export async function purgeExpiredDeleted(now=new Date()){
  const vetoIds=(await prisma.vetoSession.findMany({where:{purgeAt:{lte:now}},select:{id:true}})).map(x=>x.id);
  const eventIds=(await prisma.event.findMany({where:{purgeAt:{lte:now}},select:{id:true}})).map(x=>x.id);
  const organizationIds=(await prisma.organization.findMany({where:{purgeAt:{lte:now}},select:{id:true}})).map(x=>x.id);
  if(!vetoIds.length&&!eventIds.length&&!organizationIds.length)return{vetoSessions:0,events:0,organizations:0};
  return prisma.$transaction(async tx=>{
    if(vetoIds.length){await tx.mapSideSelection.deleteMany({where:{vetoSessionId:{in:vetoIds}}});await tx.mapResult.deleteMany({where:{vetoSessionId:{in:vetoIds}}});await tx.vetoAction.deleteMany({where:{vetoSessionId:{in:vetoIds}}});await tx.vetoStep.deleteMany({where:{vetoSessionId:{in:vetoIds}}});await tx.teamSession.deleteMany({where:{vetoSessionId:{in:vetoIds}}});await tx.teamAccessKey.deleteMany({where:{vetoSessionId:{in:vetoIds}}});await tx.publicToken.deleteMany({where:{vetoSessionId:{in:vetoIds}}});await tx.vetoSession.deleteMany({where:{id:{in:vetoIds}}})}
    if(eventIds.length){await tx.eventMap.deleteMany({where:{eventId:{in:eventIds}}});await tx.event.deleteMany({where:{id:{in:eventIds}}})}
    if(organizationIds.length)await tx.organization.deleteMany({where:{id:{in:organizationIds}}});
    return{vetoSessions:vetoIds.length,events:eventIds.length,organizations:organizationIds.length};
  });
}
