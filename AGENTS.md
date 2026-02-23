# Repository Guidelines

## 项目结构与模块组织
- `frontend/` 为 Vite + React 前端。入口在 `frontend/src/main.tsx` 和 `frontend/src/App.tsx`，页面位于 `frontend/src/views/`，通用组件在 `frontend/src/components/`，API 封装在 `frontend/src/api/`，样式在 `frontend/src/styles.css`。
- `backend/` 为 NestJS 服务端。业务模块在 `backend/src/modules/`（如 `projects/`、`feishu/`、`risks/`），入口为 `backend/src/main.ts`，模块注册在 `backend/src/app.module.ts`。
- `backend/prisma/` 存放 Prisma schema 与迁移文件。
- `docs/` 与 `README.md` 为辅助文档。

## 构建、测试与开发命令
- `npm run dev:backend`：以 watch 模式启动后端 API。
- `npm run dev:frontend`：启动前端开发服务器（默认 `http://localhost:5173/`）。
- `npm run dev`：同时启动前后端。
- `npm run build`：构建前后端产物。
- `npm run -w backend prisma:migrate`：执行数据库迁移。

## 编码规范与命名约定
- 统一使用 2 空格缩进。
- React 组件文件使用 `PascalCase`（如 `NotificationsView.tsx`）。
- API 路由遵循 `/api/v1/...` 风格。
- CSS 类名使用 `kebab-case`，并优先复用 `frontend/src/styles.css` 中的变量。
- 当前未配置 lint（`backend` 中 `lint` 仅占位），请保持风格与相邻代码一致。

## 测试规范
- 目前未配置测试框架。如新增测试，建议后端使用 `*.spec.ts`，前端使用 `*.test.tsx`，并在本文件补充运行方式。

## 提交与 PR 规范
- 提交信息建议使用 `feat:`、`refactor:` 等简洁前缀，后接明确改动说明。
- PR 需包含：修改摘要、关联需求/问题、UI 改动截图（如有）。
- 若涉及 Prisma schema 变更，请在 PR 说明迁移步骤。

## 安全与配置提示
- 环境变量通过 `.env` 与 Config 模块管理，禁止提交密钥。
- 变更 Prisma schema 后需执行 `npm run -w backend prisma:migrate` 并确认服务可启动。
