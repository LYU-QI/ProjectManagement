# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此代码库中工作时提供指导。

## 项目概览

ProjectLVQI（天枢系统 / Astraea）是面向中小型软件团队的多项目管理系统，提供需求、成本、进度、PM 自动化及 AI 驱动项目洞察的统一管理。

**技术栈：**
- **后端**：NestJS + Prisma ORM + PostgreSQL + Redis
- **前端**：React + TypeScript + Vite + Framer Motion
- **基础设施**：Docker Compose
- **AI**：OpenAI 兼容 API
- **集成**：飞书（Lark）API，支持飞书卡片消息

## 开发命令

```bash
# 安装依赖（npm workspaces）
npm install

# 启动基础设施（PostgreSQL + Redis）
docker compose up -d

# 数据库初始化
npm run -w backend prisma:generate
npm run -w backend prisma:migrate
npm run -w backend prisma:seed        # 创建 pm/lead/viewer 测试用户

# 启动开发服务器
npm run dev                            # 同时启动后端（3000）和前端（5173）
npm run dev:backend
npm run dev:frontend

# 构建
npm run build
npm run -w backend build
npm run -w frontend build
```

## 认证与授权

**测试账号**（通过 `backend/prisma/seed.ts` 初始化）：
- `pm / 123456` — 完整权限
- `lead / 123456` — 完整权限
- `viewer / 123456` — 只读权限

**角色层级：**
- `super_admin` — 全局访问，绕过所有项目级权限检查
- `project_director` / `project_manager` / `pm` / `lead` — 完整 CRUD 权限
- `viewer` — 只读权限

**项目级访问控制**（由 `backend/src/modules/access/` 中的 `AccessService` 执行）：
- 用户拥有项目所有权 **或** 存在对应 `ProjectMembership` 记录时，方可访问该项目
- `super_admin` 角色完全跳过成员资格检查
- 在 controller 中使用 `accessService.assertProjectAccess(actor, projectId)` 进行鉴权
- JWT 存储在 `localStorage` 的 `projectlvqi_token` 键下
- 公开端点使用 `@Public()` 装饰器

## 后端架构

**Base URL**：`http://localhost:3000/api/v1`

模块位于 `backend/src/modules/`：

| 模块 | 端点 | 说明 |
|------|------|------|
| `auth` | `/auth/login` | JWT 签发 |
| `projects` | `/projects` | 项目 CRUD；`alias` 字段供聊天机器人使用 |
| `requirements` | `/requirements` | 状态：draft→in_review→approved→planned→done |
| `costs` | `/cost-entries` | 类型：labor/outsource/cloud |
| `worklogs` | `/worklogs` | 工时 × 时薪 → 人力成本 |
| `schedules` | `/projects/:id/schedule` | 任务 + 里程碑 |
| `risks` | `/risks`、`/projects/:id/risks` | 规则 + 告警 |
| `dashboard` | `/dashboard/overview` | 多项目健康指标 |
| `ai` | `/ai/*` | 对话 + 报告接口 |
| `pm-assistant` | `/pm-assistant/*` | 自动化 PM 作业（见下文） |
| `prd` | `/prd/*` | PRD 文档管理 |
| `project-memberships` | `/project-memberships` | 项目级角色分配 |
| `access` | （仅 Service） | 项目访问控制，被其他 controller 调用 |
| `feishu` | `/feishu` | 飞书多维表格记录 CRUD |
| `feishu-users` | `/feishu-users` | 飞书用户同步 |
| `notifications` | `/notifications` | 已读/未读通知 |
| `audit-logs` | `/audit-logs` | 由 `AuditInterceptor` 自动写入 |
| `config` | `/config` | 基于数据库的系统配置（飞书密钥、AI 地址等） |
| `users` | `/users` | 用户资料 |

**横切关注点：**
- `AuditInterceptor` 自动记录所有非 GET 请求
- 全局 `JwtAuthGuard` 保护所有路由，除 `/health` 和 `/auth/login` 外
- 全局使用 `class-validator` DTO 进行参数校验

## PM 助理模块

PM 助理（`backend/src/modules/pm-assistant/`）通过 cron 定时执行 12 种自动化作业：

**作业 ID**：`morning-briefing`、`meeting-materials`、`risk-alerts`、`overdue-reminder`、`milestone-reminder`、`blocked-alert`、`resource-load`、`progress-board`、`trend-predict`、`weekly-agenda`、`daily-report`、`weekly-report`

**调度机制**：`PmAssistantScheduler` 注册 cron 作业（默认时区：`Asia/Shanghai`），配置持久化在 `PmAssistantProjectSchedule` 数据库表中，支持按项目单独配置并可通过 API 覆盖。

**执行流程**：读取飞书任务记录 → 聚合数据 → 调用 LLM 生成 AI 摘要 → 向配置的 `feishuChatIds` 发送飞书卡片消息。

