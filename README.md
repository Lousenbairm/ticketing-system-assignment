# Ticketing System

A full-stack customer service ticketing system built with NestJS, PostgreSQL, and React.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Getting Started

```bash
# 1. Install dependencies
npm install
cd frontend && npm install && cd ..

# 2. Set up environment
cp .env.example .env

# 3. Start all services (db, backend, frontend)
docker compose up --build -d

# 4. Run database migrations
docker compose exec backend npx mikro-orm migration:up
```

## Access

| Service  | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:3000 |

## Environment Variables

| Variable            | Default     | Description              |
|---------------------|-------------|--------------------------|
| `DATABASE_HOST`     | `localhost` | Postgres host            |
| `DATABASE_PORT`     | `5432`      | Postgres port            |
| `DATABASE_NAME`     | `ticketing` | Database name            |
| `DATABASE_USER`     | `postgres`  | Database user            |
| `DATABASE_PASSWORD` |             | Database password        |
| `AUTO_CLOSE_DAYS`   | `3`         | Days until auto-close    |
| `PORT`              | `3000`      | Backend port             |
| `VITE_API_URL`      | `http://localhost:3000` | Frontend API base URL |

## Common Commands

```bash
# View logs
docker compose logs backend
docker compose logs frontend

# Run unit tests (locally, not in Docker)
npm test

# Rebuild after code changes
docker compose up --build -d

# Reset everything (wipes DB volume)
docker compose down -v && docker compose up --build -d
docker compose exec backend npx mikro-orm migration:up
```
