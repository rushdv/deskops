# DeskOps Operations Runbook

**Document Identifier:** `DESKOPS-OPS-P1-v1.0`  
**Phase:** Phase 1: Ticketing Core  
**Target Release:** `v1.0.0`  
**Primary Deliverable Reference:** Deliverable **D-1.8** (`LV-WD-DESKOPS-P1`)

---

## 1. System Topology & Architecture Overview

DeskOps is an enterprise multi-tenant service desk platform for facilities management.

```text
┌─────────────────┐       HTTPS / WSS        ┌────────────────────────────────┐
│   React Client  │ ───────────────────────► │       Express API Server       │
│  (Vite + React) │                          │     (Node.js 22 + TypeScript)   │
└─────────────────┘                          └───────┬────────────┬───────────┘
                                                     │            │
                                     SQL (Prisma)    │            │ Redis TCP
                                                     ▼            ▼
                                             ┌────────────┐ ┌─────────────┐
                                             │ PostgreSQL │ │    Redis    │
                                             │    (v16)   │ │  (BullMQ)   │
                                             └────────────┘ └─────────────┘
```

---

## 2. Local Execution & Docker Orchestration

### 2.1 Starting Containers Locally
```bash
# Build and launch PostgreSQL, Server, and Client containers
docker compose up -d --build

# Inspect container health
docker compose ps

# View live aggregate logs
docker compose logs -f
```

### 2.2 Tearing Down Containers
```bash
# Stop containers
docker compose down

# Stop and wipe persistent PostgreSQL volume (clean reset)
docker compose down -v
```

---

## 3. Database Operations & Migration Management

### 3.1 Applying Migrations in Development
> **Rule:** Never modify the database schema directly inside PostgreSQL. Always modify `prisma/schema.prisma`.

```bash
cd server

# Create and apply a new migration
npm run prisma:migrate -- --name <descriptive_migration_name>

# Regenerate Prisma Client
npm run prisma:generate
```

### 3.2 Production Migration Deployment
In CI/CD and production environments (Render):
```bash
# Apply pending production migrations non-interactively
npx prisma migrate deploy
```

### 3.3 Database Migration Rollback Procedure
If a migration introduces a breaking schema bug:
1. Revert the migration commit in Git (`git revert <commit_hash>`).
2. Generate a compensating forward migration:
   ```bash
   npm run prisma:migrate -- --name revert_<feature_name>
   ```
3. Test locally with `npm test` before pushing to `main`.

### 3.4 Seed Data Restoration
To restore standard demonstration accounts (`admin@greenfield.com`, `tech@greenfield.com`, `resident@greenfield.com` with `Password123!`):
```bash
cd server
npm run seed
```

---

## 4. Secret & Credential Rotation Procedures

### 4.1 JWT Access & Refresh Secret Rotation
If an access or refresh secret is compromised:
1. Generate new cryptographically secure 256-bit secrets:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Update the environment variables in your deployment dashboard (Render) or local `.env`:
   - `JWT_ACCESS_SECRET=<new_secret>`
   - `JWT_REFRESH_SECRET=<new_secret>`
3. Perform a zero-downtime rolling restart of the server instances.
4. **Impact:** Existing active user sessions will be invalidated upon access token expiration (15 minutes); users will need to re-authenticate with their credentials.

### 4.2 S3 / Cloudflare R2 Storage Key Rotation
1. Generate new API credentials in Cloudflare R2 / AWS IAM console.
2. Update `S3_ACCESS_KEY` and `S3_SECRET_KEY` in environment variables.
3. Restart server instances.

---

## 5. BullMQ & Dead-Letter Queue (DLQ) Recovery

### 5.1 DLQ Overview
All background jobs (`thumbnailQueue`, `emailQueue`) are configured with:
- `attempts: 3` (exponential backoff starting at 1000ms).
- `removeOnFail: { count: 1000 }` to guarantee failed jobs are preserved in Redis for inspection rather than discarded.

### 5.2 Replaying Failed DLQ Jobs
To programmatically inspect and retry failed jobs via the BullMQ CLI / Node script:
```typescript
import { thumbnailQueue } from './src/lib/queues.js';

// Get count of failed jobs in DLQ
const failedCount = await thumbnailQueue.getFailedCount();
console.log(`Failed jobs in DLQ: ${failedCount}`);

// Retrieve and retry all failed jobs
const failedJobs = await thumbnailQueue.getFailed(0, 100);
for (const job of failedJobs) {
  console.log(`Retrying failed job ${job.id}: ${job.failedReason}`);
  await job.retry();
}
```

---

## 6. Incident Triage & Troubleshooting Guide

| Symptom | Probable Cause | Immediate Remediation |
| :--- | :--- | :--- |
| **`TENANT_UNRESOLVED` (401)** | Missing JWT or JWT token does not contain `organisationId`. | Verify user is logging in through `/api/v1/auth/login`. Verify token header is formatted as `Bearer <token>`. |
| **`ERR_ILLEGAL_STATE_TRANSITION` (422)** | Attempted invalid lifecycle transition or parallel race condition. | Check `TicketStateMachine.validateTransition` rules. In 20-parallel assignment bursts, exactly 1 succeeds and 19 return this error by design. |
| **`ECONNREFUSED 6379`** | Redis daemon is offline. | Start local Redis or verify `REDIS_URL` connection string in `.env`. Server gracefully degrades without crashing. |
| **`P1001: Can't reach database`** | PostgreSQL is stopped or unreachable. | Verify PostgreSQL container is healthy (`docker compose ps`). Check `DATABASE_URL` port (5432). |
| **WebSocket Connection Fails** | Socket.io handshake failed authentication. | Ensure client passes verified JWT token in `auth: { token: ... }` during Socket.io connection bootstrap. |
