# Notes

## Test Results

### Unit Tests — `npm test` (Stage 8)

Run locally (not in Docker). All 8 tests pass.

```
PASS src/tickets/tickets.service.spec.ts
  TicketsService
    create
      ✓ sets status=OPEN and priority=MEDIUM by default
    updateStatus
      ✓ OPEN → IN_PROGRESS succeeds
      ✓ OPEN → RESOLVED throws (skipped step)
      ✓ any → CLOSED throws with scheduler message
      ✓ IN_PROGRESS → RESOLVED sets resolvedAt
    autoCloseResolved
      ✓ closes ticket with resolvedAt older than threshold
      ✓ returns 0 and skips flush when no tickets match
    findOne
      ✓ throws NotFoundException when ticket missing

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

---

### Backend Smoke Tests — Stage 9

All containers running (`db`, `backend`, `frontend`). Backend at `http://localhost:3000`.

| # | Request | Expected | Result |
|---|---------|----------|--------|
| 9.2 | `POST /tickets` valid body | 201 + UUID `id`, `status=OPEN` | ✅ |
| 9.3 | `POST /tickets` missing `title` | 400 validation error | ✅ |
| 9.4 | `POST /tickets` invalid email | 400 validation error | ✅ |
| 9.5 | `GET /tickets` | 200 array | ✅ |
| 9.6 | `GET /tickets?status=OPEN` | 200 OPEN-only array | ✅ |
| 9.7 | `GET /tickets?q=login` | 200 filtered (case-insensitive) | ✅ |
| 9.8 | `GET /tickets/:id` | 200 single ticket | ✅ |
| 9.9 | `GET /tickets/not-a-uuid` | 400 (ParseUUIDPipe) | ✅ |
| 9.10 | `GET /tickets/00000000-…` | 404 not found | ✅ |
| 9.11 | `PUT /tickets/:id/status` OPEN→RESOLVED | 400 (skipped step) | ✅ |
| 9.12 | `PUT /tickets/:id/status` →CLOSED | 400 "auto-closed by scheduler only" | ✅ |
| 9.13 | `PUT /tickets/:id/status` OPEN→IN_PROGRESS | 200, `status=IN_PROGRESS` | ✅ |
| 9.14 | `PUT /tickets/:id/status` IN_PROGRESS→RESOLVED | 200, `resolvedAt` set | ✅ |

---

## Migrations
Migrations are versioned SQL scripts that modify the database schema in a controlled, reproducible way. MikroORM generates them by reading your `Ticket` entity TypeScript source and producing the equivalent SQL (e.g. `CREATE TABLE "ticket" (...)`).

Each migration file is committed to git. When deploying or starting fresh, you run `migration:up` to apply any unapplied migrations in order — ensuring every environment ends up with the exact same schema.

Migrations differ from auto-sync: letting the ORM sync schema on startup is convenient but dangerous in production as it can silently drop columns.

## Query Generation vs Migrations
MikroORM does two distinct things:
- **Query generation (runtime)** — when you call `ticketRepo.find(...)` or `em.flush()`, MikroORM translates that into SQL on the fly. Always happens automatically.
- **Migrations (schema management)** — a one-time manual operation that creates/alters the actual tables. Without running migrations, the `ticket` table doesn't exist and every runtime query fails.

MikroORM knows how to *talk* to the database (query generation), but migrations are what *build* the database structure in the first place.

## `@mikro-orm/reflection`
Uses the TypeScript compiler (via `ts-morph`) to read entity source files and automatically infer column types. Without it, types must be declared explicitly on every property. With `TsMorphMetadataProvider`, MikroORM reads the TypeScript type directly. Only needed at dev-time (migration generation, `ts-node`), not in the compiled production build.

## `.env.example`
A safe-to-commit template showing teammates what variables the app needs, without exposing actual values. `.env` holds real credentials and is gitignored. `.env.example` has the same keys with blank/fake values and is committed to git. New contributors run `cp .env.example .env` and fill in their own values.

## Stage 2 Items

