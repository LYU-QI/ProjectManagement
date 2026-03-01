# Repository Guidelines

## 项目结构与模块组织
- `frontend/`：Vite + React + TypeScript。
  - 入口：`frontend/src/main.tsx`、`frontend/src/App.tsx`
  - 页面：`frontend/src/views/`（`AiView.tsx`、`PmAssistantView.tsx`、`FeishuView.tsx`、`RequirementsView.tsx` 等）
  - 组件：`frontend/src/components/`（含 `AstraeaLayout.tsx`、`ui/ThemedSelect.tsx`、`chat/GlobalAiChatbot.tsx`）
  - API：`frontend/src/api/`
  - 样式：`frontend/src/styles.css` + `frontend/src/styles/tokens.css` + `frontend/src/styles/glass.css`
- `backend/`：NestJS + Prisma。
  - 模块目录：`backend/src/modules/`
  - 核心模块：`ai/`、`pm-assistant/`、`feishu/`、`projects/`、`requirements/`、`costs/`、`schedules/`、`worklogs/`、`notifications/`、`audit-logs/`、`access/`、`project-memberships/`
- `backend/prisma/`：`schema.prisma` 与迁移文件。
- `desktop/`：Electron 端（`desktop/main.js`、`desktop/preload.js`）。
- `docs/`、`README.md`：文档。

## 当前关键能力（2026-03）
- PM 助手支持“按项目绑定配置”：同一任务类型可按项目独立维护。
  - 任务开关：`PmAssistantProjectJobConfig`
  - 提示词：`PmAssistantProjectPrompt`
  - 定时配置：`PmAssistantProjectSchedule`
  - 日志可按项目筛选：`PmAssistantLog.projectId`
- PM 助手运行优先级：`项目级配置 > 全局配置 > 内置默认`。
- 前端支持多主题模式：`light`、`dark`、`nebula`、`forest`、`sunset`、`sakura`、`metal`。

## 构建、迁移与开发命令
- `npm run dev:backend`：启动后端（watch）
- `npm run dev:frontend`：启动前端（默认 `http://localhost:5173/`）
- `npm run dev`：并行启动前后端
- `npm run build`：构建前后端
- `npm run -w backend prisma:generate`：生成 Prisma Client
- `npm run -w backend prisma:migrate`：本地开发迁移（`migrate dev`）
- `npm run -w backend prisma:seed`：种子数据
- `npm run -w frontend preview`：预览前端产物
- `npm run -w desktop start`：启动 Electron
- `npm run -w desktop dist`：打包 Electron

## 数据库迁移规范
- 修改 `schema.prisma` 后必须执行：
  1. `npm run -w backend prisma:generate`
  2. 本地建迁移：`npm run -w backend prisma:migrate`
- 非交互/部署环境推荐：
  - `npx prisma migrate deploy --schema backend/prisma/schema.prisma`
- 迁移后至少验证：
  - `npm run -w backend build`
  - `npm run -w frontend build`

## 编码规范与命名约定
- 统一使用 2 空格缩进。
- React 组件文件使用 `PascalCase`。
- CSS 类名使用 `kebab-case`。
- API 路由遵循 `/api/v1/...`。
- 优先复用主题变量与玻璃态变量，不直接写死颜色。
- 当前未启用正式 lint 规则，保持与邻近代码风格一致。

## PM 助手开发约定
- 涉及 PM 助手配置读取/写入时，优先携带 `projectId`，保证项目隔离。
- 新增任务类型时需同步三层：
  1. 后端任务枚举/默认文案
  2. 前端任务开关/文案展示
  3. 定时任务与日志筛选逻辑
- 变更飞书发送字段时，优先检查人员字段映射与飞书权限（403/91403）。

## 提交与 PR 规范
- 提交建议前缀：`feat:`、`fix:`、`refactor:`、`docs:`。
- PR 需包含：
  - 变更摘要
  - 影响范围（前端/后端/DB）
  - UI 截图（若有）
  - 迁移步骤（若改 Prisma）

## 安全与配置提示
- 使用 `.env` 管理环境变量，禁止提交密钥。
- 确保 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_APP_TOKEN` 同租户同应用。
- Prisma 数据源为 PostgreSQL，需正确设置 `DATABASE_URL`。
