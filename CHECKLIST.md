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

- [x] **5.1** Create `src/tickets/tickets.scheduler.ts` with `@Injectable()`
- [x] **5.2** Inject `TicketsService` and `ConfigService`
- [x] **5.3** Add `private readonly logger = new Logger(TicketsScheduler.name)`
- [x] **5.4** Implement `handleAutoClose()` with `@Cron('0 2 * * *')`:
  - [x] Read `AUTO_CLOSE_DAYS` from config with `configService.get<number>('AUTO_CLOSE_DAYS', 3)`
  - [x] Wrap in `Number()` to ensure numeric type
  - [x] Log start with threshold: `Auto-close cron started. Threshold: X days`
  - [x] Call `ticketsService.autoCloseResolved(days)`
  - [x] Log result: `Auto-close cron completed. Tickets closed: N`

---

### Stage 6 — Backend: Controller

- [x] **6.1** Create `src/tickets/tickets.controller.ts` with `@Controller('tickets')`
- [x] **6.2** Implement `POST /tickets`:
  - [x] `@Post()`, `@HttpCode(HttpStatus.CREATED)`
  - [x] `@Body() dto: CreateTicketDto` — calls `ticketsService.create(dto)`
- [x] **6.3** Implement `GET /tickets`:
  - [x] `@Get()`, `@Query() query: ListTicketsDto` — calls `ticketsService.findAll(query)`
- [x] **6.4** Implement `GET /tickets/:id`:
  - [x] `@Get(':id')`, `@Param('id', ParseUUIDPipe) id: string` — calls `ticketsService.findOne(id)`
  - [x] `ParseUUIDPipe` returns 400 automatically if id is not valid UUID format
- [x] **6.5** Implement `PUT /tickets/:id/status`:
  - [x] `@Put(':id/status')`, `@Param('id', ParseUUIDPipe)`, `@Body() dto: UpdateTicketStatusDto`
  - [x] Calls `ticketsService.updateStatus(id, dto)`

---

### Stage 7 — Backend: Module & App Wiring

- [x] **7.1** Create `src/tickets/tickets.module.ts`:
  - [x] `MikroOrmModule.forFeature([Ticket])` in imports
  - [x] `TicketsController` in controllers
  - [x] `TicketsService` and `TicketsScheduler` in providers
- [x] **7.2** Replace `src/app.module.ts`:
  - [x] `ConfigModule.forRoot({ isGlobal: true })` — first import
  - [x] `MikroOrmModule.forRootAsync` — useFactory reads DB config from `ConfigService`
  - [x] Set `autoLoadEntities: true` in MikroORM options
  - [x] `ScheduleModule.forRoot()`
  - [x] `TicketsModule`
  - [x] Remove `AppController` and `AppService` from module
- [x] **7.3** Update `src/main.ts`:
  - [x] Add `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`
  - [x] Add `app.enableCors({ origin: 'http://localhost:5173' })`
- [x] **7.4** Delete unused `src/app.controller.ts`, `src/app.service.ts`, `src/app.controller.spec.ts`

---

### Stage 8 — Backend: Unit Tests

- [x] **8.1** Create `src/tickets/tickets.service.spec.ts`
- [x] **8.2** Mock `EntityRepository<Ticket>` with jest functions: `create`, `find`, `findOne`, `findAll`
- [x] **8.3** Mock `EntityManager` with jest function: `persistAndFlush`, `flush`
- [x] **8.4** Write and pass test: `create()` returns ticket with `status=OPEN` and `priority=MEDIUM`
- [x] **8.5** Write and pass test: `updateStatus()` OPEN→IN_PROGRESS succeeds, returns ticket with new status
- [x] **8.6** Write and pass test: `updateStatus()` OPEN→RESOLVED throws `BadRequestException`
- [x] **8.7** Write and pass test: `updateStatus()` IN_PROGRESS→CLOSED throws `BadRequestException` with "scheduler" in message
- [x] **8.8** Write and pass test: `updateStatus()` IN_PROGRESS→RESOLVED sets `resolvedAt` to a Date
- [x] **8.9** Write and pass test: `autoCloseResolved(3)` — given ticket with `resolvedAt` 4 days ago → sets status CLOSED, returns 1
- [x] **8.10** Write and pass test: `autoCloseResolved(3)` — given ticket with `resolvedAt` 2 days ago → does not close, returns 0
- [x] **8.11** Run `npm test` — all tests pass with no errors

