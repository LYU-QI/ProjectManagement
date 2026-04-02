# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ProjectLVQI

项目管理平台，基于 NestJS 后端 + React 前端，PostgreSQL + Redis（docker-compose）。

## 开发命令

```bash
# 安装依赖（npm workspaces）
npm install

# 启动基础设施（PostgreSQL + Redis）
docker compose up -d

# 数据库
npm run -w backend prisma:generate
npm run -w backend prisma:migrate
npm run -w backend prisma:seed        # 创建 pm/lead/viewer 测试用户

# 启动
npm run dev                           # 同时启动后端（3000）和前端（5173）
npm run dev:backend
npm run dev:frontend

# 构建
npm run build
npm run -w backend build
npm run -w frontend build
```

## 技术栈

- **后端**：NestJS + Prisma ORM + PostgreSQL + Redis
- **前端**：React + TypeScript + Vite + Framer Motion + Lucide React
- **样式**：纯 CSS 变量 + Glassmorphism（不引入 Ant Design）

## 后端架构

**Base URL**：`http://localhost:3000/api/v1`

### 模块清单（`backend/src/modules/`）

| 模块 | 端点前缀 | 说明 |
|------|----------|------|
| `auth` | `/auth` | 登录（`/login`）、注册（`/register`） |
| `organizations` | `/organizations` | 组织 CRUD |
| `org-members` | `/org-members` | 组织成员管理 |
| `projects` | `/projects` | 项目 CRUD |
| `project-memberships` | `/project-memberships` | 项目成员与角色 |
| `requirements` | `/requirements` | 需求（draft→in_review→approved→planned→done） |
| `work-items` | `/work-items` | 工作项（Epic/Story/Task/Bug） |
| `costs` | `/cost-entries` | 成本条目（labor/outsource/cloud） |
| `worklogs` | `/worklogs` | 工时记录 |
| `schedules` | `/projects/:id/schedule` | 任务 + 里程碑 |
| `dependencies` | `/dependencies` | 任务依赖关系 |
| `milestone-board` | `/milestone-board` | 里程碑时间线视图 |
| `sprint` | `/sprints` | Sprint 管理 |
| `risks` | `/risks` | 风险与告警 |
| `dashboard` | `/dashboard` | 多项目健康指标 |
| `ai` | `/ai` | 对话 + 报告生成 |
| `pm-assistant` | `/pm-assistant` | 自动化 PM 作业（cron 调度） |
| `prd` | `/prd` | PRD 文档 |
| `wiki` | `/wiki` | 知识库页面 |
| `feishu` | `/feishu` | 飞书多维表格集成 |
| `feishu-users` | `/feishu-users` | 飞书用户同步 |
| `feishu-sso` | `/feishu-sso` | 飞书 SSO 登录 |
| `notifications` | `/notifications` | 通知已读/未读 |
| `audit-logs` | `/audit-logs` | 由 AuditInterceptor 自动写入 |
| `config` | `/config` | 运行时配置（数据库存储） |
| `users` | `/users` | 用户资料 |
| `departments` | `/departments` | 部门管理 |
| `testhub` | `/bugs`、`/test-cases`、`/test-plans` | 测试管理 |
| `webhooks` | `/webhooks` | Webhook 管理 |
| `automation` | `/automation` | 自动化规则引擎 |
| `api-keys` | `/api-keys` | API 密钥管理 |
| `smart-fill` | `/smart-fill` | AI 智能填充 |
| `plan` | `/plan` | 计划管理 |
| `cost-report` | `/cost-report` | 成本报表 |
| `monitoring` | `/monitoring` | 健康检查与指标 |
| `cache` | — | 缓存服务 |

### 横切关注点

- `AuditInterceptor`：自动记录所有非 GET 请求
- `JwtAuthGuard`：全局认证（`@Public()` 跳过）
- `OrgGuard`：组织上下文注入，从 JWT 解析 `orgId` 注入 request
- `RolesGuard`：基于 `UserRole` 的 `@Roles()` 装饰器鉴权
- `ApiKeyGuard` / `IpGuard` / `PlanGuard`：可选额外鉴权层
- `class-validator`：所有 DTO 全局校验
- **配置存储**：运行时配置（AI 密钥、飞书凭证等）通过 `ConfigService.get(key)` 读取，存于数据库 `Config` 表，不使用 `process.env`

### 认证与会话

- JWT 存储在 `localStorage` 的 `projectlvqi_token` 键下
- JWT payload 包含：`sub`（用户 ID）、`role`（UserRole）、`organizationId`（当前组织 ID）、`orgRole`（OrgRole）、`orgList`（组织列表）
- `POST /auth/register`：用户自注册，可选同时创建组织

