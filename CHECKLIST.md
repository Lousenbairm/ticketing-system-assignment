# Development Checklist

### Stage 0 — Docker Configuration

- [x] **0.1** Confirm Docker Desktop is installed and running: `docker info` — output shows Server version, no errors
- [x] **0.2** Create `Dockerfile` at project root (backend):
  - [x] `FROM node:20-alpine`
  - [x] `WORKDIR /app`
  - [x] `COPY package*.json ./` then `RUN npm install`
  - [x] `COPY . .`
  - [x] `EXPOSE 3000`
  - [x] `CMD ["npm", "run", "start:dev"]`
- [x] **0.3** Create `frontend/Dockerfile`:
  - [x] `FROM node:20-alpine`
  - [x] `WORKDIR /app`
  - [x] `COPY package*.json ./` then `RUN npm install`
  - [x] `COPY . .`
  - [x] `EXPOSE 5173`
  - [x] `CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]`
- [x] **0.4** Create `docker-compose.yml` at project root:
  - [x] `db` service: image `postgres:16-alpine`, env `POSTGRES_DB/USER/PASSWORD=postgres/postgres/postgres`, port `5432:5432`, named volume `postgres_data`, healthcheck `pg_isready -U postgres` every 5s
  - [x] `backend` service: `build: { context: ., dockerfile: Dockerfile }`, port `3000:3000`, `env_file: .env`, `environment.DATABASE_HOST: db` (overrides localhost in .env), `depends_on: db: condition: service_healthy`, volumes `.:/app` and `/app/node_modules`
  - [x] `frontend` service: `build: { context: ./frontend, dockerfile: Dockerfile }`, port `5173:5173`, `environment.VITE_API_URL: http://localhost:3000`, `depends_on: backend`, volumes `./frontend:/app` and `/app/node_modules`
  - [x] `volumes:` block at bottom declaring `postgres_data:`
- [x] **0.5** Create `.dockerignore` at project root — entries: `node_modules`, `dist`, `.env`, `.git`
- [x] **0.6** Create `frontend/.dockerignore` — entries: `node_modules`, `dist`, `.env`
- [x] **0.7** Update `frontend/vite.config.ts` — add `server: { host: '0.0.0.0', port: 5173 }` inside `defineConfig`

---

### Stage 1 — Project Setup

- [x] **1.1** Install backend dependencies locally (for IDE/TypeScript support — Docker handles runtime):
  ```
  npm install @mikro-orm/core @mikro-orm/nestjs @mikro-orm/postgresql @mikro-orm/migrations @mikro-orm/reflection @nestjs/schedule @nestjs/config class-validator class-transformer pg uuid
  npm install --save-dev @mikro-orm/cli @types/uuid
  ```
- [x] **1.2** Confirm no install errors: `npm list @mikro-orm/core @nestjs/schedule class-validator` — all appear without `UNMET`
- [x] **1.3** Create `.env` at project root — set `DATABASE_HOST=localhost` (local default; Docker overrides this to `db` via compose `environment` block):
  ```
  DATABASE_HOST=localhost
  DATABASE_PORT=5432
  DATABASE_NAME=ticketing
  DATABASE_USER=postgres
  DATABASE_PASSWORD=postgres
  AUTO_CLOSE_DAYS=3
  PORT=3000
  ```
- [x] **1.4** Create `.env.example` with same keys, `DATABASE_PASSWORD` left blank
- [x] **1.5** Add `.env` to `.gitignore` (add line `.env`)

---

### Stage 2 — Backend: ORM Config & Entity

- [x] **2.1** Create `mikro-orm.config.ts` at project root — `defineConfig` with `TsMorphMetadataProvider`, explicit `entities: [Ticket]`, `migrations.path: './migrations'`
- [x] **2.2** Add `"mikro-orm"` top-level key to `package.json` pointing to config file with `useTsNode: true`
- [x] **2.3** Add `migration:create` and `migration:up` scripts to `package.json`
- [x] **2.4** Create `src/tickets/entities/ticket.entity.ts`:
  - [x] `TicketStatus` enum: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
  - [x] `TicketPriority` enum: `LOW`, `MEDIUM`, `HIGH`
  - [x] `Ticket` class with all 9 fields from data model + priority
  - [x] `id` uses `uuidv4()` as default, type `uuid`
  - [x] `status` defaults to `TicketStatus.OPEN`
  - [x] `priority` defaults to `TicketPriority.MEDIUM`
  - [x] `resolvedAt` is `nullable: true`
  - [x] `updatedAt` has `onUpdate: () => new Date()`
