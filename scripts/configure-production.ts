import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {prisma} from '../src/lib/db.js';
import {createBackup} from '../src/services/backup.js';

const oldSecret=process.env.KEY_ENCRYPTION_SECRET||'development-only-encryption-secret-change-me';
const newEncryptionSecret=crypto.randomBytes(48).toString('base64url');
const newSessionSecret=crypto.randomBytes(48).toString('base64url');
const key=(secret:string)=>crypto.createHash('sha256').update(secret).digest();
function decrypt(secret:string,payload:string){const [iv,tag,body]=payload.split('.');if(!iv||!tag||!body)throw new Error('Invalid encrypted value');const decipher=crypto.createDecipheriv('aes-256-gcm',key(secret),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(body,'base64url')),decipher.final()]).toString('utf8')}
function encrypt(secret:string,plaintext:string){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(secret),iv),body=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),body.toString('base64url')].join('.')}

await createBackup('pre-production-secret-rotation');
const [organizationKeys,teamKeys,publicTokens]=await Promise.all([prisma.organizationAccessKey.findMany({select:{id:true,encryptedKey:true}}),prisma.teamAccessKey.findMany({select:{id:true,encryptedKey:true}}),prisma.publicToken.findMany({where:{encryptedToken:{not:null}},select:{id:true,encryptedToken:true}})]);
await prisma.$transaction(async tx=>{
  for(const item of organizationKeys)await tx.organizationAccessKey.update({where:{id:item.id},data:{encryptedKey:encrypt(newEncryptionSecret,decrypt(oldSecret,item.encryptedKey))}});
  for(const item of teamKeys)await tx.teamAccessKey.update({where:{id:item.id},data:{encryptedKey:encrypt(newEncryptionSecret,decrypt(oldSecret,item.encryptedKey))}});
  for(const item of publicTokens)if(item.encryptedToken)await tx.publicToken.update({where:{id:item.id},data:{encryptedToken:encrypt(newEncryptionSecret,decrypt(oldSecret,item.encryptedToken))}});
});
const envFile=[
  'NODE_ENV=production',
  'DATABASE_URL=file:../storage/database/map-veto.db',
  `SESSION_SECRET=${newSessionSecret}`,
  `KEY_ENCRYPTION_SECRET=${newEncryptionSecret}`,
  'PUBLIC_BASE_URL=https://veto.pulse-studio.live',
  'TRUSTED_HOSTS=veto.pulse-studio.live,localhost,127.0.0.1',
  'PORT=3100',
  'LOG_LEVEL=info',
  'LOG_RETENTION_DAYS=30',
  'BACKUP_RETENTION_COUNT=14',
  'PULSE_ENTRY_IDENTIFIER=pulsemilotw',
  '',
].join('\n');
await fs.writeFile(path.resolve('.env'),envFile,{encoding:'utf8',mode:0o600});
await prisma.$disconnect();
console.log('Production configuration created; existing encrypted records rotated successfully.');