**API 端点**（`/pm-assistant/*`）：`GET /jobs`、`POST /run`、`GET /logs`、`GET /schedules`、`PUT /schedules`、`GET /job-configs`、`PUT /job-configs`、`GET /prompts`、`PUT /prompts`

## 前端架构

应用为单页 React 应用，入口为 `frontend/src/App.tsx`。导航通过 `view` 状态（类型 `ViewKey`）驱动，在 `AstraeaLayout` 内渲染对应视图。

**平台模式**（在 `AstraeaLayout` 中）：
- `workspace` — 所有用户可访问的项目视图
- `admin` — 仅管理员可访问；由 `canAccessAdmin` 控制（pm/lead 角色）

**视图列表**（`frontend/src/views/`）：

| ViewKey | 文件 | 平台 |
|---------|------|------|
| `dashboard` | DashboardView | workspace |
| `requirements` | RequirementsView | workspace |
| `costs` | CostsView | workspace |
| `schedule` | ScheduleView | workspace |
| `resources` | ResourcesView | workspace |
| `risks` | RiskAlertsView + RiskCenterView | workspace |
| `ai` | AiView | workspace |
| `notifications` | NotificationsView | workspace |
| `feishu` | FeishuView | workspace |
| `pm-assistant` | PmAssistantView | workspace |
| `milestone-board` | MilestoneBoardView | workspace |
| `audit` | AuditView | admin |
| `settings` | SettingsView | admin |
| `project-access` | ProjectAccessView | admin |
| `feishu-users` | FeishuUsersView | admin |

**关键前端文件：**
- `frontend/src/api/client.ts` — 基础 API 客户端，含认证请求头注入
- `frontend/src/components/AstraeaLayout.tsx` — 应用外壳：侧边栏、平台切换、主题切换、聊天机器人
- `frontend/src/components/chat/GlobalAiChatbot.tsx` — 可拖拽悬浮 AI 聊天机器人（FAB + 面板）
- `frontend/src/types.ts` — 共享 TypeScript 类型定义
- `frontend/src/feishuConfig.ts` — 飞书表单字段配置

## UI 主题系统

**可选主题**（`ThemeMode` 类型，定义于 `AstraeaLayout.tsx`）：

| 值 | 名称 | 风格 |
|----|------|------|
| `light` | 极光白 | 浅色 |
| `dark` | 深海蓝 | 深色 |
| `nebula` | 星云紫 | 紫调 |
| `forest` | 翠林绿 | 绿调 |
| `sunset` | 落日橙 | 暖橙 |
| `sakura` | 樱花粉 | 粉调 |
| `metal` | 金属黑 | 深灰 |

**持久化**：主题选择存储在 `localStorage` 的 `ui:theme` 键，登出不会清除，下次登录自动恢复。

**切换入口**：侧边栏左下角用户卡片点击后弹出主题选择下拉菜单（所有角色均可使用），无需进入管理平台设置页。

**样式文件：**
- `frontend/src/styles.css` — CSS 变量 token（每个主题定义完整的 `--color-*`、`--glass-*` 变量）、Aurora 背景动画
- `frontend/src/styles/glass.css` — 液态玻璃（Glassmorphism）统一样式：卡片、输入框、按钮、侧边栏、弹出菜单；使用 `backdrop-filter`、多层 `box-shadow`、`color-mix()` 实现跨主题适配
- 新增组件 CSS 类直接写入 `glass.css`，勿另起独立文件

## 数据库 Schema 重点

在标准项目管理模型之外的关键新增字段/表：

- `Project.alias` — 唯一短名称，供聊天机器人按名称识别项目
- `Project.feishuChatIds` — 逗号分隔的飞书群 ID，用于 PM 助理推送消息
- `ProjectMembership` — 将用户与项目关联，带有 `ProjectRole`（director/manager/member/viewer）
- `PmAssistantLog` — PM 作业执行日志（状态：success/failed/dry-run/skipped）
- `PmAssistantProjectJobConfig` — 按项目配置的作业启用/禁用设置
- `PmAssistantProjectSchedule` — 按项目配置的 cron 覆盖
- `PmAssistantProjectPrompt` — 按项目配置的 LLM 提示词自定义
- `PrdDocument` — 挂载在项目下的 PRD 文档

## 重要约定

- **日期**：使用 `YYYY-MM-DD` 字符串，不使用 Date 对象
- **货币**：人民币（CNY）；人力成本 = `工时 × 时薪`
- **审计日志**：`AuditInterceptor` 在所有数据变更时自动触发，勿手动写日志
- **飞书**：所有飞书 API 调用均通过 `FeishuService`；密钥来自 `ConfigService`
- **项目访问控制**：在所有获取项目级数据的 controller 中调用 `accessService.assertProjectAccess()`
- **配置值**：运行时可配置的键（存储在数据库中）使用 `ConfigService.get(key)`，而非 `process.env`
