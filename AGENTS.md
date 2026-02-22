# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: NestJS API. Main entry in `backend/src/main.ts` with modules under `backend/src/modules/` (e.g., auth, projects, costs, schedule, audit). Prisma schema and migrations live in `backend/prisma/`.
- `frontend/`: React + Vite admin UI. App shell in `frontend/src/App.tsx`, views in `frontend/src/views/`, shared UI in `frontend/src/components/`, API clients in `frontend/src/api/`, and shared types in `frontend/src/types.ts`.
- `docs/`: Reference docs such as `docs/api.md`.
- Root plans/specs: `spec.md`, `development-plan.md`, `development-plan-estimate.md`.

## Build, Test, and Development Commands
- `npm install` then `npm install --workspace backend` and `npm install --workspace frontend` to install dependencies.
- `npm run dev:backend`: Start NestJS API (default `http://localhost:3000`).
- `npm run dev:frontend`: Start Vite UI (default `http://localhost:5173`).
- `npm run dev`: Run both (backend + frontend).
- `npm run build`: Build backend and frontend.
- `npm run -w backend prisma:generate`: Generate Prisma client.
- `npm run -w backend prisma:migrate`: Apply local migrations.
- `npm run -w backend prisma:seed`: Seed default users.
- `docker compose up -d`: Optional PostgreSQL/Redis.

## Coding Style & Naming Conventions
- Indentation is 2 spaces; keep existing formatting style.
- TypeScript/React with semicolons and single quotes is the prevailing style.
- Modules: NestJS feature folders under `backend/src/modules/<feature>/`.
- Components/Views: PascalCase filenames (e.g., `ResourcesView.tsx`).
- No lint/format tooling is configured; keep diffs tight and consistent with surrounding code.

## Testing Guidelines
- There is no automated test framework configured yet.
- Validate changes with `npm run build` and manual UI/API checks.
- If you add risky changes, include a short manual test note in your PR.

## Commit & Pull Request Guidelines
- Commit messages follow a short, imperative, sentence-case style (e.g., “Integrate Feishu schedule view”).
- Prefer small, focused commits.
- PRs should include: summary, key screenshots for UI changes, and any manual verification steps.
- If you introduce Prisma schema changes, include the migration under `backend/prisma/migrations/`.

## Configuration Tips
- Backend config is via `backend/.env` (copy from `backend/.env.example`).
- Do not commit secrets. Keep Feishu and DB credentials in `.env` only.
