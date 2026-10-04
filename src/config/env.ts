import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  DATABASE_URL: z.string().default('file:../storage/database/map-veto.db'),
  SESSION_SECRET: z.string().min(32).default('development-only-session-secret-change-me'),
  KEY_ENCRYPTION_SECRET: z.string().min(32).default('development-only-encryption-secret-change-me'),
  PULSE_ADMIN_PASSWORD_HASH: z.string().optional(),
  PULSE_ENTRY_IDENTIFIER: z.string().min(6).default('pulsemilotw'),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),
  PULSE_DISCORD_USER_ID: z.string().regex(/^\d{17,20}$/).default('1456945476933914626'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  TRUSTED_HOSTS: z.string().default('localhost,127.0.0.1'),
  LOG_LEVEL: z.string().default('info'),
  LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  BACKUP_RETENTION_COUNT: z.coerce.number().int().positive().default(14),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

if (process.env.NODE_ENV === 'production') {
  const unsafeSecrets = [
    ['SESSION_SECRET', process.env.SESSION_SECRET, 'development-only-session-secret-change-me'],
    ['KEY_ENCRYPTION_SECRET', process.env.KEY_ENCRYPTION_SECRET, 'development-only-encryption-secret-change-me'],
  ].filter(([,value,fallback])=>!value||value===fallback).map(([name])=>name);
  if (unsafeSecrets.length) throw new Error(`[CONFIG] Production requires non-default values for: ${unsafeSecrets.join(', ')}`);
}

export const env = schema.parse(process.env);
process.env.DATABASE_URL ||= env.DATABASE_URL;
export const trustedHosts = new Set(env.TRUSTED_HOSTS.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean));
export const discordOAuthConfigured = Boolean(env.DISCORD_CLIENT_ID&&env.DISCORD_CLIENT_SECRET&&env.DISCORD_REDIRECT_URI);
if (env.NODE_ENV === 'production' && !process.env.PUBLIC_BASE_URL) console.warn('[CONFIG] Production requires PUBLIC_BASE_URL for canonical and Open Graph URLs.');
if (env.NODE_ENV === 'production' && !discordOAuthConfigured) console.warn('[CONFIG] Discord OAuth is disabled until DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI are configured.');