---

### Stage 9 — Backend: Smoke Test

- [x] **9.1** Ensure all containers are running: `docker compose ps` — `db`, `backend`, `frontend` all show status `Up`; check backend logs for no errors: `docker compose logs backend`
- [x] **9.2** `POST http://localhost:3000/tickets` with valid body → `201` response, UUID `id` present
- [x] **9.3** `POST http://localhost:3000/tickets` with missing `title` → `400` with validation message
- [x] **9.4** `POST http://localhost:3000/tickets` with invalid email → `400` with validation message
- [x] **9.5** `GET http://localhost:3000/tickets` → `200` array (contains ticket from 9.2)
- [x] **9.6** `GET http://localhost:3000/tickets?status=OPEN` → `200` array containing only OPEN tickets
- [x] **9.7** `GET http://localhost:3000/tickets?q=<part-of-title>` → `200` filtered array
- [x] **9.8** `GET http://localhost:3000/tickets/<uuid-from-9.2>` → `200` single ticket object
- [x] **9.9** `GET http://localhost:3000/tickets/not-a-uuid` → `400` (ParseUUIDPipe rejection)
- [x] **9.10** `GET http://localhost:3000/tickets/00000000-0000-0000-0000-000000000000` → `404` with "not found" message
- [x] **9.11** `PUT http://localhost:3000/tickets/<id>/status` body `{"status":"RESOLVED"}` on OPEN ticket → `400` (skip not allowed)
- [x] **9.12** `PUT http://localhost:3000/tickets/<id>/status` body `{"status":"CLOSED"}` → `400` (cron-only message)
- [x] **9.13** `PUT http://localhost:3000/tickets/<id>/status` body `{"status":"IN_PROGRESS"}` → `200`, status updated
- [x] **9.14** `PUT http://localhost:3000/tickets/<id>/status` body `{"status":"RESOLVED"}` on IN_PROGRESS ticket → `200`, `resolvedAt` is now set

---

### Stage 10 — Frontend: Scaffold & Config

- [x] **10.1** From project root: `npm create vite@latest frontend -- --template react-ts`
- [x] **10.2** Install locally for IDE support: `cd frontend && npm install zustand antd axios`
- [x] **10.3** Create `frontend/.env` with `VITE_API_URL=http://localhost:3000` (browser-facing URL, not Docker internal)
- [x] **10.4** Confirm `frontend/src/main.tsx` and `frontend/src/App.tsx` exist from scaffold

---

### Stage 11 — Frontend: Types & API Layer

- [x] **11.1** Create `frontend/src/types/ticket.types.ts`:
  - [x] `TicketStatus` type union: `'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'`
  - [x] `TicketPriority` type union: `'LOW' | 'MEDIUM' | 'HIGH'`
  - [x] `Ticket` interface with all 9 fields (id, title, customerName, customerEmail, description, status, priority, createdAt, resolvedAt?, updatedAt)
  - [x] `CreateTicketPayload` interface (title, customerName, customerEmail, description, priority?)
  - [x] `NEXT_STATUS` map — `RESOLVED` and `CLOSED` map to `null` (cron-only)
  - [x] `STATUS_LABELS` map — human-readable strings for each status
  - [x] `STATUS_COLORS` map — Ant Design tag colors for each status
  - [x] `PRIORITY_COLORS` map — Ant Design tag colors for LOW/MEDIUM/HIGH
