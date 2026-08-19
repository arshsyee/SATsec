# Vigil

Vigil is a full-stack website monitoring platform built during HackYSU 2026. It audits websites for performance, accessibility, SEO, and security issues, stores results over time, and helps users identify regressions after a site changes.

![Vigil dashboard showing scheduled monitoring](frontend/public/features/02-scheduled-monitoring.png)

## Highlights

- Runs on-demand audits across performance, accessibility, SEO, and security
- Tracks historical scores and visualizes trends in a React dashboard
- Supports recurring audits and configurable score-drop alerts
- Provides guest audits that can be imported after registration
- Includes account registration, email verification, JWT sessions, and password reset
- Generates optional AI summaries when an Anthropic API key is configured
- Sends optional email and webhook notifications

![Vigil audit feature overview](frontend/public/features/01-instant-audits.jpg)

## Architecture

```text
React + Vite frontend
        |
        | REST API
        v
FastAPI application
  |-- audit engine
  |-- authentication
  |-- scheduler and alerts
  `-- SQLAlchemy persistence
        |
        | SQLite locally / PostgreSQL-ready configuration
        v
Audit history and scheduled checks
```

## Technology

| Layer | Tools |
| --- | --- |
| Frontend | React, Vite, React Router, Tailwind CSS, Recharts |
| Backend | Python, FastAPI, SQLAlchemy, APScheduler |
| Data | SQLite for local development; PostgreSQL configuration supported |
| Integrations | AWS SES, Anthropic, Sentry, webhooks |
| Testing | Vitest, Testing Library |

## Project status

Vigil is maintained as a hackathon project showcase. The original deployment is no longer running, but the repository contains the working application developed for the event.

### Implemented

- On-demand multi-category website audits
- Historical audit storage and score visualization
- Scheduled audits and threshold alerts
- Guest sessions and account import
- Registration, email verification, login, and password reset
- Optional AI summaries, email notifications, webhooks, and Sentry integration
- Responsive React interface with light and dark themes

### Planned or production-hardening work

- Production deployment and infrastructure validation
- Expanded backend test coverage
- Distributed task workers for higher audit volume
- Billing, teams, report export, and public API features described under `docs/feature-plans/`

Planned documents describe future directions and are not presented as shipped functionality.

## Run locally

### Prerequisites

- Python 3.11+
- Node.js 20+

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn main:app --reload
```

The API runs at `http://localhost:8000`.

For local evaluation, the placeholder values in `.env.example` are sufficient for core auditing. Email delivery, AI summaries, and error monitoring remain disabled until their optional credentials are configured.

### Frontend

In a second terminal:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Checks

```powershell
cd frontend
npm ci
npm test
npm run lint
npm run build
```

## Repository map

```text
backend/                 FastAPI application, audit engine, auth, and scheduling
frontend/src/            React application
frontend/src/__tests__/  Frontend API tests
docs/feature-plans/      Clearly labeled future feature designs
docs/implementation/     Deployment and scaling notes
```

## Security notes

- Secrets belong in local `.env` files, which are ignored by Git.
- The checked-in `.env.example` files contain placeholders only.
- Do not expose a development instance to the public internet without reviewing the production-hardening notes.
- `docs/SECURITY_WEAKNESSES.md` records known hardening work transparently.

## Background

Vigil was created during a 36-hour HackYSU build to explore a shift from one-time website audits to continuous monitoring. The project demonstrates end-to-end product development across a React frontend, Python API, persistence, authentication, scheduled work, and external integrations.

## License

See [LICENSE.md](LICENSE.md).
