# Plan: Customer Service Ticketing System

## Context
Build a full-stack ticketing system per requirements/requirement.md. NestJS scaffold exists at project root (clean slate). Backend stays at root; React frontend in `/frontend`.

**Scope decisions:**
- CLOSED is cron-only — `PUT /tickets/:id/status` rejects RESOLVED→CLOSED
- Bonus: priority field (LOW/MEDIUM/HIGH), keyword search, unit tests

---

## Phase 0: Install Dependencies

> npm installs are still needed locally for TypeScript/IDE support. Docker handles runtime.

### Backend (project root)
```
npm install @mikro-orm/core @mikro-orm/nestjs @mikro-orm/postgresql @mikro-orm/migrations @mikro-orm/reflection @nestjs/schedule @nestjs/config class-validator class-transformer pg uuid
npm install --save-dev @mikro-orm/cli @types/uuid
```

### Frontend
```
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install zustand antd axios
```

---

## Phase 0B: Docker

All three services run via Docker Compose. No local PostgreSQL required.

### `docker-compose.yml` (project root)
```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ticketing
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      DATABASE_HOST: db        # overrides localhost in .env; uses Docker service name
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules      # anonymous volume keeps container's node_modules intact

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  postgres_data:
```

### `Dockerfile` (backend, project root)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
```

### `frontend/Dockerfile`
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### `.dockerignore` (project root) / `frontend/.dockerignore`
```
node_modules
dist
.env
.git
```

### `frontend/vite.config.ts` — must bind to 0.0.0.0
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
```

### Key Docker decisions
- `env_file: .env` loads all vars; `environment.DATABASE_HOST: db` overrides only the host to the Docker service name — `.env` keeps `localhost` so the app also works outside Docker
- Anonymous `/app/node_modules` volume prevents the host directory (which may be empty) from shadowing packages installed inside the container
- Vite requires `--host 0.0.0.0` to accept connections from outside the container
- `condition: service_healthy` on `db` ensures backend waits for PostgreSQL to accept connections before starting
- Migrations run as a one-off after containers are up: `docker compose exec backend npx mikro-orm migration:up`
- `VITE_API_URL=http://localhost:3000` is correct — Axios calls come from the **browser** (host machine), not from inside the frontend container

---

## Phase 1: Files to Create/Modify

### Docker

| File | Action |
|---|---|
| `Dockerfile` | Create — backend dev image |
| `frontend/Dockerfile` | Create — frontend dev image |
| `docker-compose.yml` | Create — db + backend + frontend services |
| `.dockerignore` | Create — exclude node_modules, dist, .env, .git |
| `frontend/.dockerignore` | Create — same exclusions for frontend build context |
| `frontend/vite.config.ts` | Create/modify — add `server.host: '0.0.0.0'` |

### Backend

| File | Action |
|---|---|
| `mikro-orm.config.ts` | Create — ORM config for CLI + app |
| `src/main.ts` | Modify — add ValidationPipe, enableCors |
| `src/app.module.ts` | Replace — ConfigModule, MikroOrmModule, ScheduleModule |
| `src/tickets/entities/ticket.entity.ts` | Create — Ticket entity with priority |
| `src/tickets/dto/create-ticket.dto.ts` | Create — include optional priority |
| `src/tickets/dto/update-ticket-status.dto.ts` | Create |
| `src/tickets/dto/list-tickets.dto.ts` | Create — status + q (keyword) filters |
| `src/tickets/tickets.service.ts` | Create — business logic + autoClose |
| `src/tickets/tickets.scheduler.ts` | Create — cron at 02:00 AM |
| `src/tickets/tickets.controller.ts` | Create — 4 REST endpoints |
| `src/tickets/tickets.module.ts` | Create |
| `src/tickets/tickets.service.spec.ts` | Create — unit tests |
| `.env` / `.env.example` | Create |
| `package.json` | Modify — add mikro-orm CLI scripts |

### Frontend (`frontend/src/`)

| File | Action |
|---|---|
| `types/ticket.types.ts` | Create — shared types, NEXT_STATUS, priority |
| `api/tickets.ts` | Create — Axios calls |
| `store/ticketStore.ts` | Create — Zustand store |
| `components/StatusBadge.tsx` | Create |
| `components/PriorityBadge.tsx` | Create |
| `components/TicketList.tsx` | Create — table + status tabs + search input |
| `components/TicketForm.tsx` | Create — includes priority select |
| `components/TicketDetail.tsx` | Create — detail + status update |
| `App.tsx` | Replace — view-state router |
| `main.tsx` | Modify — Ant Design ConfigProvider |
| `.env` | Create |

---

## Phase 2: Key Implementation Details