### 2.1 — `mikro-orm.config.ts`
A standalone config file at the project root used by both the MikroORM CLI and the app. `TsMorphMetadataProvider` is set here so it can read TypeScript types when generating migrations.

### 2.2 — `"mikro-orm"` key in `package.json`
Tells the MikroORM CLI where to find the config file. Without it, `npx mikro-orm migration:create` fails because the CLI doesn't know where to look.

### 2.3 — Migration scripts in `package.json`
Shorthand aliases so you can run `npm run migration:create` instead of typing the full `npx mikro-orm ...` command.

### 2.4 — `ticket.entity.ts`
The TypeScript class representing the `ticket` table. MikroORM reads the decorators (`@Entity`, `@Property`, `@Enum`) to determine columns, types, and constraints. This is the single source of truth — migration SQL is generated from this file, and runtime queries are built against it.

**Dependency chain:** entity → config → migration → table exists → app works.

## CJS vs ESM — Simple Explanation

Node.js has two module systems:
- **CommonJS (CJS)** — old style, uses `require()`. Default for most projects.
- **ESM** — modern style, uses `import/export`. Requires opt-in (`"type":"module"` in package.json).

They don't mix well. CJS cannot `require()` a pure-ESM package.

**The clash in this project:**
- NestJS project → CJS (default)
- MikroORM v7 → pure ESM

**Why the app still works:** NestJS compiles TypeScript to JS first (`tsc`), then runs it. The compiled output handles imports in a way that avoids the clash at runtime.

**Why the CLI breaks:** `npx mikro-orm migration:up` reads raw `.ts` files directly via `tsx`. It sees a CJS project importing pure-ESM MikroORM — crash.

**Analogy:** CJS and ESM are like two different plug shapes. The app has an adapter (NestJS compiler). The CLI doesn't — it plugs directly and fails.

---

## TypeScript Transpilers
Tools that convert TypeScript to JavaScript so Node.js can run it. MikroORM v7 CLI dropped `ts-node` support and now requires one of these:

| Tool | Description |
|------|-------------|
| `tsx` | Wraps Node.js, runs `.ts` files directly. Simplest drop-in. |
| `swc` | Rust-based, very fast. Used by Next.js/Vite under the hood. |
| `oxc` | Newest Rust-based transpiler, fastest but least mature. |
| `jiti` | Similar to `tsx`, used internally by Nuxt/Vite tooling. |

This project uses `tsx` — no config needed, just install and it works. Required for `npx mikro-orm migration:create` to resolve the TypeScript config file.

## module: "nodenext" vs CommonJS

`tsconfig.json` uses `"module": "nodenext"` which tells tsx to resolve imports as ESM (modern JS modules). But `package.json` has no `"type": "module"`, so Node.js treats files as CJS (old-style CommonJS).

This mismatch causes tsx to `require()` packages using ESM resolution rules — named exports like `PrimaryKey` from `@mikro-orm/core` come back as `undefined`, causing `PrimaryKey is not a function`.

**Fix**: `tsconfig.mikro-orm.json` overrides `module` to `CommonJS` so tsx uses old-style require() and resolves packages correctly. Only used for the MikroORM CLI, not the app itself.

## Stage 4.2 — Repository & EntityManager Injection

### `@InjectRepository(Ticket)`
MikroORM provides a repository per entity — a pre-scoped query object that always operates on the `ticket` table. `@InjectRepository(Ticket)` tells NestJS's DI: "go find the repository registered for the `Ticket` entity and inject it here." It is registered in the module via `MikroOrmModule.forFeature([Ticket])` (Stage 7).

`EntityRepository<Ticket>` gives typed methods like `ticketRepo.find(...)`, `ticketRepo.findOne(...)` scoped to the `Ticket` entity.

### `EntityManager`
The repository handles *finding* entities. The `EntityManager` (`em`) handles *persisting changes* — `em.persistAndFlush(entity)` to insert, `em.flush()` to commit mutations. Both are needed because:
- `ticketRepo.find(...)` → reads
- `em.flush()` → writes (after mutating entity properties directly)

