import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import pretty from 'pino-pretty';
import { redact } from './security.js';

const dir=path.resolve('storage/logs'); fs.mkdirSync(dir,{recursive:true});
const streams=[{stream:pretty({colorize:process.stdout.isTTY,translateTime:false,ignore:'pid,hostname',singleLine:false})},{stream:pino.destination(path.join(dir,'application.log'))},{level:'error',stream:pino.destination(path.join(dir,'error.log'))}];
export const logger=pino({level:process.env.LOG_LEVEL||'info',base:undefined,timestamp:()=>`,"time":"${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'medium',hour12:false}).format(new Date())} +08:00"`,formatters:{log:(o)=>redact(o) as Record<string,unknown>}},pino.multistream(streams));

const logFile=path.join(dir,'application.log');
const sanitizeLogLine=(line:string)=>line
  .replace(/("(?:authorization|cookie|token|secret|password|key)"\s*:\s*)"[^"]*"/gi,'$1"[REDACTED]"')
  .replace(/(authorization|cookie|token|secret|password|key)\s*[=:]\s*[^,\s}"']+/gi,'$1=[REDACTED]')
  .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi,'Bearer [REDACTED]');

export async function readServerLogs(limit=300){
  const content=await fs.promises.readFile(logFile,'utf8').catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return'';throw error});
  return content.split(/\r?\n/).filter(Boolean).slice(-limit).map(line=>{const raw=sanitizeLogLine(line);try{return{raw,entry:JSON.parse(raw) as Record<string,unknown>}}catch{return{raw,entry:{level:30,msg:raw}}}});
}