- [x] **2.5** Generate initial migration locally — created manually due to ESM-only `@mikro-orm/core` incompatibility with tsx CJS loader
- [x] **2.6** Confirm migration file appears in `/migrations/` folder with correct `CREATE TABLE` SQL for the `ticket` table
- [x] **2.7** Start containers and apply migration:
  ```
  docker compose up --build -d
  docker compose exec backend npx mikro-orm migration:up
  ```
  > `migration:up` CLI is broken — MikroORM v7 pure ESM vs CommonJS project incompatibility. Applied SQL directly via psql and inserted row into `mikro_orm_migrations` manually. See NOTES.md for details.
- [x] **2.8** Verify table inside the DB container: `docker compose exec db psql -U postgres -d ticketing -c "\d ticket"` — all columns present including `priority`, `resolved_at`

---

### Stage 3 — Backend: DTOs

- [x] **3.1** Create `src/tickets/dto/create-ticket.dto.ts`:
  - [x] `title`: `@IsNotEmpty()`, `@IsString()`, `@MaxLength(255)`
  - [x] `customerName`: `@IsNotEmpty()`, `@IsString()`, `@MaxLength(255)`
  - [x] `customerEmail`: `@IsEmail()`
  - [x] `description`: `@IsNotEmpty()`, `@IsString()`
  - [x] `priority`: `@IsOptional()`, `@IsEnum(TicketPriority)` — optional, backend defaults to MEDIUM
- [x] **3.2** Create `src/tickets/dto/update-ticket-status.dto.ts`:
  - [x] `status`: `@IsEnum(TicketStatus)`, required
- [x] **3.3** Create `src/tickets/dto/list-tickets.dto.ts`:
  - [x] `status`: `@IsOptional()`, `@IsEnum(TicketStatus)`
  - [x] `q`: `@IsOptional()`, `@IsString()` — keyword search term

---

### Stage 4 — Backend: Service

- [x] **4.1** Create `src/tickets/tickets.service.ts` with `@Injectable()`
- [x] **4.2** Inject `EntityRepository<Ticket>` via `@InjectRepository(Ticket)` and `EntityManager`
- [x] **4.3** Implement `create(dto)`:
  - [x] Spread DTO fields onto new entity, force `status: TicketStatus.OPEN` regardless of input
  - [x] `persistAndFlush` and return the created ticket
- [x] **4.4** Implement `findAll(query)`:
  - [x] Build `where` object: add `status` if provided
  - [x] Add `$or: [{ title: { $like: '%q%' } }, { description: { $like: '%q%' } }]` if `q` provided
  - [x] Return `findAll({ where, orderBy: { createdAt: 'DESC' } })`
- [x] **4.5** Implement `findOne(id)`:
  - [x] `findOne(id)` — throw `NotFoundException` with message `Ticket ${id} not found` if null
- [x] **4.6** Implement `updateStatus(id, dto)`:
  - [x] Call `findOne(id)` to get ticket (re-uses 404 logic)
  - [x] Define `VALID_TRANSITIONS` map: `{ OPEN: IN_PROGRESS, IN_PROGRESS: RESOLVED }` — RESOLVED and CLOSED have no entry
  - [x] If `dto.status === TicketStatus.CLOSED` → throw `BadRequestException('Tickets are auto-closed by the scheduler only')`
  - [x] If `VALID_TRANSITIONS[ticket.status] !== dto.status` → throw `BadRequestException('Cannot transition from X to Y. Allowed: Z')`
  - [x] Set `ticket.status = dto.status`
  - [x] If new status is `RESOLVED`, set `ticket.resolvedAt = new Date()`
  - [x] `em.flush()` and return updated ticket
- [x] **4.7** Implement `autoCloseResolved(days)`:
  - [x] Compute `cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)`
  - [x] Query: `{ status: RESOLVED, resolvedAt: { $lte: cutoff } }`
  - [x] Loop and set each ticket's status to CLOSED
  - [x] Call `em.flush()` only if `tickets.length > 0`
  - [x] Return `tickets.length`

