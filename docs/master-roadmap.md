# DeskOps Phase 1: Master Task Allocation & Execution Plan
**Document Identifier:** `LV-WD-DESKOPS-P1 v1.0`  
**Team 6:** Md. Shihab Shahriar (Developer A) & Faizul (Developer B)  
**Target Release:** `v1.0.0` (Production Ticketing Core)  
**Repository:** [https://github.com/rushdv/deskops](https://github.com/rushdv/deskops)

---

## 1. Project Overview & Control Details

| Attribute | Project Control Details |
| :--- | :--- |
| **Project & Phase** | DeskOps — Phase 1: Ticketing Core (`v1.0.0`) |
| **Client Model** | Greenfield Facilities (6 properties, ~2,000 units, 60 technicians) |
| **Team Structure** | **Developer A (Lead/Arch):** Md. Shihab Shahriar<br>**Developer B (Feature/UI):** Faizul |
| **Submission Window** | **M1.5 Opens:** 02 Dec 2026 |
| **Release Deadline** | **M1.6 Final Deadline:** 07 Dec 2026, 11:59 PM IST |
| **Branching Strategy** | All features developed on `feature/*` or `feat/*`, merged to `main` via PRs with passing CI checks. |

---

## 2. Team Ownership & Boundary Matrix

Instead of a horizontal frontend/backend divide, tasks are divided **vertically by module** to prevent blockers and merge conflicts:

* **Developer A (Shihab — Core Architecture & Infra):**
  * Core system architecture, tenant isolation (`NFR-01`/`AC-1.1`), and RBAC (`NFR-02`).
  * Ticket lifecycle state machine & reopening rules (`FR-1.02`/`FR-1.03`).
  * 20-parallel assignment concurrency locking & integration tests (`NFR-03`/`AC-1.2`).
  * Change Request CR-1 duplicate ticket merge (`CR-1`/`AC-1.4`).
  * Client-specific business rule (`FR-1.08`/`AC-1.5` — Team 6 specific).
  * API standardization (`/api/v1`, Zod validation, cursor pagination, OpenAPI `/docs`).
  * Asynchronous infra: Redis, BullMQ + DLQ workers, S3/R2 presigned storage, and Socket.io bootstrap (`NFR-06`).
  * Test infrastructure (Vitest, Supertest, Playwright E2E), CI/CD, and Render deployment.

* **Developer B (Faizul — Self-Contained Feature Modules):**
  * Comments module with public/internal staff visibility (`FR-1.07`).
  * Analytics summary dashboard (`GET /api/v1/analytics/summary` + UI).
  * Attachments & thumbnail integration (`FR-1.04` — via Shihab's S3/BullMQ interface).
  * Email-to-ticket inbound webhook (`FR-1.05`).
  * Real-time UI synchronization via Socket.io (`FR-1.06`).
  * Notifications list, read/unread status, and Settings/Admin views (`NFR-06`/`NFR-09`).
  * UI/Lighthouse score optimization ($\ge 90$).

---

## 3. Phased Delivery Roadmap (22 Nov – 07 Dec 2026)

| Sprint Window | Developer A (Shihab) Focus | Developer B (Faizul) Focus | Sprint Status |
| :--- | :--- | :--- | :--- |
| **22 – 24 Nov** | • Concurrency locking in `ticket.service.ts`<br>• 20-parallel assignment test (`AC-1.2`)<br>• Vitest & Supertest test suite setup<br>• State machine `reopenWindowHours` hardening | • **Batch 1: Comments Module (`FR-1.07`)**<br>  - `GET` & `POST` comments endpoints<br>  - `PUBLIC` vs `INTERNAL` filtering<br>  - Audit event `COMMENT_ADDED`<br>  - Ticket Details comments modal UI | 🟢 Completed<br>*(All Batch 1 Tasks Done)* |
| **25 – 27 Nov** | • Redis & BullMQ queue setup with DLQ<br>• S3/R2 presigned upload service<br>• Socket.io server auth & room management<br>• Confirm Team 6 rule (`FR-1.08`) | • **Batch 2: Analytics & Notifications**<br>  - Tenant analytics API (`/api/v1/analytics/summary`)<br>  - Dashboard metrics cards & charts<br>  - Notification list & mark-as-read UI | ⚪ Scheduled |
| **28 – 30 Nov** | • CR-1 Duplicate ticket merge (`AC-1.4`)<br>• CR-1 Impact estimate documentation<br>• Implement `FR-1.08` Client-specific rule<br>• Cross-tenant isolation tests (`AC-1.1`) | • **Batch 3: Attachments & Real-Time UI**<br>  - Attachment upload picker & previews (`FR-1.04`)<br>  - Connect thumbnail job to BullMQ<br>  - Socket.io live UI refreshes (`FR-1.06`) | ⚪ Scheduled |
| **01 – 02 Dec**<br>*(M1.5 Opens)* | • API Standardization (Zod, cursor pagination)<br>• Interactive OpenAPI / Swagger at `/docs`<br>• Pino structured logs & Sentry tracking<br>• Deploy Staging environment on Render | • **Batch 4: Email-to-Ticket & Admin Views**<br>  - Inbound email webhook parser (`FR-1.05`)<br>  - Admin DLQ inspection & Audit Log UI<br>  - Settings page & responsive Lighthouse polish | ⚪ Scheduled |
| **03 – 07 Dec**<br>*(M1.6 Release)* | • Playwright E2E test suite (resident $\rightarrow$ tech)<br>• $\ge 70\%$ service test coverage check<br>• Production deployment on Render<br>• Git tag `v1.0.0`, Runbook & Release Notes | • Joint E2E verification & defect resolution<br>• Lighthouse $\ge 90$ performance validation<br>• Individual contribution statement signoff | ⚪ Scheduled |

---

## 4. Module-by-Module Detailed Specifications

### 4.1 Comments Module (`FR-1.07`) — [Batch 1]
- **Status:** `[x] COMPLETED` (Merged into `main` via PR #7)
- **Files:**
  - `server/src/services/comment.service.ts`
  - `server/src/controllers/comment.controller.ts`
  - `server/src/routes/ticket.routes.ts`
  - `client/src/services/api.service.ts`
  - `client/src/App.tsx`
- **Key Rules:**
  - `RESIDENT` only sees `PUBLIC` comments.
  - `RESIDENT` can only create `PUBLIC` comments.
  - `ORGANISATION_ADMIN` & `TECHNICIAN` can create/view both `PUBLIC` and `INTERNAL` staff notes.
  - Every comment logs `COMMENT_ADDED` in `TicketEvent`.

---

### 4.2 Assignment Concurrency & Data Integrity (`NFR-03`, `AC-1.2`)
- **Owner:** Developer A (Shihab)
- **Status:** `[x] COMPLETED` (Verified via `server/tests/concurrency.test.ts`)
- **Files:** `server/src/services/ticket.service.ts`, `server/tests/concurrency.test.ts`
- **Requirement:**
  - Prevent race conditions during technician assignment.
  - Must use atomic conditional updates (`tx.ticket.updateMany({ where: { id, status: 'TRIAGED' } })`) or row locking inside `prisma.$transaction`.
  - **Acceptance Criteria (AC-1.2):** Automated test must fire 20 parallel assignment requests at the exact same millisecond against one ticket $\rightarrow$ exactly 1 succeeds (`200 OK`) and exactly 19 fail cleanly (`400`/`422 ERR_ILLEGAL_STATE_TRANSITION`).

---

### 4.3 Multi-Tenant Isolation & Security Hardening (`AC-1.1`, `NFR-01`, `NFR-02`)
- **Owner:** Developer A (Shihab)
- **Status:** `[x] COMPLETED` (Verified via `server/tests/tenantIsolation.test.ts`)
- **Files:** `server/src/middleware/tenant.middleware.ts`, `server/tests/tenantIsolation.test.ts`
- **Requirement:**
  - All queries strictly enforce `organisationId: req.tenant.organisationId`.
  - **Acceptance Criteria (AC-1.1):** Attempting to fetch or mutate any record belonging to Tenant A using a Tenant B JWT must return `404 Not Found` (never `200` or leaky errors).

---

### 4.4 Analytics Summary Dashboard — [Batch 2]
- **Owner:** Developer B (Faizul)
- **Status:** `[ ] PENDING`
- **Files:** `server/src/routes/analytics.routes.ts`, `server/src/controllers/analytics.controller.ts`, `client/src/components/AnalyticsDashboard.tsx`
- **Requirement:**
  - Endpoint: `GET /api/v1/analytics/summary` (tenant-scoped).
  - Metrics returned: Total tickets, open count, resolved count, closed count, breakdown by category and priority, and technician workload counts.
  - Clean UI dashboard cards with visual summary bars.

---

### 4.5 Attachments & Thumbnail Pipeline (`FR-1.04`) — [Batch 3]
- **Shared Delivery:**
  - **Shihab (Backend & S3/R2 + BullMQ):** `[x] COMPLETED` (Presigned PUT/GET generator, confirmation endpoint, and BullMQ queue)
  - **Faizul:** Implement client upload picker, validation (images/PDF, max 10MB), preview gallery, and trigger thumbnail generation job.
- **Status:** `[ ] IN PROGRESS`

---

### 4.6 Duplicate Ticket Merge (`CR-1`, `AC-1.4`)
- **Owner:** Developer A (Shihab)
- **Status:** `[x] COMPLETED` (Verified via `server/tests/ticketMerge.test.ts`)
- **Files:** `server/src/controllers/ticket.controller.ts`, `server/src/services/ticket.service.ts`
- **Requirement:**
  - `POST /api/v1/tickets/:id/merge`
  - Atomic transaction: verify both tickets belong to same tenant, reassociate comments and watchers from duplicate to primary, set duplicate status to `CLOSED`, and append `TICKET_MERGED` event linking both tickets.
  - Include concise CR-1 impact estimate in release notes (`docs/cr-1-impact.md`).

---

### 4.7 Client-Specific Business Rule (`FR-1.08`, `AC-1.5`)
- **Owner:** Developer A (Shihab)
- **Status:** `[x] COMPLETED` (Verified via `server/tests/ruleInterceptor.test.ts`)
- **Requirement:** Implement assigned rule with dedicated schema migration (if needed), validation logic, and automated test.

---

### 4.8 Real-Time Updates via Socket.io (`FR-1.06`) — [Batch 3]
- **Shared Delivery:**
  - **Shihab (Server Bootstrap & Rooms):** `[x] COMPLETED` (Socket.io server, JWT handshake auth, room scoping `tenant:${orgId}` & `ticket:${ticketId}`)
  - **Faizul:** Client-side event listeners (`ticket:updated`, `comment:added`, `ticket:assigned`) to automatically refresh React state without full page reloads.
- **Status:** `[ ] IN PROGRESS`

---

### 4.9 Email-to-Ticket Inbound Webhook (`FR-1.05`) — [Batch 4]
- **Owner:** Developer B (Faizul)
- **Status:** `[ ] PENDING`
- **Files:** `server/src/routes/webhook.routes.ts`, `server/src/services/emailWebhook.service.ts`
- **Requirement:**
  - `POST /api/v1/webhooks/inbound-email`
  - Parse subject line for ticket reply tokens (e.g., `[TICK-10026]`). If found, append as comment; if not, create new ticket in `NEW` status.

---

## 5. Master Release Acceptance Checklist

| Criteria | Acceptance Standard | Status |
| :--- | :--- | :---: |
| **AC-1.1** | Cross-tenant ticket lookup returns `404 Not Found`. | ✅ |
| **AC-1.2** | 20 parallel assignment requests produce exactly 1 success and 19 clean conflict responses. | ✅ |
| **AC-1.3** | Full lifecycle verified: Resident create $\rightarrow$ Admin triage $\rightarrow$ Assign $\rightarrow$ Tech in-progress $\rightarrow$ Resolve $\rightarrow$ Close / Reopen within window. | ✅ |
| **AC-1.4** | CR-1 Duplicate ticket merge: reassociates comments/watchers, closes duplicate, records `TICKET_MERGED` event. | ✅ |
| **AC-1.5** | Confirmed Team 6 client-specific rule implemented and backed by automated tests. | ✅ |
| **NFR-04** | API standardization: `/api/v1` prefix, uniform error envelopes, interactive OpenAPI at `/docs`. | ✅ |
| **NFR-05** | Lighthouse performance, accessibility, best practices, and SEO scores $\ge 90$. | ⬜ |
| **NFR-06** | Redis & BullMQ asynchronous queues with Dead-Letter Queue (DLQ) retry inspection. | ✅ |
| **NFR-08** | Automated test coverage: $\ge 70\%$ backend service test coverage (Vitest) + Playwright E2E suite. | ⬜ |
| **D-1.1 – D-1.9** | Git tag `v1.0.0`, passing CI workflow, live Staging/Production URLs on Render, test credentials, OpenAPI `/docs`, Test Report, Runbook, and Release Notes submitted before **07 Dec 2026, 11:59 PM IST**. | ⬜ |
