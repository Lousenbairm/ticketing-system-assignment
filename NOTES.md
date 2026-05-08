# Study Notes — Customer Service Ticketing System

---

## 1. System Overview

A full-stack ticketing system where:
- **Customers** submit support tickets via a public form (no login required)
- **Admins** log in to view, manage, and close tickets
- A **background scheduler** auto-closes tickets that have been RESOLVED for 3+ days

**Tech stack:**
| Layer | Technology |
|---|---|
| Backend | NestJS 11 + TypeScript |
| ORM | MikroORM v7 (PostgreSQL driver) |
| Database | PostgreSQL 16 |
| Auth | JWT + Passport |
| Scheduler | `@nestjs/schedule` (cron) |
| Frontend | React + TypeScript (Vite) |
| UI Library | Ant Design |
| State | Zustand |
| HTTP client | Axios |
| Runtime | Docker (3 containers) |

---

## 2. Architecture

```
Browser (port 5173)
    └── React frontend (Vite)
            └── Axios → HTTP → NestJS backend (port 3000)
                                    └── MikroORM → PostgreSQL (port 5432)
```

**Monorepo layout:**
- Backend: project root
- Frontend: `/frontend`
- Three Docker services: `db`, `backend`, `frontend`

**Request path (backend):**
```
HTTP Request
  → TicketsController   (routing, validation, guards)
  → TicketsService      (business logic)
  → EntityRepository    (queries)
  → EntityManager       (writes/flush)
  → PostgreSQL
```

---

## 3. Data Model — Ticket Entity

```typescript
Ticket {
  id:            uuid (auto-generated)
  title:         string
  customerName:  string
  customerEmail: string
  description:   text
  status:        OPEN | IN_PROGRESS | RESOLVED | CLOSED
  priority:      LOW | MEDIUM | HIGH  (default: MEDIUM)
  createdAt:     Date (auto)
  resolvedAt:    Date | null          (set only when → RESOLVED)
  updatedAt:     Date (auto-updated)
  deletedAt:     Date | null          (soft delete)
  deletedBy:     string | null        (admin username)
  modifiedBy:    string | null        (last admin to act)
}
```

**Admin entity** (for auth):
```typescript
Admin { id, username, passwordHash, createdAt }
```

---

## 4. Status Machine

Valid transitions enforced in `TicketsService`, not the entity:

```
OPEN → IN_PROGRESS → RESOLVED → (CLOSED — cron only)
```

Rules:
- API can only do: OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED
- `PUT /tickets/:id/status` with CLOSED → **400** ("auto-closed by scheduler only")
- Skipping a step (e.g. OPEN→RESOLVED) → **400**
- `resolvedAt` is set only on transition to RESOLVED
- `modifiedBy` is set to the admin's username on every status change

---

## 5. REST API

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/tickets` | Public | Submit a ticket |
| `GET` | `/tickets` | Admin | List tickets (filters: status, q, includeDeleted) |
| `GET` | `/tickets/:id` | Admin | Get single ticket |
| `PUT` | `/tickets/:id/status` | Admin | Advance status |
| `DELETE` | `/tickets/:id` | Admin | Soft delete |
| `POST` | `/auth/login` | Public | Get JWT token |

**Query params for `GET /tickets`:**
- `?status=OPEN` — filter by status
- `?q=keyword` — search title, description, customerName, customerEmail (case-insensitive, uses `$ilike`)
- `?includeDeleted=true` — include soft-deleted tickets

---

## 6. Authentication (JWT)

Flow:
1. Admin POSTs credentials to `POST /auth/login`
2. Backend verifies password with `bcrypt.compare`
3. Returns `{ access_token: <JWT> }` signed with `JWT_SECRET`
4. Frontend stores token in `localStorage`
5. Axios interceptor attaches `Authorization: Bearer <token>` to every request
6. `JwtAuthGuard` (Passport strategy) validates the token on protected routes
7. On 401, Axios interceptor clears the token and redirects to login

**Single seeded admin** — credentials from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars, password stored as bcrypt hash. Inserted on app startup if no admin row exists.

---

## 7. Scheduler (Auto-Close)

```
Every day at 02:00 AM:
  1. Compute cutoff = today − AUTO_CLOSE_DAYS (default: 3)
  2. Find all RESOLVED tickets where resolvedAt <= cutoff
  3. Set each ticket's status to CLOSED
  4. flush() only if there are tickets to close
  5. Log: "Tickets closed: N"