---

### Stage 5 — Backend: Scheduler

- [ ] **5.1** Create `src/tickets/tickets.scheduler.ts` with `@Injectable()`
- [ ] **5.2** Inject `TicketsService` and `ConfigService`
- [ ] **5.3** Add `private readonly logger = new Logger(TicketsScheduler.name)`
- [ ] **5.4** Implement `handleAutoClose()` with `@Cron('0 2 * * *')`:
  - [ ] Read `AUTO_CLOSE_DAYS` from config with `configService.get<number>('AUTO_CLOSE_DAYS', 3)`
  - [ ] Wrap in `Number()` to ensure numeric type
  - [ ] Log start with threshold: `Auto-close cron started. Threshold: X days`
  - [ ] Call `ticketsService.autoCloseResolved(days)`
  - [ ] Log result: `Auto-close cron completed. Tickets closed: N`

---

### Stage 6 — Backend: Controller

- [ ] **6.1** Create `src/tickets/tickets.controller.ts` with `@Controller('tickets')`
- [ ] **6.2** Implement `POST /tickets`:
  - [ ] `@Post()`, `@HttpCode(HttpStatus.CREATED)`
  - [ ] `@Body() dto: CreateTicketDto` — calls `ticketsService.create(dto)`
- [ ] **6.3** Implement `GET /tickets`:
  - [ ] `@Get()`, `@Query() query: ListTicketsDto` — calls `ticketsService.findAll(query)`
- [ ] **6.4** Implement `GET /tickets/:id`:
  - [ ] `@Get(':id')`, `@Param('id', ParseUUIDPipe) id: string` — calls `ticketsService.findOne(id)`
  - [ ] `ParseUUIDPipe` returns 400 automatically if id is not valid UUID format
- [ ] **6.5** Implement `PUT /tickets/:id/status`:
  - [ ] `@Put(':id/status')`, `@Param('id', ParseUUIDPipe)`, `@Body() dto: UpdateTicketStatusDto`
  - [ ] Calls `ticketsService.updateStatus(id, dto)`

---

### Stage 7 — Backend: Module & App Wiring

- [ ] **7.1** Create `src/tickets/tickets.module.ts`:
  - [ ] `MikroOrmModule.forFeature([Ticket])` in imports
  - [ ] `TicketsController` in controllers
  - [ ] `TicketsService` and `TicketsScheduler` in providers
- [ ] **7.2** Replace `src/app.module.ts`:
  - [ ] `ConfigModule.forRoot({ isGlobal: true })` — first import
  - [ ] `MikroOrmModule.forRootAsync` — useFactory reads DB config from `ConfigService`
  - [ ] Set `autoLoadEntities: true` in MikroORM options
  - [ ] `ScheduleModule.forRoot()`
  - [ ] `TicketsModule`
  - [ ] Remove `AppController` and `AppService` from module
- [ ] **7.3** Update `src/main.ts`:
  - [ ] Add `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`
  - [ ] Add `app.enableCors({ origin: 'http://localhost:5173' })`
- [ ] **7.4** Delete unused `src/app.controller.ts`, `src/app.service.ts`, `src/app.controller.spec.ts`

---

### Stage 8 — Backend: Unit Tests

- [ ] **8.1** Create `src/tickets/tickets.service.spec.ts`
- [ ] **8.2** Mock `EntityRepository<Ticket>` with jest functions: `create`, `find`, `findOne`, `findAll`
- [ ] **8.3** Mock `EntityManager` with jest function: `persistAndFlush`, `flush`
- [ ] **8.4** Write and pass test: `create()` returns ticket with `status=OPEN` and `priority=MEDIUM`
- [ ] **8.5** Write and pass test: `updateStatus()` OPEN→IN_PROGRESS succeeds, returns ticket with new status
- [ ] **8.6** Write and pass test: `updateStatus()` OPEN→RESOLVED throws `BadRequestException`
- [ ] **8.7** Write and pass test: `updateStatus()` IN_PROGRESS→CLOSED throws `BadRequestException` with "scheduler" in message
- [ ] **8.8** Write and pass test: `updateStatus()` IN_PROGRESS→RESOLVED sets `resolvedAt` to a Date
- [ ] **8.9** Write and pass test: `autoCloseResolved(3)` — given ticket with `resolvedAt` 4 days ago → sets status CLOSED, returns 1
- [ ] **8.10** Write and pass test: `autoCloseResolved(3)` — given ticket with `resolvedAt` 2 days ago → does not close, returns 0
- [ ] **8.11** Run `npm test` — all tests pass with no errors

