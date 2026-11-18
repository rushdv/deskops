# DeskOps — Multi-Tenant Service Desk & Ticketing Platform

DeskOps is an enterprise multi-tenant service desk and maintenance ticketing platform built for property and facilities management operations.

## Project Structure

```text
deskops/
├── client/                 # React + Vite + TypeScript frontend
├── server/                 # Node.js + Express + TypeScript backend
├── docs/                   # Architectural & technical design documentation
│   └── technical-design.md # Canonical technical design document (M1.1)
├── docker-compose.yml      # Local container orchestration (Postgres, Server, Client)
├── .env.example            # Environment configuration template
├── .gitignore              # Repository exclusion rules
└── README.md               # Project guide and developer documentation
```

## Prerequisites

- **Node.js**: v20 or higher (v22+ recommended)
- **npm**: v10 or higher
- **Docker & Docker Compose**: (Optional, for containerized execution)

## Getting Started

### 1. Environment Setup

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

### 2. Backend (Server)

Install dependencies and start the backend development server:

```bash
cd server
npm install
npm run dev
```

- Server will start on `http://localhost:5000`
- Health check endpoint: `http://localhost:5000/health`
- Build for production: `npm run build`
- Start production build: `npm start`

### 3. Frontend (Client)

In a separate terminal, install dependencies and start the client development server:

```bash
cd client
npm install
npm run dev
```

- Client will run on `http://localhost:5173`
- Build for production: `npm run build`
- Preview production build: `npm run preview`

---

## Docker Usage

To spin up the entire application stack (PostgreSQL 16, backend server, and frontend client):

```bash
# Build and launch all containers
docker compose up -d --build

# View container logs
docker compose logs -f

# Shut down containers
docker compose down
```

The frontend will be accessible at `http://localhost:80` and the backend at `http://localhost:5000`.
