# FlowDesk Server

Express + WebSocket mock stream server, with Postgres connection scaffolding.

## 1) Start Postgres

Make sure Postgres is running locally on `127.0.0.1:5432`.

## 2) Create DB user + database

From a terminal, connect as a superuser (usually `postgres`):

```bash
# homebrew on mac
psql -h 127.0.0.1 -U postgres 
```

Then run:

```sql
CREATE ROLE flowdesk_app WITH LOGIN PASSWORD 'change_me';
CREATE DATABASE flowdesk OWNER flowdesk_app;

REVOKE ALL ON DATABASE flowdesk FROM PUBLIC;
GRANT CONNECT ON DATABASE flowdesk TO flowdesk_app;
```

Reconnect to the new DB and grant schema permissions:

```bash
psql -h 127.0.0.1 -U postgres -d flowdesk
```

```sql
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO flowdesk_app;
```

## 3) Run migrations

Run from the `server` folder:

```bash
cd server
npm run db:migrate
```

## 4) Configure app connection

Set env vars before starting the server:

```bash
cp ../.env.example ../.env
# then set at least:
# DATABASE_URL=postgres://flowdesk_app:change_me@127.0.0.1:5432/flowdesk
```

Migration SQL files live in `src/db/migrations/` (first one: `001_init.sql`).

## 5) Run server

```bash
cd server
npm install
npm run dev
```

Optional: run on a non-default port (then point Vite’s `server.proxy` at the same port):

```bash
PORT=3001 npm run dev
```

## Quick checks

```bash
curl http://localhost:8000/health
# or if you set PORT=3001:
curl http://localhost:3001/health
```