---

### Stage 9 — Backend: Smoke Test

- [ ] **9.1** Ensure all containers are running: `docker compose ps` — `db`, `backend`, `frontend` all show status `Up`; check backend logs for no errors: `docker compose logs backend`
- [ ] **9.2** `POST http://localhost:3000/tickets` with valid body → `201` response, UUID `id` present
- [ ] **9.3** `POST http://localhost:3000/tickets` with missing `title` → `400` with validation message
- [ ] **9.4** `POST http://localhost:3000/tickets` with invalid email → `400` with validation message
- [ ] **9.5** `GET http://localhost:3000/tickets` → `200` array (contains ticket from 9.2)
- [ ] **9.6** `GET http://localhost:3000/tickets?status=OPEN` → `200` array containing only OPEN tickets
- [ ] **9.7** `GET http://localhost:3000/tickets?q=<part-of-title>` → `200` filtered array
- [ ] **9.8** `GET http://localhost:3000/tickets/<uuid-from-9.2>` → `200` single ticket object
- [ ] **9.9** `GET http://localhost:3000/tickets/not-a-uuid` → `400` (ParseUUIDPipe rejection)
- [ ] **9.10** `GET http://localhost:3000/tickets/00000000-0000-0000-0000-000000000000` → `404` with "not found" message
- [ ] **9.11** `PUT http://localhost:3000/tickets/<id>/status` body `{"status":"RESOLVED"}` on OPEN ticket → `400` (skip not allowed)
- [ ] **9.12** `PUT http://localhost:3000/tickets/<id>/status` body `{"status":"CLOSED"}` → `400` (cron-only message)
- [ ] **9.13** `PUT http://localhost:3000/tickets/<id>/status` body `{"status":"IN_PROGRESS"}` → `200`, status updated
- [ ] **9.14** `PUT http://localhost:3000/tickets/<id>/status` body `{"status":"RESOLVED"}` on IN_PROGRESS ticket → `200`, `resolvedAt` is now set

---

### Stage 10 — Frontend: Scaffold & Config

- [x] **10.1** From project root: `npm create vite@latest frontend -- --template react-ts`
- [ ] **10.2** Install locally for IDE support: `cd frontend && npm install zustand antd axios`
- [ ] **10.3** Create `frontend/.env` with `VITE_API_URL=http://localhost:3000` (browser-facing URL, not Docker internal)
- [x] **10.4** Confirm `frontend/src/main.tsx` and `frontend/src/App.tsx` exist from scaffold

---

### Stage 11 — Frontend: Types & API Layer

- [ ] **11.1** Create `frontend/src/types/ticket.types.ts`:
  - [ ] `TicketStatus` type union: `'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'`
  - [ ] `TicketPriority` type union: `'LOW' | 'MEDIUM' | 'HIGH'`
  - [ ] `Ticket` interface with all 9 fields (id, title, customerName, customerEmail, description, status, priority, createdAt, resolvedAt?, updatedAt)
  - [ ] `CreateTicketPayload` interface (title, customerName, customerEmail, description, priority?)
  - [ ] `NEXT_STATUS` map — `RESOLVED` and `CLOSED` map to `null` (cron-only)
  - [ ] `STATUS_LABELS` map — human-readable strings for each status
  - [ ] `STATUS_COLORS` map — Ant Design tag colors for each status
  - [ ] `PRIORITY_COLORS` map — Ant Design tag colors for LOW/MEDIUM/HIGH
