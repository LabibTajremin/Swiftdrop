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

Edit `.env` and fill in your values (see [Environment Variables](#environment-variables) below).

### 3. Start PostgreSQL (skip if you already have one running)

```bash
docker compose up -d postgres
```

This starts a PostgreSQL 16 container on port `5432` using the credentials in `docker-compose.yml`. The default `DATABASE_URL` in `.env.example` matches those credentials — no changes needed if you use Docker.

### 4. Run migrations

```bash
pnpm drizzle-kit migrate
```

### 5. Start the development server

```bash
pnpm start:dev
```

The API is available at `http://localhost:3000` (or the `PORT` you set).

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `API_KEY` | Yes | — | Shared secret; must be sent in every request as `x-api-key: <value>` |
| `PORT` | No | `3000` | Port the HTTP server listens on |

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