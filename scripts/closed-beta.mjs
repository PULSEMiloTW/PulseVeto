import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import express from 'express';
import request from 'supertest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, 'output', 'closed-beta-runtime');
const port = Number(process.env.CLOSED_BETA_PORT || 3180);
if (!Number.isInteger(port) || port < 1024 || port > 65534 || [3000, 3100, 3110].includes(port)) throw new Error('Choose a preview port other than 3000, 3100 or 3110.');
// Reserve the exact loopback port before creating or changing any preview data.
const reservation = http.createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(port, '127.0.0.1', resolve); });
await fs.mkdir(path.join(runtime, 'storage', 'database'), { recursive: true });
// Windows Prisma's schema engine can fail to create a missing SQLite file in a child process.
const databaseHandle = await fs.open(path.join(runtime, 'storage', 'database', 'closed-beta.db'), 'a');
await databaseHandle.close();
for (const directory of ['public', 'docs']) {
  const destination = path.join(runtime, directory);
  try { await fs.symlink(path.join(root, directory), destination, 'junction'); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (await fs.realpath(destination) !== await fs.realpath(path.join(root, directory))) throw new Error(`Unexpected preview ${directory} path`);
}
const secretsFile = path.join(runtime, 'preview-secrets.json');
let secrets;
try { secrets = JSON.parse(await fs.readFile(secretsFile, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  secrets = { session: crypto.randomBytes(32).toString('hex'), encryption: crypto.randomBytes(32).toString('hex') };
  await fs.writeFile(secretsFile, JSON.stringify(secrets), { flag: 'wx', mode: 0o600 });
}
const base = `http://127.0.0.1:${port}`;
await fs.cp(path.join(root, 'prisma'), path.join(runtime, 'prisma'), { recursive: true, filter: source => !/\.(?:db|db-wal|db-shm)$/.test(source) });
// Give Prisma its own project boundary and empty env file; never discover the parent .env.
await fs.writeFile(path.join(runtime, 'package.json'), '{"private":true}');
await fs.writeFile(path.join(runtime, '.env'), '');
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_URL: `file:${path.join(runtime, 'storage', 'database', 'closed-beta.db').replaceAll('\\', '/')}`,
  DOTENV_CONFIG_PATH: path.join(runtime, 'unused.env'), PUBLIC_BASE_URL: base,
  SESSION_SECRET: secrets.session, KEY_ENCRYPTION_SECRET: secrets.encryption,
  PULSE_ENTRY_IDENTIFIER: 'closedbeta', PORT: String(port), TRUSTED_HOSTS: '127.0.0.1,localhost',
  HQ_HOST: '127.0.0.1', HQ_PORT: String(port + 1), LOG_LEVEL: 'warn',
});
for (const key of ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'PULSE_ADMIN_PASSWORD_HASH', 'HQ_TLS_CERT_FILE', 'HQ_TLS_KEY_FILE', 'HQ_HOSTNAME', 'HQ_ALLOWED_IPS']) delete process.env[key];
const migration = spawnSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy', '--schema', path.join(runtime, 'prisma', 'schema.prisma')], { cwd: runtime, env: { ...process.env, DATABASE_URL: 'file:../storage/database/closed-beta.db' }, stdio: 'inherit' });
if (migration.status !== 0) throw new Error('Preview migrations failed. Production database was not selected.');
process.chdir(runtime);
const { app, server, io, sweepExpiredVetoTimers } = await import('../src/server.ts');
const { prisma, connectDatabase } = await import('../src/lib/db.ts');
const { hashSecret } = await import('../src/lib/security.ts');
await connectDatabase();
await prisma.adminUser.upsert({ where: { username: 'closed-beta' }, update: {}, create: { username: 'closed-beta', passwordHash: await hashSecret('local-closed-beta-only') } });
const fixturePath = path.join(runtime, 'matches.json');
let matches;
try { matches = JSON.parse(await fs.readFile(fixturePath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  let catalog;
  try { catalog = JSON.parse(await fs.readFile(path.join(root, 'storage', 'cache', 'valorant-maps.json'), 'utf8')).data.slice(0, 7); }
  catch { catalog = ['Ascent', 'Bind', 'Haven', 'Split', 'Icebox', 'Lotus', 'Sunset'].map((name, index) => ({ uuid: `beta-map-${index}`, nameEn: name, nameZhTw: name, nameZhCn: name, splash: '/branding/PulseVeto_MainIcon.png' })); }
  if (catalog.length !== 7) throw new Error('Preview catalog requires seven sample maps.');
  for (const map of catalog) await prisma.map.upsert({ where: { id: map.uuid }, update: {}, create: { id: map.uuid, nameEn: map.nameEn, nameZhTw: map.nameZhTw, nameZhCn: map.nameZhCn || map.nameEn, splashUrl: map.splash, enabled: true } });
  const organization = await prisma.organization.create({ data: { name: 'PulseVeto 本地測試單位', status: 'ACTIVE' } });
  const event = await prisma.event.create({ data: { organizationId: organization.id, name: '封閉測試賽事', status: 'ACTIVE', themeColor: '#5865f2', maps: { create: catalog.map((map, index) => ({ mapId: map.uuid, sortOrder: index })) } } });
  // Seed through the real authenticated API, including its CSRF and BP rule validation.
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/pulse').send({ identifier: 'closedbeta', password: 'local-closed-beta-only' });
  if (login.status !== 200) throw new Error('Preview administrator login failed.');
  const csrfCookie = login.headers['set-cookie'].find(cookie => cookie.startsWith('veto_csrf='));
  const csrf = decodeURIComponent(csrfCookie.split(';')[0].slice('veto_csrf='.length));
  matches = [];
  for (const bestOf of [1, 3, 5]) {
    const name = `Bo${bestOf} 主題測試`;
    const created = await agent.post('/api/manage/veto-sessions').set('x-csrf-token', csrf).send({ eventId: event.id, name, bestOf, teamAName: 'Pulse Alpha', teamBName: 'Pulse Bravo', keyExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString() });
    if (created.status !== 201) throw new Error(`Preview Bo${bestOf} setup failed (${created.status}).`);
    matches.push({ name, keys: { A: created.body.teamAKey, B: created.body.teamBKey }, resultUrl: `/result/${encodeURIComponent(created.body.resultToken)}` });
  }
  await fs.writeFile(fixturePath, JSON.stringify(matches), { mode: 0o600 });
}
const preview = express();
preview.disable('x-powered-by');
io.engine.use((req, res, next) => {
  const allowedAuthorities = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (!allowedAuthorities.has(req.headers.host) || (req.headers.origin && ![base, `http://localhost:${port}`].includes(req.headers.origin))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  next();
});
preview.use((req, res, next) => {
  if (!['127.0.0.1', 'localhost'].includes(req.hostname)) return res.sendStatus(421);
  if (req.get('origin') && ![base, `http://localhost:${port}`].includes(req.get('origin'))) return res.sendStatus(403);
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  next();
});
preview.get('/__beta/data', (_req, res) => res.json(matches));
preview.use((req, res, next) => {
  const themed = !/^\/overlay(?:[-/]|$)/.test(req.path);
  const originalSend = res.send.bind(res);
  const inject = html => html.replace('</head>', '<link data-beta-styles rel="stylesheet" href="/closed-beta-theme.css"></head>').replace('</body>', '<script src="/closed-beta-theme.js"></script></body>');
  res.send = body => originalSend(themed && typeof body === 'string' && /<html[\s>]/i.test(body) ? inject(body) : body);
  const originalSendFile = res.sendFile.bind(res);
  res.sendFile = (filename, ...args) => {
    if (!filename.endsWith('.html')) return originalSendFile(filename, ...args);
    void fs.readFile(filename, 'utf8').then(html => res.type('html').send(html)).catch(next);
    return res;
  };
  next();
});
preview.get('/__beta', (_req, res) => res.sendFile(path.join(root, 'public', 'closed-beta.html')));
const originalHandle = app.handle.bind(app);
preview.use(originalHandle);
preview.use((error, _req, res, _next) => { console.error(error.message); if (!res.headersSent) res.status(500).send('Preview request failed'); });
// Engine.IO retains its original listener and its reference to app. Dispatch normal HTTP
// through the preview shell without replacing Socket.IO listeners or authentication routes.
app.handle = preview.handle.bind(preview);
await new Promise(resolve => reservation.close(resolve));
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
const timer = typeof sweepExpiredVetoTimers === 'function' ? setInterval(() => void sweepExpiredVetoTimers().catch(error => console.error(error.message)), 1000) : null;
console.log(`Closed beta ready: ${base}/__beta`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (timer) clearInterval(timer); server.close(); void prisma.$disconnect().then(() => process.exit(0)); });
