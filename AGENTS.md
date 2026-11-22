# AGENTS.md — DeskOps Developer & AI Agent Guidelines

> **Target Audience:** AI coding agents (Antigravity, Cursor, Claude Code, Copilot, etc.) and human engineers pair-programming on DeskOps.
> **Repository:** `deskops` (LogicVeda Technologies Batch 1.1 — Phase 1: Ticketing Core)
> **Base Client:** Greenfield Facilities (Property & Facilities Management)

---

## 1. Project Overview & Context

DeskOps is an enterprise multi-tenant service desk and maintenance ticketing platform engineered specifically for property and facilities management operations. 

- **Primary Goal (Phase 1):** Deliver an auditable, high-reliability ticketing core handling resident requests, property triage, technician dispatch, ticket lifecycle progression, and audit history.
- **Base Client Model:** Greenfield Facilities manages 6 properties, ~2,000 units, and 60 technicians. Requests originate from residents and property managers.
- **Reference Specification:** Full architecture and non-functional requirements are specified in [`docs/technical-design.md`](docs/technical-design.md) (`DESKOPS-TDD-P1-v1.0`).

### 1.1 Out of Scope (Phase 1 — Do NOT Implement)
Per project requirements, the following features are strictly **out of scope** for Phase 1:
- Maintenance-fee billing, rent, payment gateways, utility charging, or accounting ledgers.
- Visitor management, gate passes, vehicle QR stickers, parking stall assignments.
- Native mobile applications (iOS/Android native code; web UI must remain responsive).

---

## 2. Repository Layout & Architecture

The project is structured as a modular monorepo:

```text
deskops/
├── client/                     # Frontend SPA (React 18, Vite, TypeScript, Tailwind)
│   ├── src/
│   │   ├── components/         # Reusable UI primitives and modals
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utility helpers
│   │   ├── pages/              # Routed view containers
│   │   ├── services/           # API client and auth state management
│   │   ├── types/              # Frontend TypeScript definitions
│   │   ├── App.tsx             # Root application view & state orchestration
│   │   └── main.tsx            # Application entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                     # Backend API (Node.js 22, Express, TypeScript, Prisma)
│   ├── src/
│   │   ├── config/             # Environment & runtime configuration
│   │   ├── controllers/        # Express HTTP request/response handlers
│   │   ├── middleware/         # Auth, Tenant Resolver, RBAC, Error Handler
│   │   ├── routes/             # Express route declarations (/api/v1/...)
│   │   ├── services/           # Core domain logic & state machines
│   │   ├── types/              # Backend TypeScript types & DTOs
│   │   ├── lib/                # Prisma client singleton & shared utilities
│   │   ├── app.ts              # Express application configuration
│   │   └── index.ts            # HTTP server bootstrap
│   ├── package.json
│   └── tsconfig.json
├── prisma/                     # Database layer & migrations
│   ├── schema.prisma           # Canonical database schema & enum declarations
│   ├── seed.ts                 # Database seeder with sample data
│   └── migrations/             # Version-controlled SQL migrations
├── docs/                       # Technical specifications, ADRs, runbooks
│   └── technical-design.md     # Canonical system architecture document
├── docker-compose.yml          # Container orchestration (Postgres 16, server, client)
├── .env.example                # Canonical environment variable template
├── README.md                   # Developer getting-started guide
└── AGENTS.md                   # Agent & developer operating instructions (this file)
```

---

## 3. Technology Stack & Key Libraries

| Layer | Technologies |
| :--- | :--- |
| **Runtime & Language** | Node.js 22+, TypeScript 5.7+ (strict mode enabled) |
| **Backend Framework** | Express 4.21+ (ES Modules / `tsx` runtime) |
| **Database & ORM** | PostgreSQL 16, Prisma ORM 6.19+ |
| **Authentication** | JWT (`jsonwebtoken`), password hashing via `bcryptjs` |
| **Frontend Framework** | React 18, Vite 6, TypeScript 5.7 |
| **Styling & Icons** | Tailwind CSS / inline accessible UI styling |
| **Job Queue & Cache** | Redis, BullMQ (for asynchronous tasks / worker) |
| **Real-Time** | Socket.io (WebSocket with HTTP long-polling fallback) |
| **Containerization** | Docker, Docker Compose |

---

## 4. Development Workflow & Standard Commands

Always run commands in their respective directory (`server/` or `client/`):

### 4.1 Environment Setup
```bash
# Copy environment configuration template
cp .env.example .env
```

