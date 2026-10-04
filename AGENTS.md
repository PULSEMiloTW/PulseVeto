# PulseVeto Agent Guide

This file contains repository-specific instructions for coding agents. It supplements higher-priority user and system instructions. Apply it to the entire repository unless a deeper `AGENTS.md` overrides it.

## Project at a Glance

- This is a self-hosted VALORANT tournament map veto, side-selection, scoring, public-result, and OBS overlay system.
- Runtime: Node.js 22+, npm 10+, TypeScript with native ESM (`"type": "module"`).
- Backend: Express 5, Socket.IO, Prisma 6, and SQLite (WAL).
- Validation/security: Zod, Argon2id, Node `crypto`, Helmet, CSRF, origin/host checks, and rate limiting.
- Frontend/overlays: plain HTML, CSS, and browser JavaScript under `public/`; there is no frontend build system.
- Tests: Vitest unit tests and serial integration tests.
- User-facing text and documentation are primarily Traditional Chinese. Preserve UTF-8 encoding.

## Source of Truth and Repository Layout

- `src/server.ts`: application entry point, Express routes/middleware, Socket.IO wiring, and process lifecycle.
- `src/config/`: environment and branding configuration.
- `src/domain/veto.ts`: pure BP rules, default Bo1/Bo3/Bo5 step definitions, and domain assertions.
- `src/services/`: transactional workflows, snapshots/DTOs, map synchronization, and backups.
- `src/routes/manage.ts`: management routes.
- `src/lib/`: authentication, security, database, logging, audit, metadata, and remote-image helpers.
- `prisma/schema.prisma` and `prisma/migrations/`: database schema and immutable migration history.
- `public/`: management UI, team UI, public result pages, and OBS overlays.
- `tests/unit/`: pure/targeted tests.
- `tests/integration/`: API/database tests using `storage/database/integration.db`.
- `scripts/`: operational and administrative scripts.
- `docs/`: deployment, publishing, and overlay documentation.
- `storage/`: runtime state only: SQLite databases, uploads, cache, logs, and backups.

Treat `src/**/*.ts`, `scripts/**/*.ts`, `public/**`, and `prisma/**` as authored sources. Do not directly edit generated `dist/`, installed `node_modules/`, SQLite sidecar files, or map cache output. The root-level `server.js`, `db.json`, `database.json`, `data/`, and `config.yml` are legacy/local artifacts, not the current implementation source, unless the user explicitly asks to work on legacy behavior.

## Start-of-Task Workflow

1. Read the request, then inspect only the directly relevant source, tests, and documentation.
2. Run `git status --short` before editing. This repository may have unrelated user changes; preserve them and never discard or overwrite them.
3. Check `package.json`, existing tests, and nearby conventions before adding commands, dependencies, files, or abstractions.
4. Make the smallest complete change. Do not opportunistically reformat the compact legacy files or refactor unrelated code.
5. Validate proportionally using the matrix below and report exactly what was run.

Use `rg`/`rg --files` for searches. Use `npm ci` for a clean install; do not regenerate or replace `package-lock.json` without a dependency change requested by the task.

## Implementation Invariants

### Backend and Data

- SQLite is the authoritative state. Socket.IO only announces changes or supplies refreshed snapshots; never make socket memory the source of truth.
- Enforce authorization, veto legality, side-selection legality, and input validation on the server even if the browser already checks them.
- Multi-record BP mutations belong in Prisma transactions. Preserve optimistic concurrency through `VetoSession.version` and conflict responses.
- Keep BP rules that can be pure in `src/domain/veto.ts`; keep persistence/orchestration in services rather than duplicating rule logic in routes or clients.
- Preserve the automatic Decider behavior and test Bo1, Bo3, and Bo5 implications when changing steps, progression, or side selection.
- Use Zod or established validators at untrusted boundaries. Do not trust request bodies, params, cookies, socket payloads, URLs, uploaded filenames, MIME declarations, or remote image responses.
- Keep public/team/overlay snapshots deliberately narrow. They must never expose keys, hashes, encrypted tokens, cookies, sessions, admin data, secrets, or unnecessary organization data.
- Return generic not-found/unauthorized responses where existing behavior intentionally avoids resource or token enumeration.
- Audit security-sensitive and administrator actions using the existing audit/logging helpers. Never log secrets or raw access/session/public tokens.

### Authentication and Security

