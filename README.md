# Ticketing System

A full-stack customer service ticketing system built with NestJS, PostgreSQL, and React.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Getting Started

```bash
# 1. Set up environment
cp .env.example .env
# Fill in JWT_SECRET and ADMIN_PASSWORD in .env

# 2. Start all services (db, backend, frontend)
docker compose up --build -d

# 3. Run database migrations
docker compose exec backend npx mikro-orm migration:up
```

The default admin account is **automatically seeded** on first boot using `ADMIN_USERNAME` and `ADMIN_PASSWORD` from `.env`. No separate seed command needed.

## Access

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:5173  |
| Backend  | http://localhost:3000  |

## Environment Variables

| Variable            | Default                 | Required | Description                                      |
|---------------------|-------------------------|----------|--------------------------------------------------|
| `DATABASE_HOST`     | `localhost`             |          | Postgres host (Docker overrides this to `db`)    |
| `DATABASE_PORT`     | `5432`                  |          | Postgres port                                    |
| `DATABASE_NAME`     | `ticketing`             |          | Database name                                    |
| `DATABASE_USER`     | `postgres`              |          | Database user                                    |
| `DATABASE_PASSWORD` | `postgres`              |          | Database password                                |
| `AUTO_CLOSE_DAYS`   | `3`                     |          | Days before RESOLVED tickets are auto-closed     |
| `PORT`              | `3000`                  |          | Backend port                                     |
| `VITE_API_URL`      | `http://localhost:3000` |          | Frontend API base URL (browser-facing)           |
| `JWT_SECRET`        |                         | **Yes**  | Secret key for signing JWT tokens                |
| `JWT_EXPIRES_IN`    | `24h`                   |          | JWT token lifetime                               |
| `ADMIN_USERNAME`    | `admin`                 |          | Seeded admin username                            |
| `ADMIN_PASSWORD`    |                         | **Yes**  | Seeded admin password (stored as bcrypt hash)    |

## API Endpoints

| Method   | Route                 | Auth   | Description           |
|----------|-----------------------|--------|-----------------------|
| `POST`   | `/auth/login`         | Public | Login, returns JWT    |
| `POST`   | `/tickets`            | Public | Submit a new ticket   |
| `GET`    | `/tickets`            | Admin  | List tickets          |
| `GET`    | `/tickets/:id`        | Admin  | Get ticket details    |
| `PUT`    | `/tickets/:id/status` | Admin  | Advance ticket status |
| `DELETE` | `/tickets/:id`        | Admin  | Soft delete a ticket  |

## Status Transitions

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED (cron only, runs daily at 02:00 AM)
```

- Steps cannot be skipped — `OPEN → RESOLVED` returns 400
- `CLOSED` cannot be set via API — applied automatically by the scheduler
- `RESOLVED` tickets older than `AUTO_CLOSE_DAYS` are auto-closed daily

## Assumptions (beyond requirements)

| Feature | Reason |
|---|---|
| JWT authentication + admin login | Protect ticket data from public access |
| Public vs admin UI split | Customers submit tickets; admins manage them |
| Soft delete | Preserve audit trail instead of permanently deleting records |
| Docker setup | Reproducible environment, no local PostgreSQL required |
| Search extended to name + email | More useful than title-only search |

## Common Commands

```bash
# View logs
docker compose logs backend
docker compose logs frontend

# Run unit tests (locally, not in Docker)
npm test

# Restart backend to pick up .env changes
docker compose up -d backend

# Rebuild after adding npm packages
docker compose up --build --force-recreate -V backend -d

# Reset everything (wipes DB)
docker compose down -v && docker compose up --build -d
docker compose exec backend npx mikro-orm migration:up
```

## Tech Stack

| Layer     | Technology                                          |
|-----------|-----------------------------------------------------|
| Backend   | NestJS 11 + TypeScript + MikroORM                   |
| Database  | PostgreSQL 16                                       |
| Auth      | JWT + Passport + bcrypt                             |
| Scheduler | `@nestjs/schedule` (cron)                           |
| Frontend  | React + Vite + Ant Design + Zustand + Axios         |
| Runtime   | Docker Compose (3 services)                         |