## 两层角色模型

### 全局角色（UserRole）

- `super_admin` — 完全绕过所有权限检查
- `project_manager` — 全局 CRUD，跳过项目成员资格检查
- `member` — 可读可写
- `pm` / `lead` — 等同 member
- `viewer` — 只读

### 组织角色（OrgRole，按组织独立）

- `owner` — 组织所有者
- `admin` — 管理员
- `member` — 普通成员
- `viewer` — 只读

### 权限决策逻辑

- **后端 global 权限**（如 `@Roles('super_admin')`）→ 使用 `UserRole`
- **后端 org-scoped 权限**（如"只有 owner 能删除组织"）→ 在 service 层通过 `request['org'].orgRole` 判断
- **前端权限标志**（`canWrite`、`canManageUsers`、`canManageAdmin`）→ 使用 `OrgRole`（通过 `useOrgStore` 获取）

## 前端架构

单页 React 应用，入口 `frontend/src/App.tsx`。导航通过 `view` 状态（`ViewKey` 类型）驱动。

### 平台模式（`AstraeaLayout`）

- `workspace` — 所有用户可访问的项目视图
- `admin` — 由 `canAccessAdmin` 控制，基于 `OrgRole`

### 视图（`frontend/src/views/`）

| ViewKey | 文件 | 平台 |
|---------|------|------|
| `dashboard` | DashboardView | workspace |
| `requirements` | RequirementsView | workspace |
| `work-items` | WorkItemsView | workspace |
| `costs` | CostsView | workspace |
| `schedule` | ScheduleView | workspace |
| `resources` | ResourcesView | workspace |
| `risks` | RiskAlertsView + RiskCenterView | workspace |
| `ai` | AiView | workspace |
| `notifications` | NotificationsView | workspace |
| `feishu` | FeishuView | workspace |
| `pm-assistant` | PmAssistantView | workspace |
| `milestone-board` | MilestoneBoardView | workspace |
| `sprint` | SprintBoardView | workspace |
| `audit` | AuditView | admin |
| `settings` | SettingsView | admin |
| `project-access` | ProjectAccessView | admin |
| `org-members` | OrgMembersView | admin |
| `org-settings` | OrgSettingsView | admin |
| `feishu-users` | FeishuUsersView | admin |
| `wiki` | WikiView | workspace |
| `departments` | DepartmentsView | workspace |
| `test-plan` | TestPlanView | workspace |
| `bug` | BugView | workspace |
| `automation` | AutomationView | workspace |
| `api-keys` | ApiKeysView | workspace |
| `smart-fill` | SmartFillView | workspace |
| `webhook` | WebhookView | workspace |
| `cost-report` | CostReportView | workspace |
| `efficiency` | EfficiencyView | workspace |
| `plan-settings` | PlanSettingsView | admin |

### 关键文件

- `frontend/src/api/client.ts` — 基础 API 客户端，认证请求头注入
- `frontend/src/components/AstraeaLayout.tsx` — 应用外壳，侧边栏，主题切换，聊天机器人
- `frontend/src/components/chat/GlobalAiChatbot.tsx` — 可拖拽悬浮 AI 聊天机器人
- `frontend/src/types.ts` — 共享 TypeScript 类型
- `frontend/src/stores/orgStore.ts` — 组织状态（`activeOrgId`、`orgList` 含 `orgRole`）

### UI 主题系统

7 个可选主题：`light`（极光白）、`dark`（深海蓝）、`nebula`（星云紫）、`forest`（翠林绿）、`sunset`（落日橙）、`sakura`（樱花粉）、`metal`（金属黑）。

主题存储在 `localStorage` 的 `ui:theme` 键。

- `frontend/src/styles.css` — CSS 变量 token（每个主题的 `--color-*`、`--glass-*`）
- `frontend/src/styles/glass.css` — Glassmorphism 统一样式；新增组件 CSS 类直接写入此文件

## 重要约定

- **日期**：使用 `YYYY-MM-DD` 字符串，不使用 Date 对象
- **货币**：人民币（CNY）；人力成本 = `工时 × 时薪`
- **审计日志**：`AuditInterceptor` 自动触发，勿手动写
- **飞书**：所有飞书调用通过 `FeishuService`，密钥来自 `ConfigService`
- **项目访问控制**：controller 中调用 `accessService.assertProjectAccess()`
- **配置**：运行时配置用 `ConfigService.get(key)`，不用 `process.env`
- **样式**：新增 CSS 类写入 `glass.css`，不另起文件
