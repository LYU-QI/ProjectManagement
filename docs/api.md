# API Quick Reference

## Health
- GET `/health`

## Auth
- POST `/api/v1/auth/login`

## Projects
- GET `/api/v1/projects`
- POST `/api/v1/projects`
- GET `/api/v1/projects/{id}/schedule`
- GET `/api/v1/projects/{id}/risks`
- POST `/api/v1/projects/tasks`
- POST `/api/v1/projects/milestones`

## Requirements
- GET `/api/v1/requirements?projectId=1`
- POST `/api/v1/requirements`
- POST `/api/v1/requirements/{id}/review`
- POST `/api/v1/requirements/{id}/change`

## Cost
- GET `/api/v1/cost-entries?projectId=1`
- GET `/api/v1/cost-entries/summary?projectId=1`
- POST `/api/v1/cost-entries`

## Worklogs
- GET `/api/v1/worklogs?projectId=1`
- POST `/api/v1/worklogs`

## Dashboard
- GET `/api/v1/dashboard/overview`

## AI
- POST `/api/v1/ai/reports/weekly`

## Notifications
- GET `/api/v1/notifications?projectId=1`
- GET `/api/v1/notifications?unread=true`
- POST `/api/v1/notifications/{id}/read`

## Audit Logs
- GET `/api/v1/audit-logs?projectId=1` (pm/lead)
