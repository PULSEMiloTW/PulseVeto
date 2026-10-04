import crypto from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TEAM_KEY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const SECRET_FIELDS = /authorization(code)?|teamkey|password|cookie|sessiontoken|encryptionsecret|cloudflare|token|keyhash|encryptedkey/i;

export function generateAccessKey(): string {
  const chars = Array.from({length: 16}, () => KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)]!);
  return chars.join('').replace(/(.{4})(?=.)/g, '$1-');
}

export function generateTeamAccessKey(): string {
  let key: string;
  do {
    key=Array.from({length:8},()=>TEAM_KEY_ALPHABET[crypto.randomInt(TEAM_KEY_ALPHABET.length)]!).join('');
  } while (!/[a-z]/.test(key)||!/[2-9]/.test(key));
  return key;
}

export const normalizeKey = (value: string) => value.toUpperCase().replace(/[^A-Z2-9]/g, '');
export const lookupHash = (value: string) => crypto.createHash('sha256').update(normalizeKey(value)).digest('hex');
export const tokenHash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes=32) => crypto.randomBytes(bytes).toString('base64url');

export async function hashSecret(secret: string) {
  return hash(secret, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 3, parallelism: 1, outputLen: 32 });
}
export async function verifySecret(hashValue: string, secret: string) { return verify(hashValue, secret); }

function encryptionKey() {
  return crypto.createHash('sha256').update(process.env.KEY_ENCRYPTION_SECRET || 'development-only-encryption-secret-change-me').digest();
}
export function encryptSecret(plaintext: string) {
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
  return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),body.toString('base64url')].join('.');
}
export function decryptSecret(payload: string) {
  const [iv,tag,body]=payload.split('.'); if(!iv||!tag||!body) throw new Error('Invalid encrypted value');
  const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'base64url'));
  decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body,'base64url')),decipher.final()]).toString('utf8');
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,SECRET_FIELDS.test(k)?'[REDACTED]':redact(v)]));
  return value;
}

export function maskedIp(ip='unknown') {
  if (ip.includes(':')) return `${ip.split(':').slice(0,3).join(':')}:xxxx`;
  const p=ip.split('.'); return p.length===4?`${p[0]}.${p[1]}.${p[2]}.xxx`:'unknown';
}
