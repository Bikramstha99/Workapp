# SplitWork

An Angular 18 + Express app for splitting money and tracking work schedules.

## Stack

- **Frontend**: Angular 18, served on port 5000 (dev server)
- **Backend**: Node.js + Express, served on port 8000
- **Database**: Replit's built-in PostgreSQL (5 tables: people, splitgroups, splitparticipants, splitpayers, workschedules)

## How to run

Two workflows must be running simultaneously:

| Workflow | Command | Port |
|---|---|---|
| Backend API | `PORT=8000 node backend/server.js` | 8000 |
| Start application | `cd frontend && npx ng serve --host 0.0.0.0 --disable-host-check --port 5000` | 5000 |

The Angular dev server proxies `/api` requests to the Express backend on port 8000 via `frontend/proxy.conf.json`.

## Project layout

```
backend/
  server.js          # Express app entry point
  config/db.js       # PostgreSQL pool (uses DATABASE_URL env var)
  controllers/       # Business logic for people, split-money, work-schedule
  routes/            # Express routers
frontend/
  src/
    app/             # Angular components, services, models
    environments/    # environment.ts — apiUrl set to /api (relative)
  proxy.conf.json    # Dev proxy: /api → http://localhost:8000
database/
  schema.sql         # Original SQL Server schema (reference only; see PostgreSQL tables)
```

## Database

Replit provides `DATABASE_URL` automatically — no secrets to configure. The schema was applied at setup time. Tables: `people`, `splitgroups`, `splitparticipants`, `splitpayers`, `workschedules`.

## User preferences

- Keep the existing Angular + Express project structure
- Database: Replit's built-in PostgreSQL (migrated from SQL Server)
