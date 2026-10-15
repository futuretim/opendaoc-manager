# OpenDAoC Manager — MVP Specification

> Status: **Draft v0.3** · Last updated: 2026-10-15
>
> This document defines the Minimum Viable Product for **OpenDAoC Manager**, an
> admin/GM-facing web console for operating an OpenDAoC game server. It is the
> starting point for the project and is expected to evolve as implementation
> begins.
>
> **Schema provenance:** the data model, privilege levels, password hashing, and
> ban/audit semantics in this document are **verified against the OpenDAoC server
> source** ([OpenDAoC/OpenDAoC-Core](https://github.com/OpenDAoC/OpenDAoC-Core),
> commit `f0aaa1e`) and cross-checked against the player-facing
> [Account Manager](https://github.com/futuretim/OpenDAoC-AccountManager).

---

## 1. Overview

OpenDAoC is an open-source *Dark Age of Camelot* server emulator (a descendant of
Dawn of Light / DOL). It stores its state — accounts, characters, bans, etc. — in
a MySQL/MariaDB database defined by the C# `DataObject` tables in
`OpenDAoC-Core/CoreDatabase/Tables`.

**OpenDAoC Manager** is an internal tool for server staff (owners, admins, GMs)
to inspect and manage that server. It is the *staff-facing counterpart* to the
existing player-facing Account Manager, which lets players link Discord and
recover passwords.

This MVP focuses on the **highest-value day-to-day admin tasks** and deliberately
mirrors the operations the game server already exposes to staff through its
in-game `/account` and `/ban` admin commands — so the web console does nothing
the server doesn't already support, just more safely and auditably. It does
**not** control the game-server *process* (start/stop/restart/config) — that is
out of scope for the MVP (see §11).

### 1.1 Problem statement

Today, staff perform these tasks either in-game with GM/admin commands
(`/account`, `/ban`) or by running raw SQL against the production database. The
SQL path is error-prone, hard to audit, and inaccessible to less technical staff;
the in-game path requires being logged in with an elevated character. The Manager
provides a safe, auditable, point-and-click alternative from a browser.

---

## 2. Goals & non-goals

### Goals (MVP)
- Give staff a single, authenticated dashboard to **monitor** the server and
  **manage accounts, characters, and bans**.
- Reuse the **proven data-access patterns** from the Account Manager (direct
  MySQL via `mysql2`, OpenDAoC's exact `##`-prefixed password hashing).
- Keep all database credentials and privileged logic **server-side** behind an
  API; the React client never touches the DB directly.
- Record an **audit trail** of every mutating staff action (and, where useful,
  surface the server's **own** `AuditEntry` log).

### Non-goals (MVP)
- Controlling the game-server process (lifecycle, config files, live logs).
- Real-time/in-game actions against online players (live kick, world state,
  in-game messaging). *Deferred — no out-of-process hook exists for this today.*
- Player-facing features (those live in the Account Manager).
- Multi-server / multi-shard management. MVP targets **one** configured server.
- Fine-grained role system beyond a basic admin/GM split (see §6.3).
- Editing character stats/inventory/items.

---

## 3. Personas

| Persona | In-game equivalent | Needs |
|---|---|---|
| **Owner / Admin** | `PrivLevel` 3 (Admin) | Full access: manage accounts incl. privilege level and status, bans, view everything, manage who else can log in to the Manager. |
| **GM / Moderator** | `PrivLevel` 2 (GM) | Day-to-day moderation: search accounts/characters, reset passwords, issue/lift bans, mute/warn. No ability to escalate account privilege levels or manage other staff. |

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

### 4.4 Runtime interaction with the live server (verified)
The game server **does not keep a global in-memory cache of accounts**: in
`LoginRequestHandler`, an account is loaded fresh from the DB on each login, its
password checked, and characters loaded per session. (The only account-keyed
in-memory caches are the Appeals cache and a per-player character cache.)

**Implications for writing to the live DB:**
- A password reset, `PrivLevel`/`Status` change, or new ban row is picked up at
  the player's **next login / connection** — **no server restart required**.
- Changes do **not** retroactively affect a player who is **already online**;
  they apply on their next connect. (So "ban" via the Manager prevents the next
  login but does not by itself kick a currently-connected player — matching how
  the in-game commands behave.)
- Writes must remain **narrow and column-scoped** and use the exact value formats
  the server expects (see §5, §8).

---

## 5. Data model

### 5.1 OpenDAoC game database (read/write, **external** — do not migrate)

All tables below are **verified from OpenDAoC-Core** unless noted. The Manager
treats the game DB as an external system of record and never alters its schema.

**`Account`** (`DbAccount`, `TableName="Account"`)
| Column | Type | Manager use |
|---|---|---|
| `Account_ID` | PK | identity |
| `Name` | string, unique | login name / search key |
| `Password` | string | `##`-prefixed hash — reset only (§8) |
| `PrivLevel` | **uint** | **1=Player, 2=GM, 3=Admin** (verified enum) — admin-editable |
| `CreationDate` | datetime | display |
| `LastLogin` | datetime | display / recent-activity |
| `LastDisconnected` | datetime | display |
| `LastLoginIP` | string | display; basis for IP bans |
| `LastClientVersion` | string | display |
| `Realm` | int | display |
| `Status` | int (0–255) | custom status flag — admin-editable |
| `IsMuted` | bool | moderation toggle |
| `IsWarned` | bool | moderation toggle |
| `IsTester` | bool | display / toggle |
| `Notes` | string (nullable) | staff notes — editable |
| `Mail` | string (nullable) | display |
| `Language` | string (nullable) | display |
| `CharactersTraded`, `SoloCharactersTraded` | int | display |
| `DiscordID` | string (nullable) | display / search |

> **Note on `DiscordName`:** core `DbAccount` has `DiscordID` but **not**
> `DiscordName`. The Account Manager inserts a `DiscordName` column, so it exists
> only on servers that ran the Account Manager against their DB. The Manager must
> treat `DiscordName` as **optional** and degrade gracefully if absent.

**`DOLCharacters`** (`DbCoreCharacter`, `TableName="DOLCharacters"`) — read-only
in MVP. Useful columns: `Name`, `AccountName`, `AccountSlot`, `Level`, `Class`,
`Race`, `Realm`, `RealmLevel`, `RealmPoints`, `LastPlayed`, plus stats. There is
**no soft-delete flag** — the in-game `/account deletecharacter` hard-deletes and
the row is preserved in **`DOLCharactersBackup`** (`DbCoreCharacterBackup`). So
character "deletion" is destructive; the Manager keeps it **read-only in MVP**
(see §6.4).

**`Ban`** (`DbBans`, `TableName="Ban"`) — verified columns:
| Column | Type | Notes |
|---|---|---|
| `Author` | string | who issued the ban |
| `Type` | string | **`I`=IP, `A`=Account, `B`=Both** |
| `Ip` | string | banned IP (used for `I`/`B`) |
| `Account` | string | banned account name (used for `A`/`B`) |
| `DateBan` | datetime | when issued |
| `Reason` | string | required reason |

> There is **no expiry or active/inactive column** — a ban simply exists as a row.
> The server enforces it at connect time (`AbstractServerRules`) by selecting
> `Ban` rows matching `Type`+`Account` or `Type`+`Ip`. **Lifting a ban = deleting
> the matching row(s)**, exactly as in-game `/account unban` does.

**`AuditEntry`** (`DbAuditEntry`, `TableName="AuditEntry"`) — the server's **own**
audit log: `AuditTime`, `AccountID`, `RemoteHost`, `AuditType`, `AuditSubtype`,
`OldValue`, `NewValue`. The server already records account create / failed login /
etc. here. *The Manager may surface this read-only (P1) in addition to its own
audit log.*

**`Appeal`** (`DbAppeal`, `TableName="Appeal"`) — player help/appeal queue:
`Account`, `Name` (character), `Severity`, `Status`, `Timestamp`, `Text`.
*Candidate for a post-MVP "support queue" feature (§11).*

**`ServerProperty`** (`DbServerProperty`, `TableName="ServerProperty"`) — the
server's tunable settings as key/value rows: `Category`, `Key`, `Description`,
`DefaultValue`, `Value`. **Read-only in MVP** (dashboard config viewer, §6.2);
editing is deferred (changing a live property can affect every player and some
values are cached in-process — see §11).

**`serverstats`** (`DbServerStat`, `TableName="serverstats"`) — periodic
server-health snapshots the game server writes itself: `StatDate`, `Clients`
(online player count), `AlbionPlayers`/`MidgardPlayers`/`HiberniaPlayers`, `CPU`,
`Memory`, `Upload`, `Download`. **Read-only**; the dashboard reads the most recent
row(s) (§6.2). *Note: these are snapshots on the server's own cadence, not a live
feed — surface `StatDate` so staleness is visible.*

> ⚠️ All writes to the game DB are **narrow and column-scoped** (e.g. update only
> `Password`, only `PrivLevel`, insert/delete a `Ban` row). No schema changes, no
> bulk SQL from the UI.

### 5.2 Manager database (owned by this app — small, new schema)

A separate small database (MySQL, or SQLite for a single-node deploy) for the
Manager's own state, kept isolated from the game DB:

- **`manager_user`** — staff who can log in to the Manager: `id`, `email`,
  `password_hash` (argon2/bcrypt — *not* the OpenDAoC scheme), `role`
  (`admin` | `gm`), `is_active`, `created_at`, `last_login_at`.
- **`audit_log`** — `id`, `actor_user_id`, `action` (e.g.
  `account.reset_password`), `target` (e.g. `account:Bob`), `metadata` (JSON),
  `ip`, `created_at`.
- **`session`** — if using server-side sessions (see §6.1).

---

## 6. Feature set (MVP epics)

Each epic lists user stories and acceptance criteria. Priority: **P0** = must
ship in MVP, **P1** = ship if time allows. Operations map to the server's existing
`/account` and `/ban` admin commands, noted as *(server cmd: …)*.

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
    Manager, with a staff Discord-ID allow-list — see §10.)*

### 6.2 Epic: Dashboard / server status (P0)
- *As a staff member, I see at a glance whether the server and its data look
  healthy.*
- **Acceptance:**
  - DB connectivity indicator (API can reach the game DB).
  - Key counts: total accounts, accounts created in last 24h/7d, total characters,
    active bans.
  - "Recently logged-in accounts" (by `LastLogin`) and "recently active
    characters" (by `LastPlayed`) lists.
  - **Online players & realm balance (P0):** read the latest **`serverstats`**
    row for `Clients` and per-realm counts
    (`AlbionPlayers`/`MidgardPlayers`/`HiberniaPlayers`), plus CPU/memory. Show
    `StatDate` and flag the figure as **stale** if the latest snapshot is older
    than a threshold (so a down/stalled server is obvious rather than showing a
    frozen count). *(P1)* a small sparkline of `Clients` over recent rows.
  - **Server properties viewer (P1, read-only):** browse **`ServerProperty`**
    rows grouped by `Category`, showing `Key`, current `Value`, `DefaultValue`,
    and `Description`; highlight values that differ from their default. No editing
    in MVP (§11).

### 6.3 Epic: Account management (P0)
- *As a staff member, I search accounts and view full detail.*
- *As a staff member, I reset an account's password.* *(server cmd: `/account changepassword`)*
- *As an admin, I change an account's privilege level or status.* *(server cmd: `/account status`)*
- *As a staff member, I mute/warn an account.*
- **Acceptance:**
  - Search/filter accounts by `Name`, `DiscordID`, (optional `DiscordName`) with
    pagination.
  - Account detail: all safe fields from §5.1, linked characters, ban status,
    recent `AuditEntry` rows for the account (P1).
  - **Reset password:** sets `Password` via OpenDAoC's exact hashing (§8);
    enforces length/prohibited-character rules; audited.
  - **Change privilege level:** **admin-only**; values constrained to
    1/2/3 (Player/GM/Admin); audited; cannot change your own linked account
    (prevents self-lockout) — *confirm desired rule*.
  - **Status / mute / warn / tester / notes:** edit `Status` (0–255), `IsMuted`,
    `IsWarned`, `IsTester`, `Notes`; mute/warn are GM-allowed, `PrivLevel` is
    admin-only; all audited.
  - Never display password hashes in the UI.

### 6.4 Epic: Character inspection (P0)
- *As a staff member, I search characters and view their details.*
- **Acceptance:**
  - Search characters by name / account / realm / class; pagination.
  - Character detail: name, account, slot, level, class, race, realm, realm
    level/points, last played, core stats.
  - **Read-only in MVP.** Character deletion is **destructive** in the server
    (hard delete + copy to `DOLCharactersBackup`); the Manager will not expose
    delete/move in the MVP. *(Deferred: `/account deletecharacter`,
    `/account movecharacter` — P1+, with explicit confirmations and audit.)*

### 6.5 Epic: Bans (P0 — **unblocked; schema verified**)
- *As a staff member, I ban an account and/or IP, and lift bans.*
  *(server cmd: `/ban`, `/account unban`)*
- **Acceptance:**
  - List bans from the `Ban` table with `Type`, `Account`, `Ip`, `Reason`,
    `Author`, `DateBan`.
  - **Create a ban:** choose `Type` (`A` account, `I` IP, `B` both); for `A`/`B`
    provide account name, for `I`/`B` provide/choose an IP (offer the account's
    `LastLoginIP`); **reason required**; `Author` = acting staff member;
    `DateBan` = now. Audited.
  - **Lift a ban:** delete the matching `Ban` row(s) (mirrors `/account unban`).
    Audited.
  - Guardrails: warn when banning a `PrivLevel >= 2` account; prevent banning
    your own account.

### 6.6 Epic: Staff & audit (P0)
- *As an admin, I manage who can log in to the Manager.*
- *As an admin, I review an audit trail of staff actions.*
- **Acceptance:**
  - Admin can create/deactivate `manager_user` records and set role
    (`admin`|`gm`).
  - Every mutating action writes an `audit_log` row (actor, action, target, time,
    IP).
  - Admin-viewable, filterable audit log.
  - *(P1)* Read-only view of the server's own `AuditEntry` table alongside the
    Manager's audit log.

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
| `PATCH`| `/accounts/:name` | mixed | Update `Status`/`IsMuted`/`IsWarned`/`IsTester`/`Notes` (GM) and `PrivLevel` (admin) |
| `GET`  | `/characters?query=&page=` | any | Search/paginate characters |
| `GET`  | `/characters/:name` | any | Character detail |
| `GET`  | `/bans?type=` | any | List bans |
| `POST` | `/bans` | any | Create ban (`type` A/I/B, account/ip, reason) |
| `DELETE` | `/bans` | any | Lift ban (by account/ip/type match) |
| `GET`  | `/staff` | admin | List manager users |
| `POST` | `/staff` | admin | Create manager user |
| `PATCH`| `/staff/:id` | admin | Update role / deactivate |
| `GET`  | `/audit?filters` | admin | Read Manager audit log |
| `GET`  | `/server-audit?filters` | admin | *(P1)* Read server `AuditEntry` log |
| `GET`  | `/server/stats?limit=` | any | Latest `serverstats` snapshot(s) for dashboard |
| `GET`  | `/server/properties` | any | *(P1)* Read-only `ServerProperty` rows (grouped) |

Conventions: cursor/offset pagination with a capped page size; consistent error
envelope `{ error: { code, message } }`; `401`/`403` distinguish auth vs authz.

---

## 8. Security

1. **Credentials stay server-side.** The SPA never holds DB or session secrets;
   DB creds come from env vars on the API (mirroring the Account Manager's
   `DATABASE_*` config).
2. **OpenDAoC password hashing (verified).** Password resets MUST reproduce the
   server's `CryptPassword` so the game server accepts the new password. The
   server compares `CryptPassword(input).Equals(storedPassword)` on login, and if
   a stored password does not begin with `##` it re-hashes it on next login. The
   algorithm (identical in the Account Manager's `utils/auth.ts`): per character,
   emit two bytes (`charCode >> 8`, `charCode`) → MD5 over those bytes → uppercase
   hex → remove the char at each **odd** index that equals `'0'` → prefix `##`.
   This MUST be unit-tested against known-good hashes from the DB before go-live.
3. **Value constraints match the server.** `PrivLevel` ∈ {1,2,3}; `Status` ∈
   [0,255]; `Ban.Type` ∈ {`I`,`A`,`B`}. The API validates these before writing.
4. **Parameterized queries only.** All SQL uses bound parameters (mysql2
   placeholders) — no string interpolation. Column-scoped writes only.
5. **Authorization checks on the server**, per-route, never trusting the client.
6. **Session cookies:** HTTP-only, Secure, SameSite=Lax/Strict; CSRF protection on
   state-changing requests.
7. **Rate limiting** on login and on expensive search endpoints.
8. **Audit everything** that mutates game or manager data.
9. **Least privilege DB user** for the API where feasible (only the tables/columns
   it needs: `Account`, `DOLCharacters`, `Ban`, read-only `AuditEntry`,
   `serverstats`, `ServerProperty`).
10. **Transport:** deploy behind TLS (reverse proxy), same as the Account
    Manager's Nginx/Caddy guidance.

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

## 10. Open questions

**Resolved via OpenDAoC-Core** (were open in v0.1):
- ✅ **Ban schema** — `Ban` table: `Author`/`Type`(I/A/B)/`Ip`/`Account`/`DateBan`/
  `Reason`; no expiry; lift = delete row. Bans epic (§6.5) is unblocked.
- ✅ **`PrivLevel` mapping** — 1=Player, 2=GM, 3=Admin (`ePrivLevel` enum, uint).
- ✅ **Character table** — `DOLCharacters`; no soft-delete flag; deletion is
  destructive with a `DOLCharactersBackup` copy → Manager keeps characters
  read-only in MVP.
- ✅ **Password algorithm** — matches the Account Manager port; `##`-prefix with
  login-time re-hash of legacy values.
- ✅ **Live-DB writes** — no global account cache; changes apply at next
  login/connect, no restart; online players not retroactively affected (§4.4).
- ✅ **Server has its own audit (`AuditEntry`) and appeals (`Appeal`) tables** —
  surfacing them is a P1/post-MVP opportunity.
- ✅ **Online-player count source** — the server writes periodic **`serverstats`**
  snapshots (`Clients` + per-realm counts, CPU/memory). The dashboard reads the
  latest row (§6.2) with a staleness indicator; no in-process hook needed.

**Still open (decisions / server-deploy specifics):**
1. **`serverstats` cadence:** how often does this server write snapshots? Sets the
   dashboard's staleness threshold. (If snapshots are sparse, the online count is
   coarse — acceptable for MVP.)
2. **Staff login method:** email+password vs Discord OAuth (+ staff Discord-ID
   allow-list) as the Account Manager uses.
3. **`DiscordName` column presence:** exists only if this server ran the Account
   Manager's inserts — confirm against the target DB; treat as optional.
4. **Deployment shape:** API serves the SPA as one container, or two services?
5. **Online-player kick/mute-now:** MVP changes take effect next login; is a
   "disconnect now" capability needed (would require an in-process hook that does
   not exist today)?
6. **Content-edit cache reloads (future phases):** editing world content
   (§11) will need the server's content-reload mechanism; some tables are cached
   in-process and won't pick up DB edits without a reload/restart. To be mapped
   per-domain when that phase is specced.

---

## 11. Out of scope for MVP & future phases

The OpenDAoC database defines **~101 tables**. The MVP touches only the
**player-operations** slice (§6). The rest is real, valuable management surface
but belongs to later phases — much of it amounts to a full **web-based GM /
game-content toolset**. This section catalogues it as a roadmap.

> ⚠️ **Cross-cutting caveat for all content phases:** world-content tables are
> wide, heavily cross-referenced (items ↔ loot ↔ mobs ↔ merchants, spells ↔
> lines ↔ styles ↔ specs), and several are **cached in-process** by the running
> server — edits won't take effect without the server's content-reload/restart.
> Each phase below must map its reload path and referential-integrity rules
> before implementation, and edits must be heavily validated and audited. These
> are **not** simple CRUD screens.

### Near-term, low-risk (small tables, high leverage) — Phase 1
- **Appeals / support queue** — `Appeal` (view, triage, resolve player appeals).
- **Bug reports** — `BugReport`.
- **News** — `News` (login/MOTD news entries).
- **Server properties editor** — `ServerProperty` (MVP ships read-only; editing
  with validation + reload is the natural first *write* extension).

### Player data (destructive — strong guardrails) — Phase 2
- **Character admin** — delete / move / rename characters
  (`/account deletecharacter`, `/account movecharacter`); `DOLCharacters`,
  `DOLCharactersBackup`.
- **Inventory / items on a character** — `Inventory`, `ItemUnique`.
- **Character effects, bind points, boats** — `PlayerXEffect`, `BindPoint`,
  `PlayerBoats`.

### Social systems — Phase 3
- **Guilds** — `Guild`, `GuildRank`, `GuildAlliance` (rename, disband, membership,
  emblem, leadership).
- **Housing** — `DBHouse`, `DBHousePermissions`, `DBHouseCharsXPerms`,
  `DBIndoorItem`/`DBOutdoorItem`, hookpoint tables, `Gravestone`.

### World content editor ("GM toolset") — Phase 4 (large)
- **NPCs / mobs** — `Mob` (per-spawn, ~45 cols), `NpcTemplate` (~42 cols),
  `NPCEquipment`, `MobXAmbientBehaviour`.
- **Items** — `ItemTemplate` (~77 cols), `ItemUnique`, `Artifact` +
  `ArtifactBonus`/`ArtifactXItem`, `CraftedItem`/`CraftedXItem`,
  `Salvage`/`SalvageYield`.
- **Loot** — `LootTemplate`, `LootGenerator`, `LootOTD`, `MobDropTemplate`,
  `MobXLootTemplate`, `DropTemplateXItemTemplate`.
- **Quests & tasks** — `DataQuest` (~29 cols, the data-driven quest system),
  `Task`, `CharacterXDataQuest`.
- **Merchants** — `MerchantItem`, `HouseConsignmentMerchant`.
- **Spells & abilities** — `Spell` (~41 cols), `SpellLine`, `LineXSpell`,
  `SpellXCustomValues`, `Style`, `StyleXSpell`, `Ability`, `Specialization`,
  `SpecXAbility`, `ClassXSpecialization`, `ClassXRealmAbility_Atlas`.
- **World geography** — `Zones`, `Regions`, `Area`, `Teleport`, `ZonePoint`,
  `Door`, `Path`/`PathPoints`, `WorldObject`, `Battleground`, `InstanceXElement`.

### RvR / realm systems — Phase 5
- **Keeps** — `Keep`, `KeepComponent`, `KeepHookPoint`/`KeepHookPointItem`,
  `KeepPosition`, `KeepCaptureLog`, `Keepdoorteleport`.
- **Relics & factions** — `Relic`, `Minotaurrelic`, `Faction`,
  `FactionAggroLevel`, `LinkedFaction`.

### Localization — Phase 6
- `LanguageNPC`, `LanguageZone`, `LanguageArea`, `LanguageSystem`,
  `LanguageGameObject`.

### Not planned (operational concerns better handled elsewhere)
- Game-server **process control** (start/stop/restart), config *files*, live log
  tailing — infra/ops tooling, not this app.
- **Real-time in-game actions** against online players (live kick, world state,
  in-game messaging) — needs an in-process hook that does not exist today.
- **Multi-server** management; advanced per-action **RBAC**; heavy
  analytics/reporting beyond the dashboard.

---

## 12. Milestones (suggested)

> **Implementation status (2026-10-15):** M0 scaffold ✅, plus the core
> functionality of **M2 (Accounts)**, **M3 (Characters)**, and the ban half of
> **M4** are implemented and wired to the SPA, with staff auth + audit logging.
> The dashboard/server-status work (M1, incl. `serverstats`) is intentionally
> deferred in favor of functionality. Since then: real session store,
> staff-user management UI, and audit-log viewer are done; and the first slice
> of **world content** (§11 Phase 4) — read-only browsers for **Quests**
> (`DataQuest`, multi-step parsing), **Items** (`ItemTemplate`, grouped
> detail), **Mobs** (`Mob` spawns), **NPC templates** (`NpcTemplate`,
> cross-linked from mobs), **Loot templates** (`LootTemplate` + `MobXLootTemplate`)
> **Merchant lists** (`MerchantItem`), **Spells** (`Spell`) and **Styles**
> (`Style`) and **Geography** (`Regions`/`Zones`/`Teleport`) — is in, grouped
> under a "World" nav menu, with loot/merchant entries cross-linked to Items
> and region↔zone cross-linked. The read-only world-content browsers are now
> broadly complete. Remaining: content editing, and the dashboard.

1. **M0 — Scaffolding:** Vite SPA + Fastify API skeleton, shared TS config, Docker,
   DB connection to game DB verified, Manager DB migrations, auth stub.
2. **M1 — Auth + Dashboard:** staff login/session, `/dashboard/summary`, health,
   `serverstats`-based online/realm panel.
3. **M2 — Accounts:** search, detail, password reset (with hash tests vs real
   DB values), priv-level/status/mute/warn edits.
4. **M3 — Characters:** search + detail (read-only).
5. **M4 — Bans + Staff/Audit:** ban create/list/lift against the `Ban` table;
   Manager audit log viewer and staff management; (P1) server `AuditEntry` view
   and read-only `ServerProperty` viewer.
6. **M5 — Hardening:** rate limiting, CSRF, polish, docs, deploy.

---

## 13. Success criteria
- Staff can log in and, from the browser, **find an account, reset its password,
  change its privilege/status, mute/warn it, inspect its characters, and
  issue/lift a ban** — without touching raw SQL or logging in in-game.
- Every such action is **audited**.
- No database credentials or privileged logic exist in client-side code.
- Password resets produce hashes the live OpenDAoC server accepts (verified
  against real DB values).