### 4.2 Backend (`cd server`)
```bash
# Install dependencies
npm install

# Start development server with live reload (runs on port 5000)
npm run dev

# Run TypeScript typecheck without emitting output
npm run typecheck

# Build for production (compiles to dist/)
npm run build

# Start production build
npm start

# Generate Prisma Client (after modifying prisma/schema.prisma)
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database with base data (Greenfield Facilities, roles, properties, demo users)
npm run seed
```

### 4.3 Frontend (`cd client`)
```bash
# Install dependencies
npm install

# Start Vite dev server (runs on port 5173)
npm run dev

# Run TypeScript typecheck
npm run typecheck

# Build for production
npm run build

# Preview production build
npm run preview
```

### 4.4 Docker Orchestration
```bash
# Build and start all services (PostgreSQL 16, API server, client SPA)
docker compose up -d --build

# View container logs
docker compose logs -f

# Stop and tear down containers
docker compose down
```

---

## 5. Seeded Credentials & Test Accounts

The database seed script (`prisma/seed.ts`) populates standard demonstration accounts for Greenfield Facilities. All demo passwords are `Password123!`:

| Role | Email | Password | Primary Scope / Capabilities |
| :--- | :--- | :--- | :--- |
| **Organisation Admin** | `admin@greenfield.com` | `Password123!` | Full tenant control, property/unit setup, triage, technician assignment, close/reopen tickets. |
| **Technician** | `tech@greenfield.com` | `Password123!` | View assigned tickets, transition status (`IN_PROGRESS`, `ON_HOLD`, `RESOLVED`), post comments. |
| **Resident** | `resident@greenfield.com` | `Password123!` | Create tickets for assigned unit, view own tickets, post comments, close/reopen resolved tickets. |

---

## 6. Core Architectural Invariants (Non-Negotiable Rules)

Agents working on this codebase **must** adhere to the following architectural rules:

### 6.1 Multi-Tenant Isolation
1. **Always enforce `organisationId`:** DeskOps is strictly multi-tenant. Every single query accessing tenant-scoped models (`Property`, `Unit`, `Ticket`, `TicketEvent`, `Comment`, `Attachment`, `Notification`) **must include `organisationId`** in the `where` filter.
2. **Derive tenant context from authentication:** Never trust tenant IDs supplied via client request parameters or URL query parameters. Always resolve the tenant from the verified JWT session via `resolveTenant` middleware (`req.tenant.organisationId`).
3. **Database Constraints:** Every tenant table has composite unique keys and indexes that include `organisationId` (e.g. `@@unique([organisationId, code])`, `@@index([organisationId, status])`). Never remove or bypass these constraints.

### 6.2 3-Tier Layered Backend Architecture
Do not collapse backend layers:
```
Routes  -->  Middleware  -->  Controllers  -->  Services  -->  Prisma / Database
```
- **Routes (`src/routes/`):** Define URL endpoints, HTTP methods, and attach middleware pipelines (`authenticate`, `resolveTenant`, `requireRoles(...)`). No business logic.
- **Controllers (`src/controllers/`):** Extract and validate request input (`req.body`, `req.params`, `req.query`), call the appropriate service method, and format the HTTP response. No direct Prisma queries.
- **Services (`src/services/`):** House all business logic, authorization rules, validations, state machine transitions, and database queries via Prisma.
- **API Response Shape:** Always return consistent JSON envelopes:
  - **Success:** `{ success: true, data: <payload> }`
  - **Error:** `{ success: false, error: { code: string, message: string, details?: any } }`

### 6.3 Ticket State Machine & Lifecycle Rules
Ticket statuses and valid transitions are strictly governed by `TicketStateMachine` in `server/src/services/ticketStateMachine.ts`:

```
   [ NEW ]
      │ (ORGANISATION_ADMIN triage)
      ▼
  [ TRIAGED ]
      │ (ORGANISATION_ADMIN assign)
      ▼
  [ ASSIGNED ]
      │ (ADMIN / TECHNICIAN start work)
      ▼
[ IN_PROGRESS ] ◄────────────┐ (reopened within reopenWindowHours)
      │ ▲                    │
      │ └──── [ ON_HOLD ]    │
      │       (parts/access) │
      ▼                      │
  [ RESOLVED ] ──────────────┘
      │ (ADMIN / RESIDENT confirm)
      ▼
   [ CLOSED ]
```

