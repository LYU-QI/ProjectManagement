# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProjectLVQI (天枢系统) is a multi-project management system for small-to-medium software teams (5-80 people). It provides unified management for requirements, costs, schedules, and AI-powered project insights.

**Tech Stack:**
- **Backend**: NestJS + Prisma ORM + PostgreSQL
- **Frontend**: React + TypeScript + Vite
- **Infrastructure**: Docker Compose (PostgreSQL + Redis)
- **AI**: OpenAI-compatible API for weekly reports and risk analysis

**Architecture**: Modular Monolith with clear domain boundaries (Auth, Projects, Requirements, Costs, Schedules, Dashboard, AI, Notifications, AuditLogs).

## Development Commands

### Initial Setup

```bash
# Install all dependencies (root workspace)
npm install
npm install --workspace backend
npm install --workspace frontend

# Start infrastructure services
docker compose up -d

# Configure backend environment
cp backend/.env.example backend/.env
```

### Backend Development

```bash
# Generate Prisma client
npm run -w backend prisma:generate

# Run database migrations
npm run -w backend prisma:migrate

# Seed database with test data (creates pm/lead/viewer users)
npm run -w backend prisma:seed

# Start backend dev server (port 3000)
npm run dev:backend
# or
npm run -w backend dev
```

### Frontend Development

```bash
# Start frontend dev server (port 5173)
npm run dev:frontend
# or
npm run -w frontend dev
```

### Full Stack Development

```bash
# Start both backend and frontend
npm run dev
```

### Building

```bash
# Build both
npm run build

# Build individual workspaces
npm run -w backend build
npm run -w frontend build
```

## Authentication & Authorization

**Default Test Accounts** (seeded via `prisma/seed.ts`):
- `pm / 123456` - Project Manager (full access)
- `lead / 123456` - Tech Lead (full access)
- `viewer / 123456` - Read-only access

**Role-Based Access Control (RBAC)**:
- `viewer` - Read-only access to all resources
- `pm` and `lead` - Full CRUD access
- JWT tokens stored in `localStorage` under `projectlvqi_token`
- Global guards enforce authentication on all endpoints except `/health` and `/api/v1/auth/login`
- Use `@Public()` decorator for public endpoints

## Database Schema (Prisma)

**Core Models:**
- `User` - System users with roles (pm/lead/viewer)
- `Project` - Projects with owners, budgets, dates
- `Requirement` - Requirements with status (draft→in_review→approved→planned→done)
- `RequirementReview` - Review decisions (approved/rejected)
- `CostEntry` - Cost entries by type (labor/outsource/cloud)
- `Worklog` - Time tracking with hourly rates
- `Task` - Schedule tasks with status (todo/in_progress/blocked/done)
- `Milestone` - Project milestones with planned/actual dates
- `Notification` - User notifications with read status
- `AuditLog` - Operation audit trail (auto-populated via interceptor)

**Key Relationships:**
- All domain models (requirements, costs, tasks, etc.) belong to a Project
- Users can own multiple projects
- Worklogs track user hours for cost calculation

## API Structure

**Base URL**: `http://localhost:3000/api/v1`

**Module Endpoints** (see `docs/api.md` for full reference):
- `/auth/login` - Authentication
- `/projects` - Project CRUD
- `/requirements` - Requirement management + review + change tracking
- `/cost-entries` - Cost entries + summary
- `/worklogs` - Time tracking
- `/projects/{id}/schedule` - Tasks + milestones
- `/projects/{id}/risks` - Risk analysis
- `/dashboard/overview` - Multi-project dashboard
- `/ai/reports/weekly` - AI weekly report generation
- `/notifications` - Notification center
- `/audit-logs` - Audit logs (pm/lead only)

**Request Format:**
- JWT token in `Authorization: Bearer <token>` header
- JSON bodies with validation via `class-validator`
- Global error handling with structured responses

## Frontend Architecture

**Key Files**:
- `frontend/src/App.tsx` - Single-page application with all views
- `frontend/src/api/client.ts` - API client with auth handling

**Views** (managed via `view` state):
- `dashboard` - Project overview with health metrics
- `requirements` - Requirement management
- `costs` - Cost entry and worklog tracking
- `schedule` - Tasks and milestones
- `notifications` - Notification center
- `ai` - AI report generation
- `audit` - Audit logs (pm/lead only)

**State Management**: React useState + useEffect patterns
**Auth Storage**: `localStorage` for token and user info

## Domain Logic Highlights

**Requirement Workflow**:
```
draft → in_review → approved → planned → done
```
- Change tracking increments `changeCount`
- Reviews create `RequirementReview` records

**Cost Calculation**:
- Labor cost = worklog.hours × worklog.hourlyRate
- Total cost = labor + outsource + cloud
- Budget variance rate = (actual - budget) / budget

**Risk Assessment**:
- Blocked task count triggers risk level
- Schedule variance from milestones
- Budget overage percentage

**AI Reports**:
- Structured prompts with business data context
- Fact constraints (no hallucinations)
- Traceable data sources

## Testing

**Current State**: Tests not yet configured (MVP phase)

**Planned Coverage** (per `development-plan.md`):
- Unit tests: ≥70% for backend core domains
- API automation: ≥90% for P0/P1 endpoints
- E2E tests: ≥80% for core user paths

## Important Conventions

1. **Immutability**: Use spread operators for object updates
2. **Error Handling**: Comprehensive try-catch with user-friendly messages
3. **Audit Trail**: All write operations logged via `AuditInterceptor`
4. **Validation**: Backend uses `class-validator` decorators on DTOs
5. **Authorization**: Check `user?.role` for pm/lead vs viewer permissions
6. **Date Format**: Strings in `YYYY-MM-DD` format for dates
7. **Currency**: CNY for all monetary values

## Development Notes

- Backend runs on port 3000, frontend on port 5173
- Prisma schema at `backend/prisma/schema.prisma`
- Database migrations should be run after schema changes
- Seed data includes test users and sample projects
- Audit interceptor auto-logs all non-GET requests
- Notifications auto-created for risk events
- AI module currently returns template responses (integration pending)

## Project Status

**Current Phase**: MVP Stage 1 (per `development-plan.md` Sprint 1-3)
- ✅ Auth/RBAC
- ✅ Project CRUD
- ✅ Requirements (basic workflow)
- ✅ Cost tracking (labor/outsource/cloud)
- ✅ Worklogs
- ✅ Tasks & Milestones
- ✅ Dashboard overview
- ✅ Notifications center
- ✅ Audit logs
- ⏳ AI reports (stub implementation)

**Next Steps** (Stage 2):
- Gantt/WBS visualization
- Advanced risk rules engine
- AI integration with actual LLM
- Email notifications
- Performance optimization (caching, materialized views)
