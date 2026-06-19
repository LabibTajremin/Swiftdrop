# Swiftdrop

Swiftdrop is a last-mile delivery tracking backend API. It covers the full parcel lifecycle — registration, agent assignment, pickup, delivery, and failure recovery — with every status change recorded in an immutable event log. The event log is the single source of truth: status transitions always go through the same validated state machine regardless of which endpoint triggers them.

The API is designed for integration by internal tooling such as dispatch dashboards and driver apps. All endpoints are protected by a shared API key.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 (Fastify adapter) |
| ORM | Drizzle ORM 0.36 |
| Database | PostgreSQL 14+ |
| Validation | Zod |
| Language | TypeScript 5 (strict mode) |
| Package manager | pnpm 11 |
| Testing | Jest + ts-jest |

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 11 — `npm install -g pnpm`
- **PostgreSQL** 14+ (local install or Docker)

---

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
DATABASE_URL=postgresql://admin:12345@localhost:5432/swiftdrop
API_KEY=localdev123
PORT=3000
```

> If you use the Docker setup below, these exact values work with no changes.

### 3. Start PostgreSQL with Docker

> **Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) must be installed and running.

```bash
# Start the PostgreSQL container in the background
docker compose up -d postgres
```

This starts a PostgreSQL 16 container with:

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `swiftdrop` |
| Username | `admin` |
| Password | `12345` |

**Verify the container is running:**

```bash
docker compose ps
```

You should see `postgres` with status `running`.

**View database logs (useful for troubleshooting):**

```bash
docker compose logs postgres
```

### 4. Run migrations

```bash
pnpm drizzle-kit migrate
```

This creates the `agents`, `parcels`, and `delivery_events` tables in the database. Migration files live in `src/db/migrations/`.

### 5. Start the development server

```bash
pnpm start:dev
```

The API is available at `http://localhost:3000`.

> The server auto-restarts on file changes in development mode.

---

## Stopping and Resetting

**Stop the database container (data is preserved):**

```bash
docker compose down
```

**Wipe the database completely and start fresh (destroys all data):**

```bash
docker compose down -v
docker compose up -d postgres
pnpm drizzle-kit migrate
```

> Use `down -v` when you want a clean slate — for example if you changed the DB credentials or hit a migration conflict.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `API_KEY` | Yes | — | Shared secret; must be sent in every request as `x-api-key: <value>` |
| `PORT` | No | `3000` | Port the HTTP server listens on |
| `DB_POOL_MAX` | No | `10` | Max DB connections in the pool |
| `DB_POOL_MIN` | No | `2` | Min idle DB connections kept open |
| `DB_IDLE_TIMEOUT_MS` | No | `30000` | Close idle connections after N ms |
| `DB_CONN_TIMEOUT_MS` | No | `3000` | Error if no free connection available after N ms |

---

## Migrations

```bash
# Reflect schema changes into a new SQL migration file
pnpm drizzle-kit generate

# Apply all pending migrations to the database
pnpm drizzle-kit migrate
```

Migration files live in `src/db/migrations/`.

---

## Running Tests

```bash
# Full suite
pnpm test

# Specific file (pnpm 11 mangles -- args; use jest directly)
./node_modules/.bin/jest --testPathPattern=parcels.service --verbose

# Coverage report
pnpm test:cov
```

---

## API Endpoints

Every endpoint requires the header:

```
x-api-key: <your API_KEY value>
```

### Parcels

| Method | Path | Description |
|---|---|---|
| `POST` | `/parcels` | Register a new parcel — returns 201 with the created parcel |
| `GET` | `/parcels` | List parcels; optional query params: `status`, `agent_id`, `sender_name`, `page`, `limit` |
| `PATCH` | `/parcels/:id/status` | Advance a parcel to a new status (validated by the state machine) |
| `GET` | `/parcels/:id/history` | Full delivery event history for a parcel |
| `GET` | `/parcels/:id/events` | Chronological event timeline for a parcel |
| `POST` | `/parcels/:id/retry` | Retry a `failed` parcel — transitions it back to `picked_up` and logs a `requeued` event |

### Agents

| Method | Path | Description |
|---|---|---|
| `POST` | `/agents` | Create a delivery agent — returns 201 |
| `PATCH` | `/agents/:id/availability` | Set agent availability to `true` or `false` |
| `POST` | `/agents/:id/assign` | Assign a `registered` parcel to an available agent |
| `GET` | `/agents/:id/deliveries` | List active (non-terminal) deliveries for an agent |

### Delivery Events

| Method | Path | Description |
|---|---|---|
| `POST` | `/delivery-events` | Log a delivery event; status-changing event types (`picked_up`, `out_for_delivery`, `delivered`, `failed_attempt`) automatically advance the parcel through the state machine |

### Reporting

| Method | Path | Description |
|---|---|---|
| `GET` | `/reports/agents/:id` | Per-agent summary: `total_deliveries`, `success_rate`, `avg_pickup_to_delivery_ms` |

---

## Parcel Status Machine

```
registered ──→ picked_up ──→ out_for_delivery ──→ delivered
     │               │                │
     └──→ failed ←───┘                └──→ failed
               │
               └──→ picked_up  (via retry)
```

---