- **Enforce Role Restrictions:**
  - `NEW` $\rightarrow$ `TRIAGED`: `ORGANISATION_ADMIN` only.
  - `TRIAGED` $\rightarrow$ `ASSIGNED`: `ORGANISATION_ADMIN` only (assigning a `technicianId`).
  - `ASSIGNED` $\rightarrow$ `IN_PROGRESS`: `ORGANISATION_ADMIN` or assigned `TECHNICIAN`.
  - `IN_PROGRESS` $\leftrightarrow$ `ON_HOLD`: `ORGANISATION_ADMIN` or assigned `TECHNICIAN`.
  - `IN_PROGRESS` $\rightarrow$ `RESOLVED`: `ORGANISATION_ADMIN` or assigned `TECHNICIAN`.
  - `RESOLVED` $\rightarrow$ `CLOSED`: `ORGANISATION_ADMIN` or `RESIDENT`.
  - `RESOLVED` $\rightarrow$ `IN_PROGRESS` (Reopen): Permitted only within `organisation.reopenWindowHours` (default: 24h).
- **Mandatory Audit Trail (`TicketEvent`):** Every single ticket creation, status change, technician assignment, comment, or merge **must** create an immutable `TicketEvent` row inside the same `prisma.$transaction`.

### 6.4 Concurrency & Atomic Operations
- When performing mutations that depend on current status (e.g. status transition, technician assignment, duplicate merging), use `prisma.$transaction` to guarantee atomicity.
- In race conditions (e.g. concurrent assignments), verify the record has not transitioned before persisting.

---

## 7. Role-Based Access Control (RBAC) Reference

| Role (`RoleName`) | Description | Allowed Operations |
| :--- | :--- | :--- |
| `ORGANISATION_ADMIN` | Tenant property manager / operations director | Create/manage properties & units; invite users; triage tickets; assign technicians; override any ticket status; post public/internal comments; view all tenant tickets. |
| `TECHNICIAN` | Field engineer / contractor | View assigned tickets; update status (`IN_PROGRESS`, `ON_HOLD`, `RESOLVED`); log resolution notes; post comments; upload proof attachments. |
| `RESIDENT` | Apartment / office unit occupant | Submit maintenance tickets for own unit; view own ticket history; post public comments; confirm resolution / close ticket; reopen within window. |

---

## 8. Coding Standards & Conventions

### 8.1 TypeScript & Code Style
- **Strict Typing:** Avoid `any`. Use strongly typed interfaces for DTOs, parameters, and return types.
- **ES Modules:** Use `.js` extension when importing local TypeScript files in the server (e.g., `import { config } from './config/index.js';`).
- **Preserve Documentation:** Preserve existing comments, docstrings, and architectural notes when refactoring.

### 8.2 Error Handling
- Never allow unhandled promise rejections. Wrap controller logic in `try / catch` blocks or use async handler wrappers.
- Use explicit error codes in API responses:
  - `ERR_VALIDATION_FAILED` (400)
  - `UNAUTHORIZED` (401)
  - `TENANT_UNRESOLVED` (401)
  - `FORBIDDEN` (403)
  - `TICKET_NOT_FOUND` / `NOT_FOUND` (404)
  - `ERR_ILLEGAL_STATE_TRANSITION` (400 / 422)
  - `INTERNAL_ERROR` (500)

### 8.3 Prisma Migrations & Schema Changes
- **Never edit the database schema manually in Postgres.**
- Always edit `prisma/schema.prisma` first.
- Run `npm run prisma:migrate -- --name <descriptive_name>` from `server/` to generate and apply version-controlled migration files.
- Regenerate the Prisma Client using `npm run prisma:generate`.

---

## 9. Verification & Quality Checklist for Agents

Before completing any task or opening a pull request, agents must execute the following checks:

- [ ] **Typecheck Backend:** `cd server && npm run typecheck` passes with zero TypeScript errors.
- [ ] **Typecheck Frontend:** `cd client && npm run typecheck` passes with zero TypeScript errors.
- [ ] **Build Validation:** `cd server && npm run build` and `cd client && npm run build` both succeed.
- [ ] **Tenant Scoping:** All new Prisma queries contain `organisationId` filters.
- [ ] **State Machine Integrity:** Status changes validate transitions via `TicketStateMachine.validateTransition(...)`.
- [ ] **Audit Trail:** Ticket state or assignment modifications record a `TicketEvent`.
- [ ] **RBAC Protection:** New routes are guarded by `authenticate`, `resolveTenant`, and `requireRoles(...)`.
- [ ] **No Committed Secrets:** No API keys, passwords, or tokens are committed; `.env` remains in `.gitignore`.
- [ ] **Docker Compatibility:** `docker compose config` validates cleanly.

---

## 10. Communication & Clarification Policy

If a task introduces ambiguity regarding:
- Modifying the state machine transitions or reopening rules
- Introducing new database relations or dropping columns
- Altering the tenant context derivation
- Adding third-party integrations outside the approved stack

**STOP and ask the user for clarification before executing destructive or architectural modifications.**
