# OpenDAoC Manager

Admin/GM web console for operating an [OpenDAoC](https://github.com/OpenDAoC/OpenDAoC-Core)
game server — the staff-facing counterpart to the player-facing
[Account Manager](https://github.com/futuretim/OpenDAoC-AccountManager).

See **[docs/MVP_SPEC.md](docs/MVP_SPEC.md)** for the full specification.

> **Status:** Core functionality implemented — **account management**
> (search, detail, password reset, privilege/status/mute/warn/notes),
> **bans** (create/list/lift), and **character inspection** (read-only), all
> behind staff auth with an audit trail. The stats/overview dashboard is
> deliberately deferred.

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
- **Characters** — `GET /characters?query=&realm=`, `GET /characters/:name`
  (read-only).
- **Bans** — `GET /bans?type=`, `POST /bans` (type A/I/B, reason required),
  `DELETE /bans/:id` (lift).

Every mutating action is written to the Manager `audit_log`. All game-DB writes
are parameterized and column-scoped.

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
