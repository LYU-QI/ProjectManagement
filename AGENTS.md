# Repository Guidelines

## 项目结构与模块组织
- `frontend/` 为 Vite + React 前端。入口在 `frontend/src/main.tsx` 和 `frontend/src/App.tsx`，页面位于 `frontend/src/views/`（包含 `AiView.tsx`、`PmAssistantView.tsx` 等），通用组件在 `frontend/src/components/`，API 封装在 `frontend/src/api/`，样式在 `frontend/src/styles.css`。
- `backend/` 为 NestJS 服务端。核心模块：
  - `ai/`：提供会议纪要解析、Dashboard 摘要、风险预测等 AI 能力。
  - `pm-assistant/`：PM 助手模块，负责定时/手动触发飞书机器人消息推送（早报、看板、风险提醒等）。
  - `feishu/`：飞书开放平台集成。
  - `projects/` / `requirements/` / `costs/`：基础业务模块。
- `backend/prisma/` 存放 Prisma schema 与迁移文件。
- `desktop/` 为 Electron 桌面端（入口 `desktop/main.js`，预加载 `desktop/preload.js`，打包配置在 `desktop/package.json`）。
- `docs/` 与 `README.md` 为辅助文档。

## 构建、测试与开发命令
- `npm run dev:backend`：以 watch 模式启动后端 API。
- `npm run dev:frontend`：启动前端开发服务器（默认 `http://localhost:5173/`）。
- `npm run dev`：同时启动前后端。
- `npm run build`：构建前后端产物。
- `npm run -w backend prisma:migrate`：执行数据库迁移。
- `npm run -w backend prisma:generate`：生成 Prisma Client。
- `npm run -w backend prisma:seed`：执行种子数据。
- `npm run -w frontend preview`：本地预览前端构建产物。
- `npm run -w desktop start`：启动 Electron 桌面端。
- `npm run -w desktop dist`：打包 Electron 桌面端。

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
- Prisma 数据源为 PostgreSQL，需设置 `DATABASE_URL`。
