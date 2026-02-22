# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: NestJS API (default `localhost:3000`). Core code in `backend/src/`, feature modules under `backend/src/modules/`, Prisma schema and migrations in `backend/prisma/`.
- `frontend/`: React + Vite admin UI (default `localhost:5173`). Entry points in `frontend/src/main.tsx` and `frontend/src/App.tsx`, API client in `frontend/src/api/`, styles in `frontend/src/styles.css`.
- `docs/`: Reference docs such as `docs/api.md`.
- Root specs and plans: `spec.md`, `development-plan.md`, `development-plan-estimate.md`.

## Build, Test, and Development Commands
- `npm install`: installs workspace deps.
- `npm run dev`: runs backend and frontend together (backgrounds backend).
- `npm run dev:backend`: starts NestJS in watch mode.
- `npm run dev:frontend`: starts Vite dev server.
- `npm run build`: builds backend and frontend.
- Backend DB tasks:
  - `npm run -w backend prisma:generate`
  - `npm run -w backend prisma:migrate`
  - `npm run -w backend prisma:seed`
- Infra (optional): `docker compose up -d` for Postgres + Redis.

## Coding Style & Naming Conventions
- TypeScript strict mode is enabled in both `backend/tsconfig.json` and `frontend/tsconfig.json`.
- Use standard NestJS module/service/controller patterns under `backend/src/modules/`.
- React components use `.tsx` with `PascalCase` names (e.g., `App.tsx`).
- Linting is not configured (`backend` has a placeholder `lint` script). Keep changes minimal and consistent with existing formatting.

## Testing Guidelines
- No test runner is configured yet. If you add tests, document the framework and add an npm script.
- Suggested convention: place backend tests near modules (e.g., `backend/src/modules/foo/foo.service.spec.ts`).

## Commit & Pull Request Guidelines
- Git history shows a single initial commit, so no commit message convention is established.
- Recommended format going forward: short imperative summary (e.g., `Add cost aggregation endpoint`).
- PRs should include a concise description, linked issues (if any), and screenshots for UI changes.

## Configuration Tips
- Copy env template before running backend: `cp backend/.env.example backend/.env`.
- Default seed users are defined in README and created via `prisma:seed`.