### Why constructor injection?
NestJS DI works through the constructor. When NestJS instantiates `TicketsService`, it reads the constructor parameter types and decorators, resolves the dependencies from its container, and passes them in. `private readonly` makes them instance properties automatically — no `this.ticketRepo = ticketRepo` needed.

## MikroORM v7 ESM/CJS Incompatibility — Migration CLI Broken

MikroORM v7 is **pure ESM** (no CommonJS exports). NestJS projects are **CommonJS** by default (no `"type": "module"` in `package.json`). This causes the migration CLI to fail regardless of how tsx is invoked:

- `npx mikro-orm migration:up` — tsx CJS loader can't import ESM-only `@mikro-orm/core`; named exports like `PrimaryKey` come back `undefined`
- `npm run migration:up` (with `node --import tsx/esm`) — same CJS interop failure
- `tsx run-migration.mts` — tsx still loads transitive `.ts` imports (entity, config) as CJS because the project has no `"type": "module"`; hits the same wall

**Root cause**: tsx determines module format from file extension (`.mts` → ESM, `.ts` → CJS unless `"type": "module"` in `package.json`). The entity and config are `.ts`, so they're loaded as CJS, which can't import pure-ESM `@mikro-orm/core`.

**Workaround (used here)**: Apply the migration SQL directly via `psql` and manually insert a row into `mikro_orm_migrations` to mark it as applied. Equivalent to `migration:up` for a single initial migration.

**Proper fixes (not done — out of scope for assignment)**:
- Downgrade to MikroORM v6 — has CJS exports, CLI works normally
- Add `"type": "module"` to `package.json` — requires full ESM migration of NestJS (non-trivial)

## MikroORM v7 — No Decorator API

MikroORM v7 **removed** the traditional decorator-based entity API (`@Entity`, `@Property`, `@PrimaryKey`, `@Enum`). These no longer exist in `@mikro-orm/core`. Entities must be defined with `defineEntity` + `p` (property builders).

