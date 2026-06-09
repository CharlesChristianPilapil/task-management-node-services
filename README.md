# Task Management Node Services

Supplementary **Express.js / TypeScript** backend for the Task Management & Analytics Platform. This service handles real-time notifications, analytics processing, data exports, and scheduled background jobs. It communicates with the primary [Laravel API](https://github.com/your-username/task-management-laravel-api) over HTTP.

---

## Table of Contents

- [Live URLs](#live-urls)
- [Production note (Render)](#production-note-render)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start (Local)](#quick-start-local)
- [Environment Variables](#environment-variables)
- [Authentication](#authentication)
- [API Reference](#api-reference)
- [Scheduled Jobs (Cron)](#scheduled-jobs-cron)
- [Inter-Service Communication](#inter-service-communication)
- [Caching](#caching)
- [Response Format](#response-format)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Live URLs

| Service | URL |
|---------|-----|
| **React Frontend** | [https://task-management-react-exam-1gnmeomqi.vercel.app](https://task-management-react-exam-1gnmeomqi.vercel.app) |
| **Node.js Services (this repo)** | [https://task-management-node-services-g5ie.onrender.com](https://task-management-node-services-g5ie.onrender.com) |
| **Laravel API** | [https://task-management-laravel-api-u2v9.onrender.com/api](https://task-management-laravel-api-u2v9.onrender.com/api) |
| **Health check** | [GET /health](https://task-management-node-services-g5ie.onrender.com/health) |

---

## Production note (Render)

> **Important:** Email delivery and scheduled cron jobs are **fully implemented and configured** in this service. On **Render’s free tier**, the platform **blocks outbound SMTP** and **does not support reliable in-process cron** — so emails and scheduled jobs do not run in production even with correct `EMAIL_*` and `CRON_*` env vars.

| Feature | Render free tier | Local dev |
|---------|------------------|-----------|
| SMTP / Nodemailer (Gmail) | Configured (`EMAIL_USER`, `EMAIL_PASS`); **Render blocks outbound SMTP** on free tier | Sends via Gmail app password |
| In-process cron (`node-cron`) | Configured (`CRON_ENABLED=true`); **free tier spins down** and has no background worker | Runs on schedule |
| External cron (`POST /api/cron/*`) | Works if wired via [cron-job.org](https://cron-job.org) or similar | Optional fallback |

**What still works on Render free tier**

- REST API (analytics, export, health check)
- Notification endpoint accepts requests from Laravel (`202 Accepted`)
- JWT authentication and Laravel API integration

**What Render free tier prevents**

- Actual email delivery (task assign, status change, digest, reminders)
- Reliable in-process cron (daily digest, deadline reminders, task cleanup)

This is a **platform limitation**, not missing application code. Test the full notification and cron flow locally. For production delivery, use a **paid Render plan**, **external cron triggers**, and/or a **transactional email API** (SendGrid, Resend, Mailgun, etc.).

---

## Features

- Express 5 with TypeScript (strict mode)
- JWT validation middleware (tokens issued by Laravel)
- Role-based authorization (Admin & Manager for analytics/export)
- Internal service key authentication for Laravel → Node calls
- Async notification queue with Nodemailer email delivery
- Rate limiting on notification endpoint
- Analytics with 1-hour in-memory cache
- Streaming file export (CSV via fast-csv, Excel via xlsx)
- node-cron scheduled jobs with graceful SIGTERM shutdown
- Retry logic and structured JSON logging

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Laravel API | Running on port 8000 |
| Gmail account | App password for email delivery |

Both services must share the same `JWT_SECRET` and `INTERNAL_SERVICE_KEY`.

---

## Quick Start (Local)

### 1. Clone and install

```bash
git clone https://github.com/your-username/task-management-node-services.git
cd task-management-node-services
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

1. Set `JWT_SECRET` and `INTERNAL_SERVICE_KEY` to **match the Laravel `.env`**
2. Set `LARAVEL_API_URL=http://localhost:8000/api`
3. Configure `EMAIL_USER` and `EMAIL_PASS` (Gmail app password)

Generate a shared internal key (example):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the same value for `INTERNAL_SERVICE_KEY` in both Laravel and Node `.env` files.

### 3. Start Laravel API first

From the Laravel repository:

```bash
php artisan serve
php artisan migrate --seed
```

### 4. Start Node.js (development)

```bash
npm run dev
```

Server starts at **http://localhost:3000** with hot reload via `tsx`.

### 5. Production build

```bash
npm run build
npm start
```

### 6. Verify

```bash
# Health check
curl http://localhost:3000/health

# Analytics (requires JWT from Laravel login)
curl http://localhost:3000/api/analytics/task-summary?team_id=1 \
  -H "Authorization: Bearer <access_token>"
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `3000` | HTTP port |
| `HOST` | No | `0.0.0.0` | Bind address |
| `APP_URL` | Yes | — | Public URL of this service |
| `LARAVEL_API_URL` | Yes | — | Laravel API base URL (include `/api`) |
| `JWT_SECRET` | Yes | — | Must match Laravel `JWT_SECRET` |
| `INTERNAL_SERVICE_KEY` | Yes | — | Shared secret for internal endpoints |
| `CORS_ORIGINS` | No | `*` | Comma-separated allowed origins |
| `EMAIL_USER` | Yes | — | SMTP / Gmail sender address |
| `EMAIL_PASS` | Yes | — | Gmail app password |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Global rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `30` | Max requests per window |
| `RATE_LIMIT_PER_USER_MAX` | No | `5` | Max notifications per user per hour |
| `RATE_LIMIT_PER_USER_WINDOW_MS` | No | `3600000` | Per-user notification window (ms) |
| `CRON_ENABLED` | No | `true` | Run cron jobs in-process |
| `CRON_TIMEZONE` | No | `UTC` | Cron timezone |
| `CRON_RETRY_ATTEMPTS` | No | `3` | Retry count for failed cron jobs |
| `CRON_RETRY_DELAY_MS` | No | `1000` | Delay between retries (ms) |
| `CRON_DAILY_DIGEST` | No | `0 8 * * *` | Daily digest schedule |
| `CRON_DEADLINE_REMINDER` | No | `0 */2 * * *` | Deadline reminder schedule |
| `CRON_TASK_CLEANUP` | No | `0 0 * * *` | Task cleanup schedule |

See [`.env.example`](.env.example) for inline comments and external cron setup notes.

---

## Authentication

### User-facing endpoints (JWT)

Protected routes require the same JWT issued by Laravel:

```
Authorization: Bearer <access_token>
```

The middleware validates the token signature, extracts `sub` (user ID), `role`, and `is_active`, and rejects deactivated accounts with `403`.

**Allowed roles by module:**

| Module | Roles |
|--------|-------|
| Analytics | `admin`, `manager` |
| Export | `admin`, `manager` |
| Notifications | Internal only (no JWT) |
| Cron triggers | Internal only (no JWT) |

Managers can only access analytics and exports for teams they belong to (enforced by fetching team membership from Laravel).

### Internal endpoints (Service Key)

Laravel and external cron schedulers authenticate with:

```
X-Service-Key: <INTERNAL_SERVICE_KEY>
```

---

## API Reference

Base URL: `http://localhost:3000`

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | None | Service health check |

**Response `200`**

```json
{ "status": "ok" }
```

---

### Notifications *(Internal — Laravel only)*

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/notifications/send` | Service Key | Queue async email notification |

**Request body**

```json
{
  "task_id": 1,
  "user_id": 3,
  "event_type": "assigned",
  "details": {
    "previous_status": "pending",
    "new_status": "in_progress"
  }
}
```

**`event_type` values:** `assigned`, `status_changed`

**Response `202 Accepted`**

```json
{
  "status": "ok",
  "message": "Notification queued successfully.",
  "data": {
    "task_id": 1,
    "user_id": 3,
    "event_type": "assigned"
  }
}
```

**Flow**

1. Laravel POSTs to this endpoint after task assign / status change
2. Node.js validates input and enqueues the job (returns immediately)
3. Worker fetches task + user details from Laravel internal API
4. Nodemailer sends the email
5. All sends and failures are logged; email errors do not crash the request

Rate limits: global window + per-user hourly cap (configurable via env).

---

### Analytics *(JWT — Admin & Manager)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/task-summary` | Task counts and average completion time |
| `GET` | `/api/analytics/team-productivity` | Per-user productivity metrics |
| `GET` | `/api/analytics/upcoming-deadlines` | Tasks due in next 7 days by member |

**Common query params**

| Param | Required | Description |
|-------|----------|-------------|
| `team_id` | Yes | Team to analyze |
| `date_from` | No | ISO date filter (inclusive) |
| `date_to` | No | ISO date filter (inclusive) |

**Example: task summary**

```http
GET /api/analytics/task-summary?team_id=1&date_from=2026-01-01&date_to=2026-06-30
Authorization: Bearer <token>
```

**Response `200`**

```json
{
  "status": "ok",
  "message": "Task summary retrieved successfully.",
  "data": {
    "total_tasks": 24,
    "completed_tasks": 10,
    "pending_tasks": 14,
    "avg_completion_time": 48.5
  }
}
```

`avg_completion_time` is in hours. Results are cached for **1 hour** per team/date-range combination.

**Example: team productivity**

```json
{
  "data": {
    "team_id": 1,
    "team_name": "Engineering",
    "members": [
      {
        "user_id": 3,
        "name": "Team Member",
        "total_tasks": 5,
        "completed_tasks": 2,
        "completion_rate": 40,
        "avg_completion_time_hours": 36.2
      }
    ]
  }
}
```

**Example: upcoming deadlines**

```json
{
  "data": {
    "team_id": 1,
    "days_ahead": 7,
    "members": [
      {
        "user_id": 3,
        "name": "Team Member",
        "tasks": [
          {
            "id": 1,
            "title": "Setup database",
            "due_date": "2026-06-11T00:00:00.000Z",
            "priority": "high",
            "status": "in_progress"
          }
        ]
      }
    ]
  }
}
```

---

### Export *(JWT — Admin & Manager)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/export/tasks` | Download filtered task export |

**Request body**

```json
{
  "team_id": 1,
  "format": "csv",
  "filters": {
    "status": "completed",
    "date_from": "2026-01-01",
    "date_to": "2026-06-30"
  }
}
```

**`format` values:** `csv`, `json`, `xlsx`

**Response:** File stream with headers:

```
Content-Type: text/csv | application/json | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="tasks-export-....csv"
X-Export-Task-Count: 42
```

Exports are generated on-the-fly and streamed (no persistent storage). All exports are logged for audit.

---

### Cron triggers *(Internal — Service Key)*

Use when `CRON_ENABLED=false` (e.g. Render free tier with external scheduler):

| Method | Endpoint | Schedule | Description |
|--------|----------|----------|-------------|
| `POST` | `/api/cron/daily-digest` | `0 8 * * *` | Morning email with incomplete tasks |
| `POST` | `/api/cron/deadline-reminder` | `0 */2 * * *` | Remind assignees of tasks due in 24h |
| `POST` | `/api/cron/task-cleanup` | `0 0 * * *` | Archive cancelled tasks older than 30 days |

**Example (external cron via cron-job.org)**

```http
POST https://task-management-node-services-g5ie.onrender.com/api/cron/daily-digest
X-Service-Key: your-internal-service-key
```

**Response `200`**

```json
{
  "status": "ok",
  "message": "daily_digest completed successfully.",
  "data": { "job": "daily_digest" }
}
```

---

## Scheduled Jobs (Cron)

When `CRON_ENABLED=true` (default for local dev), jobs run in-process via **node-cron**:

| Job | Schedule | Action |
|-----|----------|--------|
| **Daily Digest** | 8:00 AM daily | Email each user their incomplete tasks |
| **Deadline Reminder** | Every 2 hours | Email assignees about tasks due within 24h |
| **Task Cleanup** | Midnight daily | Soft-delete cancelled tasks older than 30 days via Laravel |

### Graceful shutdown

On `SIGTERM` / `SIGINT`:

1. Cron scheduler stops accepting new jobs
2. Running jobs are awaited (15s timeout)
3. HTTP server closes
4. Process exits cleanly

This is important for zero-downtime deploys on platforms like Render.

### Retry logic

Failed cron jobs retry up to `CRON_RETRY_ATTEMPTS` times with `CRON_RETRY_DELAY_MS` between attempts. All executions are logged with duration and error details.

---

## Inter-Service Communication

Node.js calls these Laravel internal endpoints (authenticated with `X-Service-Key`):

| Laravel Endpoint | Used by |
|------------------|---------|
| `GET /api/internal/notifications/{task}/{user}` | Notification worker |
| `GET /api/internal/scheduler/daily-digest` | Daily digest job |
| `GET /api/internal/scheduler/deadline-reminders` | Deadline reminder job |
| `GET /api/internal/scheduler/stale-cancelled-tasks` | Task cleanup job |
| `DELETE /api/tasks/{id}/archive` | Task cleanup job |

User-scoped calls (analytics, export) forward the client's JWT:

| Laravel Endpoint | Used by |
|------------------|---------|
| `GET /api/teams/{id}` | Team access validation |
| `GET /api/teams/{id}/tasks` | Task data fetch (paginated) |

Laravel calls Node.js:

| Node Endpoint | Trigger |
|---------------|---------|
| `POST /api/notifications/send` | Task assigned or status changed |

---

## Caching

Analytics responses are cached in an **in-memory store** for **1 hour** (`3,600,000 ms`).

- Cache keys include team ID, date range, and endpoint
- Max 500 entries with LRU-style eviction
- Suitable for single-instance deployments; use Redis for multi-instance production

---

## Response Format

### Success

```json
{
  "status": "ok",
  "message": "Human-readable message.",
  "data": { }
}
```

### Error

```json
{
  "status": "error",
  "message": "Description of the problem.",
  "errors": { "field": ["Validation message"] }
}
```

| Code | Meaning |
|------|---------|
| `401` | Missing or invalid JWT |
| `403` | Forbidden (role or team access) |
| `404` | Route or resource not found |
| `409` | Cron job already running |
| `422` | Validation failure |
| `429` | Rate limit exceeded |
| `502` | Laravel API unreachable |

---

## Project Structure

```
task-management-node-services/
├── config/
│   ├── env.config.ts          # Environment parsing & validation
│   └── mail.config.ts         # Nodemailer transport
├── src/
│   ├── controllers/           # Request handlers
│   ├── jobs/                  # Cron job implementations
│   ├── middlewares/           # JWT, role, rate limit, error handling
│   ├── routes/                # Express route definitions
│   ├── services/              # Business logic & Laravel HTTP client
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Logger, retry, validation helpers
│   ├── app.ts                 # Express app setup
│   ├── scheduler.ts           # node-cron orchestration
│   └── server.ts              # HTTP server & graceful shutdown
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Deployment

**Recommended platform:** [Render](https://render.com) — simple Node.js web service deployment with environment variables and HTTPS.

### Why Render

- Native Node.js support with `npm run build && npm start`
- Free tier available for demos and evaluation
- Environment variable management
- Automatic HTTPS

### Deploy steps (Render)

1. Create a **Web Service** connected to this GitHub repo.
2. Configure:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
3. Set environment variables from [`.env.example`](.env.example):
   - `LARAVEL_API_URL=https://task-management-laravel-api-u2v9.onrender.com/api`
   - `JWT_SECRET`, `INTERNAL_SERVICE_KEY` (match Laravel)
   - `APP_URL=https://task-management-node-services-g5ie.onrender.com`
   - `CORS_ORIGINS=https://task-management-react-exam-1gnmeomqi.vercel.app`
   - `EMAIL_USER`, `EMAIL_PASS`, `CRON_ENABLED=true`
4. **Render free tier limits:** outbound SMTP and in-process cron are blocked by the platform even when env vars are set. For production email/cron, upgrade Render, use external cron (`POST /api/cron/*` with `X-Service-Key`), or switch to a transactional email provider. See [Production note (Render)](#production-note-render).
5. Update Laravel's `NODE_SERVICE_URL` to point to this service.
6. Confirm [Live URLs](#live-urls) match your deployed endpoints.

### Running both services locally

```bash
# Terminal 1 — Laravel
cd task-management-laravel-api
php artisan serve

# Terminal 2 — Node.js
cd task-management-node-services
npm run dev
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Missing required environment variable` | Ensure all required vars in `.env.example` are set |
| `401 Invalid authentication token` | Verify `JWT_SECRET` matches Laravel exactly |
| `403 Forbidden` on analytics | User must be admin/manager and belong to the requested team |
| Emails not sending (local) | Use a Gmail **app password**, not your account password |
| Emails not sending (Render) | Expected on Render **free tier** — platform blocks outbound SMTP; config is correct — see [Production note (Render)](#production-note-render) |
| `502` from Laravel calls | Confirm Laravel is running and `LARAVEL_API_URL` includes `/api` |
| Cron jobs not running (Render) | Expected on Render **free tier** — no reliable background worker; use external cron or a paid plan — see [Production note (Render)](#production-note-render) |
| Notifications return `429` | Rate limit hit; adjust `RATE_LIMIT_*` env vars or wait |

Logs are structured JSON written to stdout (viewable in platform log streams).

---

## Test Credentials

Use credentials from the Laravel seeder to obtain a JWT:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@test.com` | `password123` |
| Manager | `manager@test.com` | `password123` |
| Team Member | `member@test.com` | `password123` |

Team members receive `403` on analytics and export endpoints.

---

## License

ISC