### Ticket Entity
```typescript
export enum TicketStatus { OPEN='OPEN', IN_PROGRESS='IN_PROGRESS', RESOLVED='RESOLVED', CLOSED='CLOSED' }
export enum TicketPriority { LOW='LOW', MEDIUM='MEDIUM', HIGH='HIGH' }

@Entity()
export class Ticket {
  @PrimaryKey({ type: 'uuid' }) id = uuidv4();
  @Property() title!: string;
  @Property() customerName!: string;
  @Property() customerEmail!: string;
  @Property({ type: 'text' }) description!: string;
  @Enum(() => TicketStatus) status = TicketStatus.OPEN;
  @Enum(() => TicketPriority) priority: TicketPriority = TicketPriority.MEDIUM;
  @Property() createdAt = new Date();
  @Property({ nullable: true }) resolvedAt?: Date;
  @Property({ onUpdate: () => new Date() }) updatedAt = new Date();
}
```

### Status Transitions
```typescript
// CLOSED excluded — cron-only, API cannot transition to CLOSED
const VALID_TRANSITIONS: Partial<Record<TicketStatus, TicketStatus>> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
};

// updateStatus: if VALID_TRANSITIONS[current] !== requested → 400
// Exception: if requested === CLOSED → 400 "Use cron auto-close"
// Sets resolvedAt only on transition TO RESOLVED
```

### `autoCloseResolved` (batch UoW, idempotent)
```typescript
async autoCloseResolved(days: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const tickets = await this.ticketRepo.find({
    status: TicketStatus.RESOLVED,
    resolvedAt: { $lte: cutoff },
  });
  tickets.forEach(t => (t.status = TicketStatus.CLOSED));
  if (tickets.length) await this.em.flush();
  return tickets.length;
}
```

### Keyword Search (`GET /tickets?q=...`)
```typescript
// Added to findAll where clause when q is provided:
{
  $or: [
    { title: { $like: `%${q}%` } },
    { description: { $like: `%${q}%` } },
  ]
}
```

### Unit Tests (`tickets.service.spec.ts`)
Test cases:
- `create` sets status=OPEN, priority default MEDIUM
- `updateStatus` OPEN→IN_PROGRESS succeeds
- `updateStatus` OPEN→RESOLVED rejects (skipped step)
- `updateStatus` any→CLOSED rejects with "cron-only" message
- `updateStatus` IN_PROGRESS→RESOLVED sets resolvedAt
- `autoCloseResolved` closes only tickets where resolvedAt <= cutoff
- `autoCloseResolved` skips already-CLOSED tickets (idempotent)

---

## Phase 3: Environment Variables

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_HOST` | `localhost` | Postgres host |
| `DATABASE_PORT` | `5432` | Postgres port |
| `DATABASE_NAME` | `ticketing` | DB name |
| `DATABASE_USER` | `postgres` | DB user |
| `DATABASE_PASSWORD` | _(empty)_ | DB password |
| `AUTO_CLOSE_DAYS` | `3` | Days before auto-close |
| `PORT` | `3000` | NestJS port |
| `VITE_API_URL` | `http://localhost:3000` | Frontend API base |

---

## Phase 4: Database Migration

```bash
psql -U postgres -c "CREATE DATABASE ticketing;"
npx mikro-orm migration:create --initial
npx mikro-orm migration:up
```

`package.json` additions:
```json
"scripts": {
  "migration:create": "mikro-orm migration:create",
  "migration:up":     "mikro-orm migration:up"
},
"mikro-orm": {
  "configPaths": ["./mikro-orm.config.ts"],
  "useTsNode": true
}
```

---

## Phase 5: Frontend Key Patterns

**View router** — discriminated union in App.tsx, no React Router:
```typescript
type View = { type: 'list' } | { type: 'create' } | { type: 'detail'; id: string };
```

**TicketList** — Ant Design Table + Tabs for status filter + Search Input for keyword

**TicketDetail** — shows next valid status button (only OPEN/IN_PROGRESS have manual next):
```typescript
// NEXT_STATUS excludes CLOSED (cron-only)
const NEXT_STATUS = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'RESOLVED', RESOLVED: null, CLOSED: null };
```

**TicketForm** — includes priority select (default MEDIUM), Ant Design Form validation

---

## Verification

1. `docker compose up --build -d` — all 3 containers start, no errors
2. `docker compose exec backend npx mikro-orm migration:up` — migration applied
3. `POST http://localhost:3000/tickets` → 201, status=OPEN, priority=MEDIUM
4. `GET http://localhost:3000/tickets?status=OPEN&q=bug` → filtered list
5. `PUT /tickets/:id/status` OPEN→RESOLVED → 400 (skip not allowed)
6. `PUT /tickets/:id/status` any→CLOSED → 400 "auto-closed by scheduler only"
7. `PUT /tickets/:id/status` OPEN→IN_PROGRESS → 200
8. `PUT /tickets/:id/status` IN_PROGRESS→RESOLVED → 200, resolvedAt set
9. `npm test` — all unit tests pass (run locally, not in Docker)
10. Open `http://localhost:5173` — frontend loads, create ticket, filter, search, advance status, verify no CLOSED button

---

## Development Checklist

See [CHECKLIST.md](./CHECKLIST.md) for the full step-by-step checklist (Stages 0–16).
