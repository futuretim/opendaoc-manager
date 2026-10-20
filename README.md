# OpenDAoC Manager

Admin/GM web console for operating an [OpenDAoC](https://github.com/OpenDAoC/OpenDAoC-Core)
game server — the staff-facing counterpart to the player-facing
[Account Manager](https://github.com/futuretim/OpenDAoC-AccountManager).

See **[docs/MVP_SPEC.md](docs/MVP_SPEC.md)** for the full specification.

> **Status:** Core functionality implemented — **account management**
> (search, detail, password reset, privilege/status/mute/warn/notes),
> **bans** (create/list/lift), **character inspection & progression editing**
> (level / realm level / realm & bounty points, with class/race names),
> **staff management** and an **audit-log viewer**
> (admin-only), all behind revocable server-side sessions. The stats/overview
> dashboard is deliberately deferred.

## Architecture

```
apps/web   Vite + React + TypeScript SPA (holds no secrets)
apps/api   Fastify + TypeScript API — owns all DB access, auth, auditing
```

- **Game DB** — the external OpenDAoC MySQL/MariaDB. Read + narrow,
  column-scoped writes only. Never migrated by this app.
- **Manager DB** — this app's own small schema (staff users, sessions, audit
  log). Created by `npm run migrate`.

## Prerequisites

- Node.js >= 20
- Access to an OpenDAoC game database (for real data)
- A MySQL/MariaDB for the Manager's own tables (the compose file provides one)

## Local development

### With Nix (recommended — identical toolchain on any machine)

A [Nix flake](flake.nix) provides a dev shell with the exact Node.js, npm,
MariaDB client, and openssl this project expects — no system installs.

```bash
nix develop            # enter the dev shell (Node 22, npm, mariadb, openssl)
# or, with direnv:
direnv allow           # auto-enters the shell on cd (uses .envrc)
```

The first `nix develop` writes a `flake.lock` pinning an exact nixpkgs
revision — commit it for byte-for-byte reproducibility across machines.
Then follow the standard steps below (they run the same inside the shell).

### Standard (system Node.js >= 20)

```bash
cp .env.example .env          # then edit DB credentials + SESSION_SECRET
npm install                   # installs all workspaces

npm run migrate               # create the Manager DB schema
npm run dev:api               # API on http://localhost:4000
npm run dev:web               # SPA on http://localhost:5173
```

Generate a session secret with `openssl rand -hex 32`.

### Creating the first staff user

Staff users live in the Manager DB (`manager_user`). Create one with the CLI
(idempotent — re-running updates the password/role):

```bash
npm run create-user --workspace apps/api -- you@example.com 'your-password' admin
```

Then sign in at the web app with that email/password.

## Scripts

| Command | Description |
|---|---|
| `npm run dev:api` / `npm run dev:web` | Start API / SPA in watch mode |
| `npm run build` | Build all workspaces |
| `npm run test` | Run tests (incl. the password-hash vectors) |
| `npm run migrate` | Apply Manager DB migrations |
| `npm run create-user --workspace apps/api -- <email> <pw> [admin\|gm]` | Create/update a staff user |

## Functionality (implemented)

Behind staff auth (`requireAuth`), under `/api/v1`:

- **Accounts** — `GET /accounts?query=`, `GET /accounts/:name` (detail +
  characters + ban status), `POST /accounts/:name/reset-password` (OpenDAoC
  hashing), `PATCH /accounts/:name` (status/mute/warn/tester/notes; `privLevel`
  is **admin-only**).
- **Characters** — `GET /characters?query=&realm=`, `GET /characters/:name`,
  `PATCH /characters/:name` (progression edits: `level`, `realmLevel`,
  `realmPoints`, `bountyPoints`; column-scoped, audited). Changes apply at the
  player's next login; a running server overwrites them on a logged-in
  character's next save.
- **Quests** — `GET /quests?query=`, `GET /quests/:id` (read-only world
  content: `DataQuest`, with multi-step fields parsed for display).
- **Items** — `GET /items?query=`, `GET /items/:idNb` (read-only world
  content: `ItemTemplate`, grouped detail with DOL value conventions).
- **Mobs** — `GET /mobs?query=`, `GET /mobs/:id` (read-only `Mob` spawns:
  location, stats, behavior; links to its NPC template).
- **NPC templates** — `GET /npc-templates?query=`, `GET /npc-templates/:templateId`
  (read-only `NpcTemplate`).
- **Loot templates** — `GET /loot-templates?query=`, `GET /loot-templates/:name`
  (read-only `LootTemplate` grouped by name; item entries joined to item names
  and the mobs that drop them via `MobXLootTemplate`).
- **Merchant lists** — `GET /merchant-lists?query=`, `GET /merchant-lists/:id`
  (read-only `MerchantItem` grouped by list, joined to item names).
- **Spells** — `GET /spells?query=`, `GET /spells/:id` (read-only `Spell`).
- **Styles** — `GET /styles?query=`, `GET /styles/:id` (read-only `Style`).
- **Geography** — `GET /regions?query=` + `GET /regions/:id` (with its zones),
  `GET /zones?query=` + `GET /zones/:id`, `GET /teleports?query=`
  (read-only `Regions`/`Zones`/`Teleport`, region↔zone cross-linked).

- **Server config** — `GET /server-properties?query=` + `GET /server-properties/:key`
  (any staff) and `PATCH /server-properties/:key` (**admin-only, editable**;
  `Value`-only column-scoped write, audited with old/new value). The first
  write-enabled world-content editor.

World-content pages are grouped under a **World** menu in the nav.

> **Editing & the server cache:** world content lives in the game DB, which a
> running server caches in-process. Writes take effect only after the server
> reloads (e.g. the in-game `&serverproperties` command, or a restart). The UI
> states this; keep it in mind when enabling edits on other content tables.
- **Bans** — `GET /bans?type=`, `POST /bans` (type A/I/B, reason required),
  `DELETE /bans/:id` (lift).
- **Staff (admin-only)** — `GET /staff`, `POST /staff` (create),
  `PATCH /staff/:id` (role / activate-deactivate; changing access revokes the
  user's sessions immediately; self-lockout is prevented).
- **Audit (admin-only)** — `GET /audit?action=` (filterable, paginated).

Sessions are **server-side and revocable** (the signed cookie holds an opaque
session id; state lives in the `session` table). Every mutating action is
written to the Manager `audit_log`. All game-DB writes are parameterized and
column-scoped.

## Docker

```bash
cp .env.example .env          # set GAME_DB_* and SESSION_SECRET
docker compose up --build     # web :8080, api :4000, manager-db :3307
```

The game database stays external — point `GAME_DB_*` at your live server.

## Security notes

- The SPA never holds DB credentials; all SQL runs in the API.
- Game-account password resets reproduce OpenDAoC's exact `CryptPassword`
  (`##`-prefixed MD5). See `apps/api/src/auth/password.ts` and its tests.
- Staff (Manager) passwords use scrypt — a separate scheme from game accounts.
- All game-DB writes are parameterized and column-scoped.

## License

MIT