**Old (v5/v6, doesn't work in v7):**
```typescript
@Entity()
class Ticket {
  @PrimaryKey({ type: 'uuid' }) id = uuidv4();
  @Property() title!: string;
  @Enum(() => TicketStatus) status = TicketStatus.OPEN;
}
```

**New (v7):**
```typescript
import { defineEntity, InferEntity, p } from '@mikro-orm/core';

export const Ticket = defineEntity({
  name: 'Ticket',
  properties: {
    id: p.uuid().primary().onCreate(() => uuidv4()),
    title: p.string(),
    status: p.enum(() => TicketStatus).default(TicketStatus.OPEN),
  },
});
export type Ticket = InferEntity<typeof Ticket>;
```

Key `p` builders: `p.uuid()`, `p.string()`, `p.text()`, `p.type(Date)`, `p.enum(() => EnumObj)`, `p.boolean()`.
Chain methods: `.primary()`, `.default(value)`, `.nullable()`, `.onCreate(fn)`, `.onUpdate(fn)`.

**`p.date()` vs `p.type(Date)`:** `p.date()` infers value type as `string` (ISO format). Use `p.type(Date)` to get `Date` as the JS value type so `Date` comparisons in `FilterQuery` work correctly.

**`onCreate` callback gotcha:** The `onCreate` callback receives `(entity, em)`. Passing `uuidv4` directly breaks because uuid v14 treats the second argument as a buffer. Always wrap: `onCreate(() => uuidv4())`.

## tsconfig.build.json — CommonJS override for NestJS

NestJS requires `module: CommonJS`. The project's base `tsconfig.json` used `nodenext` (incompatible with `@mikro-orm/core` v7 types). Fix in `tsconfig.build.json`:
```json
{
  "compilerOptions": { "module": "CommonJS", "moduleResolution": "Node" },
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts", "frontend", "run-migration.mts", "migrations"]
}
```
The `exclude` list prevents the NestJS compiler from picking up frontend JSX files and migration scripts.

## Jest + ESM packages — Unit Test Workaround

Jest runs in CommonJS mode by default. Three packages in this project are pure ESM and cannot be `require()`d by Jest:

| Package | Why it fails |
|---------|-------------|
| `@mikro-orm/core` | Pure ESM; also uses `import.meta` which CJS transpilation cannot handle |
| `@mikro-orm/nestjs` | Pure ESM (`export * from './...'` at top of index.js) |
| `uuid` v14 | Pure ESM |

**Fix applied in `tickets.service.spec.ts`:**
```typescript
// At the very top of the spec file — jest.mock() calls are hoisted above imports
jest.mock('@mikro-orm/nestjs', () => ({
  InjectRepository: () => () => {},
}));
jest.mock('@mikro-orm/core', () => {
  const noop = () => () => {};
  return { Entity: noop, Property: noop, PrimaryKey: noop, Enum: noop,
           EntityRepository: class {}, EntityManager: class {} };
});
```

**Fix applied in `package.json` jest config:**
```json
"transformIgnorePatterns": ["/node_modules/(?!uuid)"]
```
This tells ts-jest to transform `uuid` (instead of leaving it as-is), solving the ESM import error.

**Why not use TestingModule?** `@nestjs/testing`'s `Test.createTestingModule` imports `@mikro-orm/nestjs` internally for DI token resolution. The mock intercepts it before it loads. The service is instantiated directly:
```typescript
service = new TicketsService(repo as any, em as any);
```

**The DI injection token:** `@InjectRepository(Ticket)` uses the token `'TicketRepository'` (entity name + `'Repository'`). This is deterministic — no need to import `getRepositoryToken` from the ESM-only package.

---

## PostgreSqlDriver type incompatibility — `as any` cast

`@mikro-orm/nestjs@7.0.1` and `@mikro-orm/postgresql@7.0.14` have a type mismatch: `SqlSchemaGenerator` in `@mikro-orm/postgresql` is missing `refresh` and `ensureIndexes` from the `ISchemaGenerator` interface that `@mikro-orm/nestjs` expects.

**Symptom:** TypeScript error in `app.module.ts`:
```
Type 'typeof PostgreSqlDriver' is not assignable to type ...
Type 'SqlSchemaGenerator' is missing ... 'refresh', 'ensureIndexes'
```

**Fix:** Cast the driver to bypass the version mismatch:
```typescript
driver: PostgreSqlDriver as any,
```
This is safe — the driver IS correct at runtime, it's purely a TypeScript interface version skew.

---

## Case-sensitive search — `$like` vs `$ilike`

PostgreSQL's `LIKE` operator is case-sensitive. `WHERE title LIKE '%login%'` will NOT match `'Login bug'`.

**Fix:** Use `$ilike` (case-insensitive LIKE) in the service:
```typescript
where.$or = [
  { title: { $ilike: `%${query.q}%` } },
  { description: { $ilike: `%${query.q}%` } },
];
```
`$ilike` is PostgreSQL-specific. It compiles to `ILIKE` in the SQL. MikroORM supports it for PostgreSQL drivers.

---

## `.env` — DATABASE_PASSWORD must not be empty

The `.env` file originally had `DATABASE_PASSWORD=` (empty string). PostgreSQL with `scram-sha-256` authentication (default in Postgres 14+) **rejects empty passwords** — the `pg` client throws:

```
SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

The Docker DB service was initialized with `POSTGRES_PASSWORD: postgres`, so the password in `.env` must also be `postgres`.

**`.env` correct values:**
```
DATABASE_PASSWORD=postgres
```

---

## `docker compose restart` vs `docker compose up -d` — env_file reloading

`docker compose restart` restarts a running container **without re-reading `env_file`**. The environment variables are baked in at container creation time.

To pick up `.env` changes, you must **recreate** the container:
```bash
docker compose up -d backend    # recreates + starts with new env
```

`up -d` detects that the config changed and recreates automatically. `restart` just stops/starts the existing container.

---

## cross-env

A utility that sets environment variables in npm scripts cross-platform. Windows uses `set VAR=value`, Mac/Linux uses `VAR=value`. `cross-env` abstracts that so the same npm script works on any OS.

Used in migration scripts to set `TSCONFIG_PATH=./tsconfig.mikro-orm.json`, which tells tsx to use the CommonJS-compatible tsconfig instead of the default `nodenext` one.