- [x] **11.2** Create `frontend/src/api/tickets.ts`:
  - [x] Axios instance with `baseURL: import.meta.env.VITE_API_URL`
  - [x] `list(status?, q?)` → `GET /tickets` with params — returns `Ticket[]`
  - [x] `get(id)` → `GET /tickets/:id` — returns `Ticket`
  - [x] `create(payload)` → `POST /tickets` — returns `Ticket`
  - [x] `updateStatus(id, status)` → `PUT /tickets/:id/status` — returns `Ticket`

---

### Stage 12 — Frontend: Zustand Store

- [x] **12.1** Create `frontend/src/store/ticketStore.ts`
- [x] **12.2** State shape: `tickets`, `selectedTicket`, `loading`, `error`, `statusFilter`, `searchQuery`
- [x] **12.3** Action `fetchTickets(status?, q?)`: sets `loading=true`, calls `ticketsApi.list`, sets `tickets`, handles error into `error` string
- [x] **12.4** Action `fetchTicket(id)`: sets `loading=true`, `selectedTicket=null`, calls `ticketsApi.get`, sets `selectedTicket`, handles 404 into `error`
- [x] **12.5** Action `createTicket(payload)`: calls `ticketsApi.create`, prepends new ticket to `tickets` list, throws on error (so form can stay open)
- [x] **12.6** Action `updateStatus(id, status)`: calls `ticketsApi.updateStatus`, updates both `selectedTicket` and the matching entry in `tickets` array — no refetch needed
- [x] **12.7** Action `setFilter(status)`: sets `statusFilter`, immediately calls `fetchTickets(status, searchQuery)`
- [x] **12.8** Action `setSearch(q)`: sets `searchQuery`, immediately calls `fetchTickets(statusFilter, q)`
- [x] **12.9** Action `clearError()`: sets `error=null`

---

### Stage 13 — Frontend: Components

- [x] **13.1** Create `frontend/src/components/StatusBadge.tsx`:
  - [x] Renders `<Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>`
- [x] **13.2** Create `frontend/src/components/PriorityBadge.tsx`:
  - [x] Renders `<Tag color={PRIORITY_COLORS[priority]}>{priority}</Tag>`
- [x] **13.3** Create `frontend/src/components/TicketList.tsx`:
  - [x] On mount: call `fetchTickets()` via `useEffect([], [])`
  - [x] Ant Design `Tabs` with items: All / OPEN / IN_PROGRESS / RESOLVED / CLOSED — onChange calls `setFilter`
  - [x] Ant Design `Input.Search` above table — onSearch calls `setSearch`
  - [x] Ant Design `Table` with columns: Title, Customer Name, Email, Priority (`PriorityBadge`), Status (`StatusBadge`), Created (formatted date), Action (View button)
  - [x] Table `loading` prop bound to store `loading`
  - [x] View button calls `onSelect(record.id)` passed from parent
  - [x] `Alert` shown when `error` is non-null, closable via `clearError`
- [x] **13.4** Create `frontend/src/components/TicketForm.tsx`:
  - [x] Ant Design `Form` with `layout="vertical"`
  - [x] Fields: Customer Name (required), Email (required, email rule), Subject/Title (required), Description (required, TextArea), Priority (Select, options LOW/MEDIUM/HIGH, default MEDIUM)
  - [x] Submit calls `createTicket(values)`, on success calls `onSuccess()` prop and resets form
  - [x] `loading` prop on Submit button bound to store `loading`
  - [x] `Alert` shown when `error` is non-null, closable via `clearError`
- [x] **13.5** Create `frontend/src/components/TicketDetail.tsx`:
  - [x] On mount / when `id` prop changes: call `fetchTicket(id)` via `useEffect([id], [id])`
  - [x] Show `<Spin>` while `loading` is true and `selectedTicket` is null
  - [x] Show `<Alert>` with Back button if `error` is non-null
  - [x] Ant Design `Descriptions` (bordered): Status (StatusBadge), Priority (PriorityBadge), Customer, Email, Description, Created, Resolved (only if resolvedAt is set)
  - [x] Back button (top-right of Card) calls `onBack()` prop
  - [x] "Move to X" button: shown only if `NEXT_STATUS[ticket.status]` is non-null
  - [x] Button label: `Move to ${STATUS_LABELS[NEXT_STATUS[ticket.status]]}`
  - [x] Button click: calls `updateStatus(id, next)`, then `message.success('Ticket moved to X')`
  - [x] `Alert` shown when `error` is non-null after status update failure

