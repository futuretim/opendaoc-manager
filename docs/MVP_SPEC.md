# OpenDAoC Manager — MVP Specification

> Status: **Draft v0.1** · Last updated: 2026-10-15
>
> This document defines the Minimum Viable Product for **OpenDAoC Manager**, an
> admin/GM-facing web console for operating an OpenDAoC game server. It is the
> starting point for the project and is expected to evolve as implementation
> begins.

---

## 1. Overview

OpenDAoC is an open-source *Dark Age of Camelot* server emulator (a descendant of
Dawn of Light / DOL). It stores its state — accounts, characters, bans, etc. — in
a MySQL/MariaDB database.

**OpenDAoC Manager** is an internal tool for server staff (owners, admins, GMs)
to inspect and manage that server. It is the *staff-facing counterpart* to the
existing player-facing [OpenDAoC Account Manager](https://github.com/futuretim/OpenDAoC-AccountManager),
which lets players link Discord and recover passwords.

This MVP focuses on the **highest-value day-to-day admin tasks**: seeing whether
the server is healthy, finding and managing accounts, inspecting characters, and
handling bans. It deliberately **does not** control the game-server *process*
(start/stop/restart/config) — that is out of scope for the MVP (see §11).

### 1.1 Problem statement

Today, staff perform these tasks either in-game with GM commands or by running
raw SQL against the production database. Both are error-prone, hard to audit, and
inaccessible to less technical staff. The Manager provides a safe, auditable,
point-and-click alternative for the most common actions.

---

## 2. Goals & non-goals

### Goals (MVP)
- Give staff a single, authenticated dashboard to **monitor** the server and
  **manage accounts, characters, and bans**.
- Reuse the **proven data-access patterns** from the Account Manager (direct
  MySQL, OpenDAoC's custom password hashing).
- Keep all database credentials and privileged logic **server-side** behind an
  API; the React client never touches the DB directly.
- Record an **audit trail** of every mutating staff action.

### Non-goals (MVP)
- Controlling the game-server process (lifecycle, config files, live logs).
- In-game live features (sending in-game messages, kicking online players,
  real-time world state). *Deferred — requires a server-side integration that
  may not exist yet (see §10, Open Questions).*
- Player-facing features (those live in the Account Manager).
- Multi-server / multi-shard management. MVP targets **one** configured server.
- Fine-grained role system beyond a basic admin/GM split (see §6.3).

---

## 3. Personas

| Persona | Needs |
|---|---|
| **Owner / Admin** | Full access: manage accounts (incl. privilege level), bans, view everything, manage who else can log in to the Manager. |
| **GM / Moderator** | Day-to-day moderation: search accounts/characters, reset passwords, issue/lift bans. No ability to escalate account privilege levels or manage other staff. |

---

## 4. Architecture

Per the chosen stack: **Vite + React SPA** talking to a **separate backend API**
that owns all database access.

```
┌────────────────────┐        HTTPS/JSON        ┌─────────────────────┐        ┌──────────────────┐
│  React SPA (Vite)  │  ───────────────────►    │   Manager API        │  SQL   │  OpenDAoC MySQL  │
│  - admin console   │  ◄───────────────────    │  (Node/TS, Fastify)  │ ─────► │  (game database) │
│  - no DB creds     │     session cookie       │  - auth + authz      │        │                  │
└────────────────────┘                          │  - DB access layer   │        └──────────────────┘
                                                 │  - audit log         │
                                                 └─────────────────────┘
                                                            │
                                                            ▼
                                                 ┌─────────────────────┐
                                                 │  Manager DB (small)  │
                                                 │  staff users, audit  │
                                                 └─────────────────────┘
```

### 4.1 Frontend — Vite React SPA
- **Vite + React 18 + TypeScript**.
- Routing: `react-router`.
- Data fetching/caching: **TanStack Query** (server-state, pagination, retries).
- Styling: **Tailwind CSS** (consistent with the Account Manager).
- Forms/validation: **react-hook-form** + **zod**.
- The SPA holds **no secrets** and makes no direct DB connection. It authenticates
  against the Manager API and calls JSON endpoints.

### 4.2 Backend — Manager API
- **Node.js + TypeScript**, **Fastify** (or Express) HTTP server.
- **mysql2** connection pool to the OpenDAoC database (same driver the Account
  Manager uses).
- Owns: authentication, authorization (admin vs GM), all SQL, input validation,
  OpenDAoC password hashing, and the audit log.
- Exposes a small, versioned REST API (`/api/v1/...`) consumed by the SPA.
- Serves the built SPA as static files in production (single deployable), or runs
  standalone behind a reverse proxy — TBD during implementation.

### 4.3 Why a separate API (not direct-from-browser SQL)
A browser SPA cannot safely hold database credentials or run SQL. The API layer is
where credentials, authorization, validation, and auditing live. This also keeps
the door open to later swap direct-MySQL for an official OpenDAoC admin API without
touching the frontend.

---

## 5. Data model

### 5.1 OpenDAoC game database (read/write, **external** — do not migrate)

The Manager treats the game DB as an external system of record. **Verified**
columns come from the Account Manager's code; others follow the well-known DOL
schema and **must be confirmed against the live database during implementation.**

**`account`** *(verified from Account Manager)*
| Column | Notes |
|---|---|
| `Account_ID` | PK (string in AM inserts) |
| `Name` | login name (unique) |
| `Password` | OpenDAoC custom hash, `##`-prefixed (see §7.2) |
| `PrivLevel` | `1` = player, elevated values = GM/Admin (confirm exact mapping) |
| `CreationDate` | set on creation |
| `LastTimeRowUpdated` | updated on change |
| `DiscordID`, `DiscordName` | linked Discord identity (nullable) |
| *(others)* | `Mail`, `LastLogin`, `Realm`, `RealmPoints`, etc. — confirm & surface as useful |

**`DOLCharacters`** *(expected DOL table — confirm exact name/columns)*
Character records: `Name`, `AccountName`, `Level`, `Class`, `Realm`, `Race`,
`LastPlayed`, `DeleteCharacter` flag, etc. Read-only in MVP except soft-delete.

**Bans** — DOL historically stores bans on a dedicated table (e.g. a `ban` /
`serverban` table keyed by account/IP). **Exact table and columns must be
confirmed**; the ban feature (§6.5) depends on this.

> ⚠️ All writes to the game DB are **narrow and column-scoped** (e.g. update only
> `Password`, only `PrivLevel`). No schema changes, no bulk SQL from the UI.

### 5.2 Manager database (owned by this app — small, new schema)

A separate small database (MySQL, or SQLite for a single-node deploy) for the
Manager's own state, kept isolated from the game DB:

- **`manager_user`** — staff who can log in to the Manager: `id`, `email`,
  `password_hash` (bcrypt/argon2 — *not* the OpenDAoC scheme), `role`
  (`admin` | `gm`), `is_active`, `created_at`, `last_login_at`.
- **`audit_log`** — `id`, `actor_user_id`, `action` (e.g.
  `account.reset_password`), `target` (e.g. `account:Bob`), `metadata` (JSON),
  `ip`, `created_at`.
- **`session`** — if using server-side sessions (see §6.1).

---

## 6. Feature set (MVP epics)

Each epic lists user stories and acceptance criteria. Priority: **P0** = must
ship in MVP, **P1** = ship if time allows.

### 6.1 Epic: Staff authentication & session (P0)
- *As a staff member, I log in with email + password so only authorized staff can
  use the Manager.*
- **Acceptance:**
  - Login form; credentials checked against `manager_user` (argon2/bcrypt).
  - Authenticated session via **HTTP-only, secure, same-site cookie** (not
    localStorage).
  - Logout clears the session.
  - Unauthenticated requests to any `/api/v1/*` (except login) return `401`; the
    SPA redirects to login.
  - Brute-force protection: rate-limit login attempts.
  - **Out of scope for MVP:** SSO/OAuth, self-service signup. Admins create staff
    users (§6.6). *(Decision point: could reuse Discord OAuth like the Account
    Manager — see Open Questions §10.)*

### 6.2 Epic: Dashboard / server status (P0)
- *As a staff member, I see at a glance whether the server and its data look
  healthy.*
- **Acceptance:**
  - DB connectivity indicator (API can reach the game DB).
  - Key counts: total accounts, accounts created in last 24h/7d, total characters,
    active bans.
  - "Recently created accounts" and "recently active characters" (by
    `LastPlayed`) lists.
  - *(P1)* Online-player count **if** a reliable source exists (see §10). Omit
    rather than show a misleading number.

### 6.3 Epic: Account management (P0)
- *As a staff member, I search accounts and view full detail.*
- *As an admin, I change an account's privilege level.*
- *As a staff member, I reset an account's password.*
- **Acceptance:**
  - Search/filter accounts by `Name`, `DiscordName`, `DiscordID` with pagination.
  - Account detail page: all safe fields, linked Discord, list of the account's
    characters, ban status.
  - **Reset password:** sets `Password` using OpenDAoC's exact hashing (§7.2);
    enforces length/prohibited-character rules; audited.
  - **Change privilege level:** **admin-only**; audited; cannot change your own
    (prevents accidental self-lockout scenarios) — *confirm desired rule*.
  - Never display password hashes in the UI.

### 6.4 Epic: Character inspection (P0)
- *As a staff member, I search characters and view their details.*
- **Acceptance:**
  - Search characters by name / account / realm / class; pagination.
  - Character detail: name, account, level, class, race, realm, last played, etc.
  - *(P1)* Soft-delete / restore a character (toggle the delete flag) — **confirm
    the mechanism** before building; audited if included.
  - Read-only otherwise in MVP (no editing stats/inventory).

### 6.5 Epic: Bans (P0, **pending schema confirmation**)
- *As a staff member, I ban an account (and/or IP) and lift bans.*
- **Acceptance:**
  - List active bans with reason, who issued it, and when.
  - Create a ban against an account (by name) with a required reason; audited.
  - Lift a ban; audited.
  - **Blocked until** the ban table/columns and how the game server enforces bans
    are confirmed (§10). If unconfirmable in the MVP window, downgrade to P1 and
    ship the rest.

### 6.6 Epic: Staff & audit (P0)
- *As an admin, I manage who can log in to the Manager.*
- *As an admin, I review an audit trail of staff actions.*
- **Acceptance:**
  - Admin can create/deactivate `manager_user` records and set role
    (`admin`|`gm`).
  - Every mutating action writes an `audit_log` row (actor, action, target, time,
    IP).
  - Admin-viewable, filterable audit log.

---

## 7. API surface (illustrative)

Versioned under `/api/v1`. All mutating routes require auth; privilege-gated
routes note the required role. Request/response bodies are JSON and validated
server-side with zod.

| Method | Path | Role | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | — | Log in, set session cookie |
| `POST` | `/auth/logout` | any | End session |
| `GET`  | `/auth/me` | any | Current staff user + role |
| `GET`  | `/dashboard/summary` | any | Counts + health for dashboard |
| `GET`  | `/accounts?query=&page=` | any | Search/paginate accounts |
| `GET`  | `/accounts/:name` | any | Account detail (+ characters, ban status) |
| `POST` | `/accounts/:name/reset-password` | any | Reset password (OpenDAoC hash) |
| `POST` | `/accounts/:name/priv-level` | admin | Change `PrivLevel` |
| `GET`  | `/characters?query=&page=` | any | Search/paginate characters |
| `GET`  | `/characters/:name` | any | Character detail |
| `GET`  | `/bans?active=` | any | List bans |
| `POST` | `/bans` | any | Create ban (reason required) |
| `DELETE` | `/bans/:id` | any | Lift ban |
| `GET`  | `/staff` | admin | List manager users |
| `POST` | `/staff` | admin | Create manager user |
| `PATCH`| `/staff/:id` | admin | Update role / deactivate |
| `GET`  | `/audit?filters` | admin | Read audit log |

Conventions: cursor/offset pagination with a capped page size; consistent error
envelope `{ error: { code, message } }`; `401`/`403` distinguish
auth vs authz.

---

## 8. Security

1. **Credentials stay server-side.** The SPA never holds DB or session secrets;
   DB creds come from env vars on the API (mirroring the Account Manager's
   `DATABASE_*` config).
2. **OpenDAoC password hashing.** Password resets MUST reproduce OpenDAoC's exact
   scheme so the game server accepts the new password. The algorithm (ported from
   `utils/auth.ts` in the Account Manager): UTF-16-BE-style byte expansion of each
   char → MD5 → uppercase hex → remove the char at each odd index that equals
   `'0'` → prefix `##`. This must be unit-tested against known-good hashes before
   go-live.
3. **Parameterized queries only.** All SQL uses bound parameters (mysql2
   placeholders) — no string interpolation. Column-scoped writes only.
4. **Authorization checks on the server**, per-route, never trusting the client.
5. **Session cookies:** HTTP-only, Secure, SameSite=Lax/Strict; CSRF protection on
   state-changing requests.
6. **Rate limiting** on login and on expensive search endpoints.
7. **Audit everything** that mutates game or manager data.
8. **Least privilege DB user** for the API where feasible (only the tables/columns
   it needs).
9. **Transport:** deploy behind TLS (reverse proxy), same as the Account Manager's
   Nginx/Caddy guidance.

---

## 9. Tech stack summary

| Layer | Choice |
|---|---|
| Frontend | Vite, React 18, TypeScript, react-router, TanStack Query, Tailwind CSS, react-hook-form + zod |
| Backend | Node.js, TypeScript, Fastify, mysql2, zod, argon2 (staff pw), pino (logging) |
| Manager DB | MySQL/MariaDB (or SQLite for single-node) |
| Game DB | Existing OpenDAoC MySQL/MariaDB (external) |
| Auth | Email+password → HTTP-only session cookie (SSO deferred) |
| Packaging | Docker image + `docker-compose` example (consistent with Account Manager) |
| Tooling | ESLint, Prettier, Vitest (unit, incl. password-hash tests) |

---

## 10. Open questions (resolve before / during build)

1. **Ban schema (§6.5):** exact table name, columns, and how the game server
   enforces account vs IP bans. *Blocks the Bans epic.*
2. **`PrivLevel` mapping:** which values mean GM vs Admin in this server's build?
3. **Character table:** confirm `DOLCharacters` name and the soft-delete mechanism
   (`DeleteCharacter` flag vs row removal).
4. **Online-player / live server status:** is there any reliable source (admin
   port, status endpoint, heartbeat row, log)? Determines whether §6.2 P1 ships.
5. **Staff login:** email+password vs reusing Discord OAuth (as the Account
   Manager does). Discord OAuth would unify identity but needs an allow-list of
   staff Discord IDs.
6. **Deployment shape:** API serves the SPA as one container, or two services?
7. **Writing to a live/production DB:** confirm it is safe for the Manager to write
   to the same DB the running game server uses, and whether any values are cached
   in-process by the server (e.g. does a password change take effect without a
   server restart?).

---

## 11. Explicitly out of scope for MVP (candidate next phases)
- Game-server process control (start/stop/restart), config editing, live log
  tailing.
- Real-time/in-game actions (message online players, live kick, world state).
- Multi-server management.
- Advanced RBAC, per-action permissions.
- Analytics/reporting dashboards beyond basic counts.

---

## 12. Milestones (suggested)

1. **M0 — Scaffolding:** Vite SPA + Fastify API skeleton, shared TS config, Docker,
   DB connection to game DB verified, Manager DB migrations, auth stub.
2. **M1 — Auth + Dashboard:** staff login/session, `/dashboard/summary`, health.
3. **M2 — Accounts:** search, detail, password reset (with hash tests), priv-level
   change.
4. **M3 — Characters:** search + detail.
5. **M4 — Bans + Staff/Audit:** once ban schema is confirmed; audit log viewer and
   staff management.
6. **M5 — Hardening:** rate limiting, CSRF, polish, docs, deploy.

---

## 13. Success criteria
- Staff can log in and, from the browser, **find an account, reset its password,
  change its privilege, inspect its characters, and issue/lift a ban** — without
  touching raw SQL.
- Every such action is **audited**.
- No database credentials or privileged logic exist in client-side code.
- Password resets produce hashes the live OpenDAoC server accepts.