- Preserve HttpOnly session cookies, CSRF enforcement for state changes, trusted Host/Origin checks, expiry/revocation checks, and login rate limits.
- Store lookup material, verification hashes, and encrypted recoverable token material only through the existing security helpers. Do not invent new token formats or weaken Argon2/crypto settings casually.
- Use `crypto.randomInt`/`randomBytes` or existing helpers for security- or match-sensitive randomness; never use `Math.random()`.
- Do not add secrets to source, examples, tests, logs, URLs, or Git. `.env` is local and must not be read into responses or committed. Update `.env.example` only with blank/safe placeholders when adding configuration.
- Treat production migration, restore, tunnel, scheduled-task, and publishing scripts as operationally sensitive. Do not run them against non-test data unless the user explicitly requests it and the exact target has been verified.

### Prisma and Migrations

- Change `prisma/schema.prisma` and add a new migration for schema changes. Never edit an already-applied migration merely to change current behavior.
- Use a descriptive timestamped migration directory consistent with the repository.
- Prefer additive/backward-compatible migrations. Explain and verify any destructive data transformation before execution.
- Run `npm run prisma:generate` after schema changes.
- Integration tests own only `storage/database/integration.db` and its `-wal`/`-shm` files. Never point tests at the development or production database.

### TypeScript and API Conventions

- Keep strict TypeScript and `noUncheckedIndexedAccess` clean; do not suppress errors with broad `any`, `@ts-ignore`, or unsafe assertions when a real type/guard is practical.
- Because module resolution is `NodeNext`, relative TypeScript imports must use the emitted `.js` extension (for example `./lib/db.js`).
- Follow local naming and response conventions. Preserve status-code semantics, response shapes, legacy aliases, and DTO fields unless the requested change explicitly changes the API contract.
- Use the existing dependencies/platform APIs before adding a package. A dependency addition must include the lockfile and a concrete maintenance benefit.

### Public UI and OBS Overlays

- `public/` is served directly. Keep browser code dependency-free unless the architecture is intentionally changed.
- Treat all inserted text, names, URLs, and image paths as untrusted. Use text-safe DOM APIs or explicit escaping; do not introduce unsafe `innerHTML` flows.
- Overlays target a transparent 1920x1080 OBS Browser Source. Preserve transparency, fixed composition, animation timing, route compatibility, and reconnect/refresh behavior unless asked otherwise.
- The four VCT variants are paired: `overlay-vct-en.html`, `overlay-vct-en-i.html`, `overlay-vct-tc.html`, and `overlay-vct-tc-i.html`. Determine whether a visual/data change must be applied consistently to all four, plus `overlay-current.html` and result pages.
- Preserve compatibility fields used by legacy overlays (`join_room`, `init_data`, and snapshot aliases) unless all consumers are deliberately migrated.
- Font binaries are intentionally ignored pending redistribution review. Do not add or restore files under `public/assets/fonts/` without explicit license confirmation; see its `README.md`.
- When changing overlay behavior, update `docs/OVERLAY-INVENTORY.md` if routes, resolution, data fields, fonts, or motion behavior change.

## Testing and Validation

Prefer the narrowest relevant command first:

- Domain/security/helper change: `npm run test:unit -- <relevant-test-file>`
- Route, auth, Prisma, or transaction change: `npm run test:integration -- <relevant-test-file>`
- TypeScript change: `npm run typecheck`
- Production output or entry-point change: `npm run build`
- Public HTML/CSS/JS or overlay change: inspect every affected variant and perform a browser/OBS-like visual and console check when tooling is available.
- Prisma schema/migration change: `npm run prisma:generate`, then integration tests against the integration database.

Before handing off a substantial or cross-cutting change, run the CI-equivalent sequence:

```bash
npm run prisma:generate
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

`npm run lint` currently performs TypeScript checking; do not claim that it performs stylistic linting. Integration tests are intentionally non-parallel and recreate only the integration database. Do not run expensive unrelated checks for a small documentation-only edit.

## Documentation and Operational Consistency

- Update `README.md`, `.env.example`, and relevant `docs/` files when setup, configuration, routes, operator actions, or observable behavior changes.
- Keep Windows PowerShell and modern Linux instructions aligned when both are documented.
- Preserve `storage/**/.gitkeep` placeholders and the ignore rules protecting databases, uploads, logs, backups, credentials, font binaries, and local Cloudflare configuration.
- Never commit `.env`, SQLite files, logs, uploads, backups, Cloudflare JSON/PEM/config, licensed font binaries, access tokens, or generated build output.
- If a secret may have entered Git history, do not treat `.gitignore` as remediation: report it, rotate/revoke it, and use an approved history-cleaning process.

## Completion Standard

Finish when the requested behavior is implemented with minimal scope, relevant validation passes, and documentation/contracts are consistent. In the final report, summarize changed files and behavior, list commands actually run, and clearly state any unverified visual, production, migration, or external-service behavior. Do not claim checks passed unless they were executed successfully.
