# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Always read first

At the start of every session, read **PLAN.md**, **CHECKLIST.md**, and **NOTES.md** before doing any work. PLAN.md contains architecture decisions, data models, and key implementation details. CHECKLIST.md tracks completion status for all 16 stages of development. NOTES.md contains concept explanations accumulated during development.

## Notes
If asked to explain anything - files, command, libraries, etc. Create or update **NOTES.md**. NOTES.md contains all the note for the dev to study the technicalities in the projects.

## Commands

```bash
# Backend (project root)
npm run start:dev        # dev server with watch
npm run build            # compile TypeScript
npm run lint             # ESLint with auto-fix
npm test                 # unit tests (Jest, runs locally — not in Docker)
npm run test:e2e         # e2e tests
npm run test:cov         # coverage report
npx jest --testPathPattern=tickets.service  # run a single test file

# Database migrations
npm run migration:create
npm run migration:up

# Docker (primary runtime)
docker compose up --build -d
docker compose exec backend npx mikro-orm migration:up
docker compose logs backend
docker compose exec db psql -U postgres -d ticketing -c "\d ticket"

# Frontend
cd frontend && npm run dev     # local dev (outside Docker)
cd frontend && npm run build   # Vite production build
```

## Architecture

**Monorepo layout:** NestJS backend at project root, React frontend at `/frontend`. Three Docker services: `db` (Postgres 16), `backend` (port 3000), `frontend` (port 5173).

**Backend stack:** NestJS 11 + MikroORM (PostgreSQL driver, TsMorphMetadataProvider) + `@nestjs/schedule` for cron + `@nestjs/config` + `class-validator`.

**Frontend stack:** React + TypeScript (Vite) + Zustand (global state) + Ant Design (UI) + Axios.

**Data flow:** `TicketsController` → `TicketsService` → MikroORM `EntityRepository<Ticket>` / `EntityManager`. `TicketsScheduler` calls `ticketsService.autoCloseResolved()` on a cron at 02:00 AM daily.

**Status machine (enforced in service, not entity):**
- Valid API transitions: `OPEN → IN_PROGRESS → RESOLVED`
- `CLOSED` is cron-only — `PUT /tickets/:id/status` with `CLOSED` returns 400
- `resolvedAt` is set only on transition to `RESOLVED`

**Frontend routing:** No React Router — `App.tsx` uses a `useState<View>` discriminated union (`list | create | detail`). Zustand store in `ticketStore.ts` owns all server state and filter state.

**Environment variables:** `.env` at project root uses `DATABASE_HOST=localhost`; Docker Compose overrides it to `DATABASE_HOST=db` (service name). `VITE_API_URL` in `frontend/.env` must be `http://localhost:3000` (browser-facing, not Docker-internal).

**ORM config:** `mikro-orm.config.ts` at project root is used by both the NestJS app (`MikroOrmModule.forRootAsync`) and the MikroORM CLI. Migrations live in `/migrations/`.