- [ ] **11.2** Create `frontend/src/api/tickets.ts`:
  - [ ] Axios instance with `baseURL: import.meta.env.VITE_API_URL`
  - [ ] `list(status?, q?)` → `GET /tickets` with params — returns `Ticket[]`
  - [ ] `get(id)` → `GET /tickets/:id` — returns `Ticket`
  - [ ] `create(payload)` → `POST /tickets` — returns `Ticket`
  - [ ] `updateStatus(id, status)` → `PUT /tickets/:id/status` — returns `Ticket`

---

### Stage 12 — Frontend: Zustand Store

- [ ] **12.1** Create `frontend/src/store/ticketStore.ts`
- [ ] **12.2** State shape: `tickets`, `selectedTicket`, `loading`, `error`, `statusFilter`, `searchQuery`
- [ ] **12.3** Action `fetchTickets(status?, q?)`: sets `loading=true`, calls `ticketsApi.list`, sets `tickets`, handles error into `error` string
- [ ] **12.4** Action `fetchTicket(id)`: sets `loading=true`, `selectedTicket=null`, calls `ticketsApi.get`, sets `selectedTicket`, handles 404 into `error`
- [ ] **12.5** Action `createTicket(payload)`: calls `ticketsApi.create`, prepends new ticket to `tickets` list, throws on error (so form can stay open)
- [ ] **12.6** Action `updateStatus(id, status)`: calls `ticketsApi.updateStatus`, updates both `selectedTicket` and the matching entry in `tickets` array — no refetch needed
- [ ] **12.7** Action `setFilter(status)`: sets `statusFilter`, immediately calls `fetchTickets(status, searchQuery)`
- [ ] **12.8** Action `setSearch(q)`: sets `searchQuery`, immediately calls `fetchTickets(statusFilter, q)`
- [ ] **12.9** Action `clearError()`: sets `error=null`

---

### Stage 13 — Frontend: Components

- [ ] **13.1** Create `frontend/src/components/StatusBadge.tsx`:
  - [ ] Renders `<Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>`
- [ ] **13.2** Create `frontend/src/components/PriorityBadge.tsx`:
  - [ ] Renders `<Tag color={PRIORITY_COLORS[priority]}>{priority}</Tag>`
- [ ] **13.3** Create `frontend/src/components/TicketList.tsx`:
  - [ ] On mount: call `fetchTickets()` via `useEffect([], [])`
  - [ ] Ant Design `Tabs` with items: All / OPEN / IN_PROGRESS / RESOLVED / CLOSED — onChange calls `setFilter`
  - [ ] Ant Design `Input.Search` above table — onSearch calls `setSearch`
  - [ ] Ant Design `Table` with columns: Title, Customer Name, Email, Priority (`PriorityBadge`), Status (`StatusBadge`), Created (formatted date), Action (View button)
  - [ ] Table `loading` prop bound to store `loading`
  - [ ] View button calls `onSelect(record.id)` passed from parent
  - [ ] `Alert` shown when `error` is non-null, closable via `clearError`
- [ ] **13.4** Create `frontend/src/components/TicketForm.tsx`:
  - [ ] Ant Design `Form` with `layout="vertical"`
  - [ ] Fields: Customer Name (required), Email (required, email rule), Subject/Title (required), Description (required, TextArea), Priority (Select, options LOW/MEDIUM/HIGH, default MEDIUM)
  - [ ] Submit calls `createTicket(values)`, on success calls `onSuccess()` prop and resets form
  - [ ] `loading` prop on Submit button bound to store `loading`
  - [ ] `Alert` shown when `error` is non-null, closable via `clearError`
- [ ] **13.5** Create `frontend/src/components/TicketDetail.tsx`:
  - [ ] On mount / when `id` prop changes: call `fetchTicket(id)` via `useEffect([id], [id])`
  - [ ] Show `<Spin>` while `loading` is true and `selectedTicket` is null
  - [ ] Show `<Alert>` with Back button if `error` is non-null
  - [ ] Ant Design `Descriptions` (bordered): Status (StatusBadge), Priority (PriorityBadge), Customer, Email, Description, Created, Resolved (only if resolvedAt is set)
  - [ ] Back button (top-right of Card) calls `onBack()` prop
  - [ ] "Move to X" button: shown only if `NEXT_STATUS[ticket.status]` is non-null
  - [ ] Button label: `Move to ${STATUS_LABELS[NEXT_STATUS[ticket.status]]}`
  - [ ] Button click: calls `updateStatus(id, next)`, then `message.success('Ticket moved to X')`
  - [ ] `Alert` shown when `error` is non-null after status update failure

