# Repository Guidelines

## 项目结构与模块组织
- `frontend/`：Vite + React + TypeScript。
  - 入口：`frontend/src/main.tsx`、`frontend/src/App.tsx`
  - 页面：`frontend/src/views/`（`AiView.tsx`、`PmAssistantView.tsx`、`FeishuView.tsx`、`DashboardView.tsx`、`RequirementsView.tsx` 等）
  - 组件：`frontend/src/components/`（含 `AstraeaLayout.tsx`、`chat/GlobalAiChatbot.tsx`、`ui/ThemedSelect.tsx`）
  - API 封装：`frontend/src/api/`
  - 样式体系：`frontend/src/styles.css` + `frontend/src/styles/tokens.css` + `frontend/src/styles/glass.css`
- `backend/`：NestJS + Prisma。
  - 模块目录：`backend/src/modules/`
  - 主要模块：`ai`、`pm-assistant`、`feishu`、`projects`、`requirements`、`costs`、`schedules`、`worklogs`、`notifications`、`audit-logs`、`access`、`project-memberships`、`feishu-users`
- `backend/prisma/`：`schema.prisma` + `migrations/`
- `desktop/`：Electron 端（`desktop/main.js`、`desktop/preload.js`）
- `docs/`、`README.md`：辅助文档

## 当前关键能力（按当前代码）
- PM 助手支持“按项目绑定配置”（而非仅全局）：
  - 任务开关：`PmAssistantProjectJobConfig`
  - 提示词：`PmAssistantProjectPrompt`
  - 定时配置：`PmAssistantProjectSchedule`
  - 运行日志：`PmAssistantLog.projectId`
  - 生效优先级：`项目级 > 全局 > 默认`
- 飞书集成支持“项目级多维表格配置”：
  - `Project.feishuAppToken`
  - `Project.feishuTableId`
  - `feishu` 相关接口支持 `projectId`，用于按项目路由到不同 App/表
- 前端主题支持：`light`、`dark`、`nebula`、`forest`、`sunset`、`sakura`、`metal`

## 构建、迁移与开发命令
- `npm run dev:backend`：启动后端（watch）
- `npm run dev:frontend`：启动前端（默认 `http://localhost:5173/`）
- `npm run dev`：并行启动前后端
- `npm run build`：构建前后端
- `npm run -w backend prisma:generate`：生成 Prisma Client
- `npm run -w backend prisma:migrate`：本地开发迁移（`migrate dev`）
- `npm run -w backend prisma:seed`：初始化种子数据
- `npm run -w frontend preview`：预览前端产物
- `npm run -w desktop start`：启动 Electron
- `npm run -w desktop dist`：打包 Electron

## 数据库迁移规范
- 改动 `backend/prisma/schema.prisma` 后，至少执行：
  1. `npm run -w backend prisma:generate`
  2. `npm run -w backend prisma:migrate`
- 部署/非交互环境优先使用：
  - `npx prisma migrate deploy --schema backend/prisma/schema.prisma`
- 迁移后建议最小验证：
  - `npm run -w backend build`
  - `npm run -w frontend build`

## 编码规范与命名约定
- 统一 2 空格缩进。
- React 组件文件使用 `PascalCase`。
- CSS 类名使用 `kebab-case`。
- API 路由遵循 `/api/v1/...`。
- 优先复用 tokens/glass 变量，不直接硬编码大段颜色。
- 当前未启用完整 lint 流程，代码风格与相邻文件保持一致。

## PM 助手开发约定
- 配置、日志、定时任务相关请求默认带 `projectId`，避免跨项目串配置。
- 新增任务类型时需要同时更新：
  1. 后端任务枚举与默认提示词
  2. 前端任务开关与展示文案
  3. 定时触发与日志筛选

## 飞书集成开发约定
- 读写记录接口优先传 `projectId`，由后端按项目解析 `feishuAppToken`/`feishuTableId`。
- `projects` 模块字段调整后，前端 `ProjectItem`、Dashboard 编辑表单、Feishu API 参数需要同步。
- 处理飞书报错时优先排查：
  1. 应用权限（403 / 91403）
  2. 人员字段映射（`UserFieldConvFail`）
  3. 项目级 token/table 配置是否为空或错误

## 提交与 PR 规范
- 提交前缀建议：`feat:`、`fix:`、`refactor:`、`docs:`。
- PR 建议包含：
  - 变更摘要
  - 影响范围（前端/后端/数据库）
  - UI 截图（如有）
  - 迁移步骤（如涉及 Prisma）

## 安全与配置提示
- 环境变量通过 `.env` 管理，禁止提交密钥。
- 确保 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 与租户一致。
- Prisma 数据源为 PostgreSQL，必须正确设置 `DATABASE_URL`。
