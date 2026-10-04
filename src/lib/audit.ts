import { prisma } from './db.js';
import { logger } from './logger.js';
import { maskedIp, redact } from './security.js';

export async function audit(input:{action:string;actorType:string;actorId?:string;organizationId?:string;eventId?:string;vetoSessionId?:string;entityType?:string;entityId?:string;ip?:string;details?:unknown;level?:'info'|'warn'|'error'}) {
  const safe=redact(input.details??{});
  await prisma.auditLog.create({data:{action:input.action,actorType:input.actorType,actorId:input.actorId,organizationId:input.organizationId,eventId:input.eventId,vetoSessionId:input.vetoSessionId,entityType:input.entityType,entityId:input.entityId,ipMasked:maskedIp(input.ip),detailsJson:JSON.stringify(safe)}});
  logger[input.level||'info']({category:'AUDIT',action:input.action,actorType:input.actorType,actorId:input.actorId,details:safe},input.action);
}