---

### Stage 14 — Frontend: App Shell & Entry

- [x] **14.1** Replace `frontend/src/App.tsx`:
  - [x] `useState<View>` with discriminated union starting at `{ type: 'list' }`
  - [x] Ant Design `Layout` with `Content` centered at max-width 1100px
  - [x] Header row: "Support Tickets" title (left) + "New Ticket" button (right, hidden on create view)
  - [x] Render `<TicketList onSelect={id => setView({ type: 'detail', id })} />` when view is `list`
  - [x] Render `<TicketForm onSuccess={() => setView({ type: 'list' })} />` when view is `create`
  - [x] Render `<TicketDetail id={view.id} onBack={() => setView({ type: 'list' })} />` when view is `detail`
- [x] **14.2** Update `frontend/src/main.tsx`:
  - [x] Import `import 'antd/dist/reset.css'`
  - [x] Wrap `<App />` in `<ConfigProvider>`
- [x] **14.3** Rebuild and restart containers to pick up new frontend files: `docker compose up --build -d`
- [x] **14.4** Confirm frontend container is serving: `docker compose logs frontend` — shows `VITE ... ready` with port 5173; open `http://localhost:5173` in browser — no blank page or console errors

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

### Stage 17 — F1: Robust Search

- [x] **17.1** Update `findAll` in `tickets.service.ts` — extend `$or` to include `customerName` and `customerEmail` (in addition to existing `title`)
- [x] **17.2** `GET /tickets?q=<customerName fragment>` → 200, returns matching tickets
- [x] **17.3** `GET /tickets?q=<email fragment>` → 200, returns matching tickets
- [x] **17.4** Frontend search placeholder updated to reflect new search scope

---

### Stage 18 — F2: Table Column Sorting

- [x] **18.1** Add `sorter` prop to `TicketList.tsx` table columns: Title (alpha), Customer Name (alpha), Priority (LOW < MEDIUM < HIGH), Status (alpha), Created (date)
- [x] **18.2** Click each sortable column header — table sorts correctly ascending and descending
- [x] **18.3** Sorting is client-side only — no backend changes

---

### Stage 19 — F3: Admin Entity & Auth Backend