```

Key detail — `em.fork()`: MikroORM's EntityManager is request-scoped. Cron jobs have no request, so the service calls `em.fork()` to get an isolated copy of the EM for that job run. Without this, MikroORM throws a validation error.

---

## 8. Soft Delete

- `DELETE /tickets/:id` does NOT remove the row from the database
- Sets `deletedAt`, `deletedBy`, `modifiedBy` on the ticket
- `findAll` excludes deleted tickets by default (`deletedAt: null` in where clause)
- `findAll(?includeDeleted=true)` removes that filter
- `findOne` throws 404 if ticket is soft-deleted
- Frontend: "Show deleted" toggle in the list; deleted rows shown with strikethrough styling

---

## 9. Database — Migrations

Migrations are versioned SQL scripts that create/alter tables in a controlled, reproducible way.

```
entity (TypeScript) → migration (SQL) → table in PostgreSQL
```

- Without running migrations, the table doesn't exist and every query fails
- `migration:up` applies all unapplied migrations in order
- Applied migrations are tracked in the `mikro_orm_migrations` table

**This project's migrations:**
| File | What it does |
|---|---|
| `Migration20260505091006` | Creates `ticket` table |
| `Migration20260507000000` | Creates `admin` table |
| `Migration20260507000001` | Adds `deleted_at`, `deleted_by`, `modified_by` to `ticket` |

---

## 10. MikroORM Key Concepts

**Repository vs EntityManager:**
- `EntityRepository<Ticket>` — scoped to one entity, handles reads (`find`, `findOne`)
- `EntityManager` — handles writes (`persistAndFlush`, `flush`)

**Why both?** Repository finds entities. EntityManager commits mutations. After mutating a property on an entity object directly (`ticket.status = ...`), calling `em.flush()` persists the change.

**`TsMorphMetadataProvider`:** Uses the TypeScript compiler to read entity source files and infer column types automatically. Without it, every property needs explicit type annotation.

**`autoLoadEntities: true`:** Tells MikroORM to auto-register entities declared in feature modules — no need to list them in the root config.

---

## 11. Frontend Architecture

**No React Router** — navigation is a `useState` discriminated union:
```typescript
type View =
  | { type: 'public' }           // customer submit form (default)
  | { type: 'admin-login' }      // login screen
  | { type: 'list' }             // admin ticket table
  | { type: 'detail'; id: string } // admin ticket detail
```

**Zustand store** owns all server state: `tickets`, `selectedTicket`, `loading`, `error`, `statusFilter`, `searchQuery`, `includeDeleted`. Components read from the store; actions call the API and update the store.

**Axios interceptors:**
- Request: attaches `Authorization: Bearer <token>` from localStorage if present
- Response: on 401, clears token and dispatches `unauthorized` event → App redirects to login

**Loading states:**
- Table: Ant Design Table `loading` prop
- Detail: `<Spin size="large">` while fetching
- Buttons: Ant Design Button `loading` prop during async actions

---

## 12. Docker Setup

Three services in `docker-compose.yml`:

```
db        → postgres:16-alpine, port 5432, named volume for data persistence
backend   → NestJS dev server, port 3000, bind-mounted from project root
frontend  → Vite dev server, port 5173, bind-mounted from ./frontend
```

**Bind mount + anonymous volume pattern:**
```yaml
volumes:
  - .:/app              # live code sync — edits on host appear instantly in container
  - /app/node_modules   # anonymous volume — protects container's node_modules
                        # from being overwritten by (possibly empty) host folder
```

**Key env var override:** `.env` has `DATABASE_HOST=localhost` for local dev. Docker Compose overrides it to `DATABASE_HOST=db` (the service name) so the backend can reach the database container.

**`VITE_API_URL=http://localhost:3000`** — must be the browser-facing URL (host machine), NOT a Docker-internal address. Axios calls come from the browser, not from inside the frontend container.

**Common commands:**
```bash
docker compose up --build -d                          # start everything
docker compose up --build --force-recreate -V <svc> -d  # rebuild + fresh node_modules
docker compose up -d <svc>                            # recreate one service (picks up .env changes)
docker compose logs <svc> --tail=30                   # debug startup errors
docker compose exec db psql -U postgres -d ticketing  # connect to DB
```

---

## 13. Known Workarounds (for Q&A)

**MikroORM v7 + CJS clash:** MikroORM v7 is pure ESM; NestJS projects are CommonJS. The app works because NestJS compiles TypeScript first. The MikroORM CLI crashes because it reads raw `.ts` files directly. Fix: applied migration SQL via `psql` directly and inserted the migration record manually.

**PostgreSqlDriver type mismatch:** Minor TypeScript version skew between `@mikro-orm/nestjs` and `@mikro-orm/postgresql`. Fixed with `driver: PostgreSqlDriver as any` — safe at runtime, purely a type-level mismatch.

**Jest + ESM packages:** Jest runs in CJS mode; `@mikro-orm/core`, `@mikro-orm/nestjs`, and `uuid` are pure ESM. Fixed by mocking both MikroORM packages in the spec file and adding `transformIgnorePatterns` for `uuid` in `package.json`.

**`em.fork()` in cron:** MikroORM EntityManager is request-scoped. Cron jobs have no HTTP request context, so calling the global EM directly throws. `em.fork()` creates an isolated copy for the job run.

**`$ilike` not `$like`:** PostgreSQL's `LIKE` is case-sensitive. `$ilike` compiles to `ILIKE` for case-insensitive search. MikroORM supports it for PostgreSQL drivers only.
