# Notes

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

## cross-env

A utility that sets environment variables in npm scripts cross-platform. Windows uses `set VAR=value`, Mac/Linux uses `VAR=value`. `cross-env` abstracts that so the same npm script works on any OS.

Used in migration scripts to set `TSCONFIG_PATH=./tsconfig.mikro-orm.json`, which tells tsx to use the CommonJS-compatible tsconfig instead of the default `nodenext` one.