- [x] **19.1** Install packages: `npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt` and `npm install --save-dev @types/passport-jwt @types/bcrypt`
- [x] **19.2** Add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRES_IN=24h` to `.env` and `.env.example`
- [x] **19.3** Create `src/admin/entities/admin.entity.ts` — fields: `id` (uuid), `username` (string), `passwordHash` (string), `createdAt` (Date)
- [x] **19.4** Create migration for `admin` table: written manually as `Migration20260507000000.ts`, applied via `docker compose exec backend npx mikro-orm migration:up`
- [x] **19.5** Create `src/admin/admin.seeder.ts` — on app start, if no admin row exists: insert one row using `ADMIN_USERNAME` + bcrypt hash of `ADMIN_PASSWORD`
- [x] **19.6** Run seeder from `main.ts` after migrations: `await app.get(AdminSeeder).seed()`
- [x] **19.7** Create `src/auth/auth.module.ts` with `JwtModule.register({ secret, signOptions: { expiresIn } })`
- [x] **19.8** Create `src/auth/auth.service.ts` — `login(username, password)`: find admin by username, `bcrypt.compare`, return signed JWT with `{ sub: admin.id, username }`
- [x] **19.9** Create `src/auth/auth.controller.ts` — `POST /auth/login` body `{ username, password }` → `{ access_token }` or 401
- [x] **19.10** Create `src/auth/jwt.strategy.ts` — `PassportStrategy(Strategy)`, validates Bearer token, attaches `{ id, username }` to `req.user`
- [x] **19.11** Create `src/auth/jwt-auth.guard.ts` — `AuthGuard('jwt')` wrapper
- [x] **19.12** Apply `JwtAuthGuard` to `GET /tickets`, `GET /tickets/:id`, `PUT /tickets/:id/status` in `TicketsController`
- [x] **19.13** Keep `POST /tickets` and `POST /auth/login` public (no guard)
- [x] **19.14** `POST /auth/login` with correct credentials → 200, `access_token` present
- [x] **19.15** `POST /auth/login` with wrong password → 401
- [x] **19.16** `GET /tickets` without token → 401
- [x] **19.17** `GET /tickets` with valid `Authorization: Bearer <token>` → 200

---

### Stage 20 — F4: Public & Admin UI Split

- [x] **20.1** Extend `View` type in `App.tsx` to: `'public' | 'admin-login' | 'list' | 'detail'`
- [x] **20.2** App starts at `{ type: 'public' }` by default (check localStorage for existing JWT on load)
- [x] **20.3** Create `src/components/PublicSubmit.tsx` — ticket submit form, "Admin Login" button top-right → sets view to `admin-login`
- [x] **20.4** Create `src/components/AdminLogin.tsx` — username + password form, calls `POST /auth/login`, stores JWT in `localStorage`, on success → `{ type: 'list' }`; "Back" button → `{ type: 'public' }`
- [x] **20.5** Add Axios request interceptor in `api/tickets.ts` — attaches `Authorization: Bearer <token>` from `localStorage` if present
- [x] **20.6** Admin header shows "Logout" button — clears `localStorage` JWT, sets view to `{ type: 'public' }`
- [x] **20.7** On 401 response, Axios response interceptor clears JWT and dispatches `unauthorized` event → App redirects to `admin-login`
- [x] **20.8** Open `http://localhost:5173` — public submit form shown, no ticket list visible
- [x] **20.9** Click "Admin Login" — login form shown
- [x] **20.10** Login with correct credentials — redirected to ticket list
- [x] **20.11** Submit a ticket from public form — 201, success message shown
- [x] **20.12** Logout — returns to public view

---

### Stage 21 — F5: Soft Delete

- [x] **21.1** Add columns to `Ticket` entity: `deletedAt` (Date, nullable), `deletedBy` (string, nullable), `modifiedBy` (string, nullable)
- [x] **21.2** Create migration for the 3 new columns
- [x] **21.3** Add `DELETE /tickets/:id` endpoint to `TicketsController` (guarded by `JwtAuthGuard`)
- [x] **21.4** Implement `softDelete(id, username)` in `TicketsService` — sets `deletedAt`, `deletedBy`, `modifiedBy`; throws 404 if already deleted
- [x] **21.5** Update `updateStatus` in `TicketsService` — sets `modifiedBy = username` (passed from controller via `req.user.username`)
- [x] **21.6** Update `findAll` — default filter adds `deletedAt: null`; accept optional `includeDeleted: boolean` param to skip filter
- [x] **21.7** Update `findOne` — throws 404 if `deletedAt` is set
- [x] **21.8** Add `includeDeleted` to `ListTicketsDto` (optional boolean)
- [x] **21.9** `DELETE /tickets/:id` with valid token → 200, ticket has `deletedAt` set
- [x] **21.10** `GET /tickets` after delete — deleted ticket no longer appears
- [x] **21.11** `GET /tickets?includeDeleted=true` — deleted ticket appears
- [x] **21.12** Add "Delete" button to `TicketDetail.tsx` (admin only) — confirms before calling delete, on success navigates back to list
- [x] **21.13** Add "Show deleted" toggle to `TicketList.tsx` — re-fetches with `includeDeleted=true`, deleted rows styled with grey/strikethrough

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