---

### Stage 14 — Frontend: App Shell & Entry

- [ ] **14.1** Replace `frontend/src/App.tsx`:
  - [ ] `useState<View>` with discriminated union starting at `{ type: 'list' }`
  - [ ] Ant Design `Layout` with `Content` centered at max-width 1100px
  - [ ] Header row: "Support Tickets" title (left) + "New Ticket" button (right, hidden on create view)
  - [ ] Render `<TicketList onSelect={id => setView({ type: 'detail', id })} />` when view is `list`
  - [ ] Render `<TicketForm onSuccess={() => setView({ type: 'list' })} />` when view is `create`
  - [ ] Render `<TicketDetail id={view.id} onBack={() => setView({ type: 'list' })} />` when view is `detail`
- [ ] **14.2** Update `frontend/src/main.tsx`:
  - [ ] Import `import 'antd/dist/reset.css'`
  - [ ] Wrap `<App />` in `<ConfigProvider>`
- [ ] **14.3** Rebuild and restart containers to pick up new frontend files: `docker compose up --build -d`
- [ ] **14.4** Confirm frontend container is serving: `docker compose logs frontend` — shows `VITE ... ready` with port 5173; open `http://localhost:5173` in browser — no blank page or console errors

---

### Stage 15 — Frontend: End-to-End Manual Test

- [ ] **15.1** Open `http://localhost:5173` — ticket list loads, table is empty (no error)
- [ ] **15.2** Click "New Ticket" — form renders with all 5 fields
- [ ] **15.3** Submit empty form — required field errors appear inline (not page error)
- [ ] **15.4** Enter invalid email — email validation error appears
- [ ] **15.5** Fill all fields with priority HIGH, submit — success, redirected to list, new ticket appears at top
- [ ] **15.6** Create a second ticket with priority LOW
- [ ] **15.7** Click "OPEN" tab — only OPEN tickets shown
- [ ] **15.8** Click "IN_PROGRESS" tab — empty table (no errors)
- [ ] **15.9** Type part of the first ticket's title in search box — table filters to matching tickets only
- [ ] **15.10** Clear search — all tickets in current tab reappear
- [ ] **15.11** Click "View" on a ticket — detail view loads with correct data
- [ ] **15.12** Detail view shows "Move to In Progress" button (not "Move to Closed")
- [ ] **15.13** Click "Move to In Progress" — success toast, status badge changes to IN_PROGRESS
- [ ] **15.14** "Move to Resolved" button now shown — click it — success, `resolvedAt` appears in Descriptions
- [ ] **15.15** No further move button shown (RESOLVED has no manual next per cron-only rule)
- [ ] **15.16** Click "Back to List" — list view, ticket shows RESOLVED in status column
- [ ] **15.17** Stop the backend container: `docker compose stop backend` — click "View" on a ticket — error Alert appears, no crash
- [ ] **15.18** Restart backend: `docker compose start backend` — refresh page — list reloads correctly

---

### Stage 16 — Final Checks

- [ ] **16.1** Run `npm test` from project root — all unit tests pass (runs locally, not in Docker)
- [ ] **16.2** Run `npm run build` from project root — TypeScript compiles with no errors
- [ ] **16.3** `cd frontend && npm run build` — Vite builds with no TypeScript errors
- [ ] **16.4** Confirm all 3 containers start cleanly from scratch: `docker compose down -v && docker compose up --build -d` — no errors, DB volume recreated
- [ ] **16.5** Re-run migration after fresh start: `docker compose exec backend npx mikro-orm migration:up` — confirms migration is idempotent-safe (no error on first run)
- [ ] **16.6** Confirm `.env` is in `.gitignore` and not staged: `git status` should not show `.env`
- [ ] **16.7** Confirm `.env.example`, `Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, `.dockerignore` are all tracked by git
- [ ] **16.8** Confirm `migrations/` folder is tracked (contains the initial migration file)
- [ ] **16.9** README.md covers: prerequisites (Docker Desktop), `docker compose up --build -d`, migration command, how to access backend (port 3000) and frontend (port 5173), env var list
