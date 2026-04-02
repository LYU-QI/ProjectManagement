# ProjectLVQI 多租户改进计划与开发路线图

**文档版本**：V1.0  
**编制日期**：2026年3月  
**适用规模**：50+ 人团队，多租户协同场景  
**对标产品**：PingCode

---

## 目录

1. [项目背景与目标](#一项目背景与目标)
2. [改进计划详述](#二改进计划详述)
3. [数据库 Schema 改造方案](#三数据库-schema-改造方案)
4. [技术架构演进](#四技术架构演进)
5. [开发计划与资源估算](#五开发计划与资源估算)
6. [风险管控](#六风险管控)
7. [与 PingCode 功能对比](#七与-pingcode-功能对比)
8. [附录](#八附录)

---

## 一、项目背景与目标

### 1.1 现状分析

ProjectLVQI 当前为**单组织单体架构**，基于 NestJS + PostgreSQL + Redis 构建，已具备以下核心能力：

- 成本核算（人力 / 外包 / 云资源三类，工时 × 时薪自动计算）
- 12 种 AI PM 自动化作业，深度对接飞书推送
- 需求全生命周期管理（draft → in_review → approved → planned → done）
- 项目级双层权限（全局角色 + ProjectMembership）
- 风险告警、里程碑看板、PRD 文档管理

**当前系统的核心瓶颈：**

- 缺乏 Organization 层，无法支持多部门 / 多团队数据隔离
- 所有配置（飞书密钥、AI 接口等）为全局单份，不支持多租户独立配置
- 缺少测试管理、Wiki 知识库等研发全链路模块
- 单体 cron 调度在多租户后存在超载风险

### 1.2 改造目标

以 PingCode 为对标，将 ProjectLVQI 升级为支持 50+ 人团队、多租户协同的企业级研发管理平台，同时保留并深化以下差异化优势：

| 差异化优势 | 说明 |
|-----------|------|
| 成本核算 | PingCode 无此模块；ProjectLVQI 三类成本 + 工时计算是核心护城河 |
| AI PM 助理 | PingCode AI 为后期补充，不够深；ProjectLVQI 12 种自动化作业 + 可配置提示词 |
| 飞书一等公民 | PingCode 将飞书视为第三方集成；ProjectLVQI 飞书是原生数据源 |

### 1.3 总体规划概览

| 阶段 | 名称 | 周期 | 核心目标 |
|------|------|------|---------|
| Phase 1 | 多租户地基 | 第 1–6 周 | 引入 Organization 层，全面数据隔离 |
| Phase 2 | 功能补齐 | 第 7–14 周 | 测试管理、Wiki、Sprint、效能度量 |
| Phase 3 | 企业级能力 | 第 15–22 周 | SSO、规则引擎、Webhook、安全策略 |
| Phase 4 | 差异化深化 | 第 23–28 周 | AI 多租户化、成本汇总、智能 PRD 生成 |

---

## 二、改进计划详述

### Phase 1：多租户地基（第 1–6 周）

> **最高优先级。所有后续功能的前提，必须优先完成。**  
> 核心工作：改造数据库 Schema、认证体系、数据隔离层。不做完这一步，其他改造无从谈起。

#### 任务 1：Organization 表引入 `[破坏性改动]`

**目标**：建立租户主表，作为所有数据隔离的基础。

**具体工作**：
- 新增 `Organization` 模型，字段包括：`id`、`slug`（唯一标识）、`name`、`plan`（free/pro/enterprise）、`maxMembers`、`feishuConfig`
- 所有现有表（Project / User / Config / AuditLog / Requirement / CostEntry / Risk 等）追加 `organizationId` 外键
- 编写数据迁移脚本，将存量数据归入 `default org`
- 使用 `prisma migrate --create-only` 审查 SQL 后再手动执行，禁止直接 `migrate deploy`

**涉及文件**：
- `backend/prisma/schema.prisma` — 新增 Organization 模型，修改全部现有模型
- `backend/prisma/migrations/` — 新建迁移文件
- `backend/prisma/seed.ts` — 新增 default org 的 seed 数据

---

#### 任务 2：OrganizationMember 权限层 `[破坏性改动]`

**目标**：将现有单层权限升级为"组织级 + 项目级"双层权限体系。

**具体工作**：
- 新增 `OrgMember` 表：`userId`、`organizationId`、`orgRole`（owner / admin / member / viewer）
- 改造 `backend/src/modules/access/AccessService`：从"项目级检查"扩展为"先检查 org 成员资格，再检查项目权限"
- `JwtPayload` 新增 `organizationId`、`orgRole` 字段
- 现有 `super_admin` 角色保留，继续绕过所有 org/project 检查

**权限层级设计**：

```
super_admin（平台级）
  └─ OrgMember.orgRole（组织级：owner / admin / member / viewer）
       └─ ProjectMembership.role（项目级：director / manager / member / viewer）
```

---

#### 任务 3：JWT 多租户上下文 `[扩展]`

**目标**：让每个请求携带明确的租户身份，后端可安全识别当前操作属于哪个 org。

**具体工作**：
- `login` 接口返回用户所属 `orgList`（含 orgId、orgName、orgRole）
- 前端 `localStorage` 新增 `activeOrgId` 存储
- 所有 API 请求 Header 携带 `X-Org-Id: <organizationId>`
- 后端 `JwtAuthGuard` 读取 Header，注入 `req.org` 上下文对象
- org 切换时前端更新 `activeOrgId` 并清空 project 级缓存状态

**改造后 JWT Payload**：

```typescript
// 改造前
{ userId: string, role: GlobalRole }

// 改造后
{
  userId: string,
  role: GlobalRole,
  organizationId: string,
  orgRole: OrgRole,
  orgList: Array<{ orgId: string, orgName: string, orgRole: OrgRole }>
}
```

---

#### 任务 4：全局 OrgGuard 中间件 `[新增]`

**目标**：从框架层面强制数据隔离，防止业务代码漏写过滤条件。

**具体工作**：
- 新增 `backend/src/guards/org.guard.ts`：全局 NestJS Guard，校验用户是否属于 `X-Org-Id` 指定的 org
- 新增 Prisma 中间件（`backend/src/prisma/org-filter.middleware.ts`）：拦截所有 `findMany` / `findFirst` / `update` / `delete`，自动追加 `where.organizationId = currentOrgId`
- `super_admin` 角色通过 `bypassOrgFilter: true` 标记跳过中间件
- 公开端点（`@Public()` 装饰的路由）不受 OrgGuard 约束

**新增模块**：`backend/src/modules/organizations/`（organizationsController、organizationsService、organizationsModule）

---

#### 任务 5：组织管理 API + 前端 `[新增]`

**后端 API**（Base: `/api/v1/organizations`）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取当前用户的 org 列表 |
| POST | `/` | 创建新 org（super_admin） |
| GET | `/:id` | 获取 org 详情 |
| PATCH | `/:id` | 更新 org 信息（owner/admin） |
| GET | `/:id/members` | 获取成员列表 |
| POST | `/:id/members/invite` | 邀请成员（发送邀请链接） |
| PATCH | `/:id/members/:userId` | 变更成员角色 |
| DELETE | `/:id/members/:userId` | 移除成员 |

**前端新增**：
- `AstraeaLayout` 顶部：组织切换器（Org Switcher Dropdown）
- 新增 ViewKey `org-settings`：组织设置页（基本信息、飞书配置、配额用量）
- 新增 ViewKey `org-members`：成员管理表格（邀请、角色变更、移除）

---

#### 任务 6：ConfigService 租户化 `[扩展]`

**目标**：飞书密钥、AI 接口地址等运行时配置从全局单份变为每租户独立。

**具体工作**：
- `Config` 表追加 `organizationId`（可为 null，null 代表全局默认值）
- `ConfigService.get(key)` 改为 `ConfigService.get(key, orgId)`：优先取租户配置，fallback 到全局默认
- 新增 Redis 缓存层：`config:{orgId}:{key}` 格式，TTL 5 分钟
- 配置值（AppSecret 等敏感字段）统一 AES-256 加密存储

---

### Phase 2：功能补齐（第 7–14 周）

> 补充对标 PingCode 的核心功能模块。基于 Phase 1 完成的租户隔离，这些模块天然具备多租户能力。

#### 任务 1：测试管理模块（Testhub） `[新增]`

**目标**：打通需求→开发→测试→缺陷的研发全链路。

**数据模型**：

```prisma
model TestCase {
  id             String   @id
  organizationId String
  projectId      String
  requirementId  String?  // 关联需求，实现追溯
  title          String
  steps          Json     // 测试步骤
  expectedResult String
  status         TestCaseStatus  // draft / ready / deprecated
}

model TestPlan {
  id             String   @id
  organizationId String
  projectId      String
  name           String
  startDate      String
  endDate        String
  cases          TestPlanCase[]
}

model Bug {
  id             String    @id
  organizationId String
  projectId      String
  requirementId  String?   // 关联需求
  title          String
  severity       BugSeverity   // critical / major / minor / trivial
  status         BugStatus     // open / in_progress / resolved / closed / rejected
  assigneeId     String?
  reporterId     String
}
```

**后端**：新增 `backend/src/modules/testhub/` 模块，含 TestCase / TestPlan / Bug 三个子模块

**前端**：
- 新增 `BugView`：缺陷列表，支持按项目/需求/严重级别过滤
- 新增 `TestPlanView`：测试计划执行，用例通过/失败标记
- `RequirementsView` 增加"关联缺陷"角标

---

#### 任务 2：Wiki 知识库模块 `[新增]`

**目标**：提供团队知识沉淀和协同编辑能力，弥补当前仅有 PRD 的不足。

**数据模型**：

```prisma
model WikiPage {
  id             String    @id
  organizationId String
  projectId      String?   // null 代表组织级 Wiki
  parentId       String?   // 树形结构
  title          String
  content        Json      // MDX / Tiptap JSON 格式
  isPublished    Boolean   @default(false)
  createdBy      String
  updatedBy      String
  children       WikiPage[] @relation("WikiTree")
  parent         WikiPage?  @relation("WikiTree", fields: [parentId], references: [id])
}
```

**后端**：在现有 `prd` 模块基础上扩展，或新建 `wiki` 模块；API 路径：`/api/v1/wiki`

**前端**：
- 新增 `WikiView`：左侧树形导航 + 右侧富文本编辑区
- 支持页面层级拖拽排序
- 与 `RequirementsView`、`ProjectView` 双向关联入口

---

#### 任务 3：Sprint / 迭代管理 `[新增]`

**目标**：支持敏捷迭代模式，与现有需求管理无缝集成。

**数据模型**：

```prisma
model Sprint {
  id             String   @id
  organizationId String
  projectId      String
  name           String
  goal           String?
  startDate      String
  endDate        String
  status         SprintStatus  // planning / active / completed
  requirements   Requirement[] // 绑定需求
}
```

**后端**：新增 `backend/src/modules/sprints/` 模块；`Requirement` 表追加 `sprintId` 可空外键

**前端**：
- 新增 `SprintBoardView`：上方 Backlog 区（未分配 Sprint 的需求）+ 下方当前 Sprint 看板
- Sprint 创建/归档操作
- 复用现有 `RequirementsView` 的需求卡片组件

---

#### 任务 4：效能度量仪表盘 `[扩展]`

**目标**：基于现有数据资产，构建量化的研发效能视图。

**新增指标**（基于现有 worklogs + requirements + costs + bugs 数据）：

| 指标 | 计算方式 | 数据来源 |
|------|---------|---------|
| 需求交付周期 | done 时间 - created 时间（天） | Requirement |
| 人效比 | 总成本 / 已完成需求数 | CostEntry + Requirement |
| 缺陷密度 | Bug 数 / 已完成需求数 | Bug + Requirement |
| Sprint 燃尽图 | 每日剩余工作量 | Sprint + Requirement |
| 工时趋势 | 按周聚合工时 | WorkLog |

**后端**：新增 `/api/v1/dashboard/efficiency` 端点，返回上述指标数据

**前端**：在现有 `DashboardView` 新增效能 Tab，使用折线图/柱状图展示趋势数据

---

### Phase 3：企业级能力（第 15–22 周）

> 对标 PingCode 企业版的安全与集成能力，满足 50 人团队的合规与管控需求。

#### 任务 1：SSO / 飞书一键登录 `[扩展]`

**目标**：消除手动账号管理，飞书组织成员直接登录。

**飞书 OAuth 流程**：

```
用户点击"飞书登录"
  → 跳转飞书授权页（携带 app_id + redirect_uri）
  → 用户授权 → 飞书回调 code
  → 后端用 code 换取 user_access_token
  → 调用飞书接口获取 openId / unionId / user_info
  → 匹配系统 User（按 feishuOpenId 字段）
  → 存在则直接登录，不存在则自动注册并加入对应 org
  → 颁发系统 JWT
```

**数据改造**：`User` 表追加 `feishuOpenId`、`feishuUnionId` 字段

**后端**：在现有 `feishu` 模块中新增 `/feishu/oauth/callback` 端点；`/auth/login` 保留密码登录兼容

**可选扩展**：支持 LDAP（引入 `ldapjs`），为企业对接 AD 域打基础

---

#### 任务 2：组织架构同步 `[扩展]`

**目标**：飞书部门树自动同步为系统组织结构，支持按部门分配权限。

**数据模型**：

```prisma
model Department {
  id              String       @id
  organizationId  String
  name            String
  feishuDeptId    String       @unique
  parentId        String?
  parent          Department?  @relation("DeptTree", fields: [parentId], references: [id])
  children        Department[] @relation("DeptTree")
  members         OrgMember[]
}
```

**同步策略**：
- 首次全量同步：拉取飞书部门树 → 写入 Department 表
- 增量同步：监听飞书部门变更事件 Webhook → 局部更新
- `FeishuUsersView` 扩展为"飞书通讯录同步"页面，展示同步状态和上次同步时间

---

#### 任务 3：Plan 订阅 & 配额管理 `[新增]`

**目标**：为未来商业化和多客户场景预留配额控制能力。

**Plan 定义**：

```typescript
enum Plan {
  FREE       // 成员上限 25，项目上限 5，存储 1GB
  PRO        // 成员上限 100，项目上限 50，存储 20GB
  ENTERPRISE // 无限制
}
```

**实现**：
- `Organization` 表追加 `plan`、`memberCount`、`projectCount`、`storageUsed` 字段
- 新增 `PlanGuard`：在创建成员/项目等关键操作前校验配额
- `SettingsView` 新增"套餐与用量"Tab，展示当前用量 vs 配额

---

#### 任务 4：安全策略管理 `[新增]`

**数据模型**：

```prisma
model OrgSecurityPolicy {
  id             String   @id
  organizationId String   @unique
  ipWhitelist    String[] // 允许的 IP 段，空数组代表不限制
  passwordExpiry Int?     // 密码过期天数，null 代表不过期
  totpRequired   Boolean  @default(false)  // 是否强制二次验证
  sessionTimeout Int      @default(7200)   // Session 超时秒数
}
```

**功能清单**：
- IP 白名单：`JwtAuthGuard` 在验证 Token 后额外校验 `req.ip`
- 二次验证（TOTP）：引入 `otplib`，用户绑定 Authenticator App
- 审计日志导出：现有 `AuditLog` 表支持按时间/操作类型过滤后导出 CSV/Excel
- 操作日志可视化：在 `AuditView` 增加时间轴视图和操作人统计图表

---

#### 任务 5：自动化 Flow（规则引擎） `[新增]`

**目标**：类 PingCode Flow，让重复性 PM 操作自动执行。

**数据模型**：

```prisma
model AutomationRule {
  id             String   @id
  organizationId String
  projectId      String?  // null 代表组织级规则
  name           String
  enabled        Boolean  @default(true)
  trigger        Json     // { type: 'field_change' | 'time', config: {...} }
  conditions     Json[]   // [{ field, operator, value }]
  actions        Json[]   // [{ type: 'update_field' | 'notify_feishu' | 'create_task', config: {...} }]
}
```

**支持的触发器**：
- `field_change`：需求/任务字段变更（状态、负责人、优先级等）
- `time_reached`：到达指定日期（如里程碑前 3 天）
- `condition_met`：复合条件满足（如成本超预算 80%）

**支持的动作**：
- `update_field`：自动修改工作项字段
- `notify_feishu`：发送飞书卡片消息到指定群
- `create_task`：自动创建子任务
- `assign_member`：自动分配负责人

**后端**：新增 `backend/src/modules/automation/` 模块；`AutomationEngine` 在 `AuditInterceptor` 后执行，避免循环触发

---

#### 任务 6：Webhook & 开放 API `[新增]`

**目标**：开放标准集成接口，为接入 Git / CI/CD 等工具链打基础。

**数据模型**：

```prisma
model OrgWebhook {
  id             String   @id
  organizationId String
  url            String
  secret         String   // HMAC 签名密钥
  events         String[] // 订阅的事件列表
  enabled        Boolean  @default(true)
}

model OrgApiKey {
  id             String   @id
  organizationId String
  name           String
  keyHash        String   @unique  // SHA-256 哈希存储
  scopes         String[]
  lastUsedAt     DateTime?
  expiresAt      DateTime?
}
```

**支持的事件**（首批）：
- `project.created` / `project.updated`
- `requirement.status_changed`
- `bug.created` / `bug.resolved`
- `milestone.reached`
- `cost.budget_exceeded`

**API 路径**：`/api/v1/webhooks`（CRUD）、`/api/v1/api-keys`（管理）

---

### Phase 4：差异化深化（第 23–28 周）

> 巩固相对 PingCode 的独特优势，形成差异化竞争壁垒。PingCode 没有的，要做深做强。

#### 任务 1：AI PM 助理多租户化 `[扩展]`

**目标**：现有 12 种 PM 作业从全局单例改为每租户独立运行。

**改造点**：
- `PmAssistantProjectSchedule` / `PmAssistantProjectJobConfig` / `PmAssistantProjectPrompt` 追加 `organizationId`
- `PmAssistantScheduler` 启动时按 org 分组注册 cron，而非全局注册
- 将 PM 助理迁移至 BullMQ 队列：每个作业实例为一条 Job，Worker 并发执行
- AI 调用费用按 org 计量（`AiUsageLog` 表记录 token 消耗）
- 提示词模板（`PmAssistantProjectPrompt`）支持 org 级别 fallback：租户自定义 → 系统默认

**12 种作业租户化改造清单**：

| 作业 ID | 改造要点 |
|---------|---------|
| `morning-briefing` | 每 org 独立触发时间（考虑时区） |
| `meeting-materials` | 飞书群 ID 从租户 Config 读取 |
| `risk-alerts` | 风险规则按 org 隔离 |
| `weekly-report` | LLM 提示词支持租户自定义 |
| 其余 8 种 | 统一追加 organizationId 过滤 |

---

#### 任务 2：成本核算多项目集 `[扩展]`

**目标**：从单项目成本追踪升级为组织级成本分析平台。

**新增功能**：

1. **组织级成本汇总**：`/api/v1/organizations/:id/cost-summary`，返回各项目成本横向对比
2. **预算管理**：`Project` 表追加 `budget` 字段；`CostEntry` 累计时实时计算消耗比例
3. **超支预警**：成本占预算 80% / 100% 时触发飞书通知；与 Phase 3 的 AutomationEngine 集成
4. **成本报告导出**：按租户/项目/时间段生成 Excel 报告（引入 `exceljs`）
5. **成本趋势图**：`CostsView` 新增折线图，展示月度/季度人力成本趋势

---

#### 任务 3：AI 智能填报 & PRD 生成 `[新增]`

**目标**：用 AI 辅助 PM 的日常创作，深化 AI 与业务场景的融合。

**功能清单**：

| 功能 | 触发方式 | 实现说明 |
|------|---------|---------|
| 需求智能填报 | 输入一句话描述 → AI 生成完整需求 | LLM 输出：title、description、acceptanceCriteria、priority |
| PRD 草稿生成 | 从需求列表一键生成 | 调用现有 `/prd` 模块，LLM 生成结构化 MDX 内容 |
| 高风险需求识别 | 需求创建/更新时后台分析 | LLM 判断风险等级 → 自动写入 Risk 模块 |
| AI 周报增强 | 现有 `weekly-report` 作业扩展 | 加入成本数据 + 缺陷数据，摘要更全面 |
| 智能任务拆分 | 从需求自动生成子任务 | LLM 输出任务列表 → 写入 Schedule 模块 |

**后端**：在现有 `/ai` 模块下新增子路由，复用 `AiService` 的 LLM 调用链路

---

#### 任务 4：移动端 / PWA `[可选]`

**目标**：满足 50 人团队的移动端使用需求。

**实现方案**：
- 前端 React 配置 PWA Manifest + Service Worker（使用 `vite-plugin-pwa`）
- 飞书消息卡片中的链接支持深链（`projectlvqi://requirement/:id`）直接跳转对应工作项
- 核心视图响应式适配（Dashboard、需求列表、通知中心优先）
- 现有 `desktop/schema.desktop.prisma` 独立 Schema 保留，不与移动端混用

---

## 三、数据库 Schema 改造方案

### 3.1 核心改造原则

- 所有业务表追加 `organizationId` 外键，作为租户隔离的基础字段
- 存量数据迁移为 `default org`，迁移脚本须在 staging 环境验证后执行
- 使用 `prisma migrate --create-only` 审查 SQL 再手动执行，避免自动迁移风险
- Prisma 中间件自动注入 `organizationId` 过滤条件，防止漏写 WHERE 子句

### 3.2 新增核心表

| 表名 | 关键字段 | 说明 |
|------|---------|------|
| `Organization` | id, slug, name, plan, maxMembers | 租户主表，slug 唯一标识，plan 控制配额 |
| `OrgMember` | userId, organizationId, orgRole | 组织成员表，orgRole: owner/admin/member/viewer |
| `Department` | id, orgId, parentId, feishuDeptId | 部门树，同步自飞书通讯录 |
| `OrgSecurityPolicy` | orgId, ipWhitelist, totpRequired | 安全策略，IP 白名单 + 二次验证配置 |
| `OrgApiKey` | orgId, keyHash, name, scopes | 开放 API Key，按租户管理 |
| `OrgWebhook` | orgId, url, secret, events | Webhook 订阅配置 |
| `AutomationRule` | orgId, trigger, conditions, actions | 自动化规则引擎 |
| `Sprint` | projectId, orgId, startDate, endDate, goal | 迭代/Sprint 管理 |
| `WikiPage` | id, projectId, orgId, parentId, content | Wiki 知识库，树形结构 |
| `TestCase` | id, projectId, orgId, requirementId | 测试用例，关联需求实现追溯 |
| `Bug` | id, projectId, orgId, requirementId, status | 缺陷管理，status 状态机 |
| `AiUsageLog` | orgId, jobId, tokenInput, tokenOutput | AI 调用费用按租户计量 |

### 3.3 现有表改造清单

| 现有表 | 改造动作 | 注意事项 |
|--------|---------|---------|
| `Project` | 追加 `organizationId` FK | 现有数据归入 default org；alias 字段保留 |
| `User` | 追加 `feishuOpenId`、`feishuUnionId`、`defaultOrgId` | orgRole 移至 OrgMember 表，不再存 User.role |
| `Config` | 追加 `organizationId`（可 null） | null 代表全局默认；租户配置优先于全局 |
| `AuditLog` | 追加 `organizationId` | 便于按租户过滤和导出审计日志 |
| `PmAssistantProjectSchedule` | 追加 `organizationId` | cron 作业按租户独立调度 |
| `PmAssistantProjectJobConfig` | 追加 `organizationId` | 作业启用/禁用按租户配置 |
| `PmAssistantProjectPrompt` | 追加 `organizationId` | LLM 提示词按租户自定义 |
| `Requirement` | 追加 `sprintId`（可空）| 绑定 Sprint；通过 Project 级联 org |
| `ProjectMembership` | 追加 `organizationId` | 加速查询，避免 JOIN |
| `PrdDocument` | 追加 `organizationId` | 后续合并入 WikiPage 或保持独立 |

### 3.4 Schema 改造对比示意

```prisma
// ── 改造前 ──────────────────────────────
model Project {
  id      String
  name    String
  alias   String? @unique
  members ProjectMembership[]
  // 无 org 概念
}

model User {
  id   String
  role Role   // 全局角色，无组织概念
}

// ── 改造后 ──────────────────────────────
model Organization {
  id         String    @id @default(cuid())
  slug       String    @unique
  name       String
  plan       Plan      @default(FREE)
  maxMembers Int       @default(25)
  members    OrgMember[]
  projects   Project[]
  configs    Config[]
}

model OrgMember {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  orgRole        OrgRole  // owner / admin / member / viewer
  departmentId   String?
  user           User         @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])
  @@unique([userId, organizationId])
}

model Project {
  id             String       @id @default(cuid())
  organizationId String                        // ← 新增
  name           String
  alias          String?      @unique
  org            Organization @relation(fields: [organizationId], references: [id])
  members        ProjectMembership[]
}
```

---

## 四、技术架构演进

### 4.1 认证与授权体系升级

**三层权限模型**：

```
┌─────────────────────────────────────────┐
│  Layer 1：平台级（super_admin）           │
│  绕过所有 org/project 检查               │
├─────────────────────────────────────────┤
│  Layer 2：组织级（OrgMember.orgRole）    │
│  OrgGuard 校验用户是否属于当前 org       │
│  orgRole: owner / admin / member / viewer│
├─────────────────────────────────────────┤
│  Layer 3：项目级（ProjectMembership）    │
│  AccessService.assertProjectAccess()     │
│  role: director / manager / member / viewer│
└─────────────────────────────────────────┘
```

### 4.2 OrgGuard 实现要点

```typescript
// backend/src/guards/org.guard.ts
@Injectable()
export class OrgGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;           // 由 JwtAuthGuard 注入
    const orgId = request.headers['x-org-id'];

    // super_admin 跳过
    if (user.role === 'super_admin') return true;

    // 校验用户是否属于该 org
    const membership = await this.orgMemberService.findOne(user.userId, orgId);
    if (!membership) throw new ForbiddenException('Not a member of this organization');

    request.org = { id: orgId, role: membership.orgRole };
    return true;
  }
}
```

### 4.3 Prisma 中间件自动注入

```typescript
// backend/src/prisma/org-filter.middleware.ts
prisma.$use(async (params, next) => {
  const orgId = AsyncLocalStorage.getStore()?.organizationId;
  const bypass = AsyncLocalStorage.getStore()?.bypassOrgFilter;

  if (orgId && !bypass) {
    const targetModels = ['Project', 'Requirement', 'CostEntry', 'Bug', 'WikiPage', /* ... */];
    if (targetModels.includes(params.model)) {
      if (['findMany', 'findFirst', 'count'].includes(params.action)) {
        params.args.where = { ...params.args.where, organizationId: orgId };
      }
    }
  }
  return next(params);
});
```

### 4.4 PM 助理调度架构升级

**问题**：多租户后 cron 作业数量 = 租户数 × 12，单实例 NestJS Scheduler 超载风险高。

**方案**：引入 BullMQ 队列

```
PmAssistantScheduler（轻量 cron）
  │  每分钟扫描需要执行的作业
  ▼
BullMQ Queue（pm-assistant）
  │  按 orgId + jobId 入队
  ▼
PmAssistantWorker（独立进程，可水平扩展）
  │  读取飞书任务 → 聚合数据 → 调用 LLM → 推送飞书
  ▼
AiUsageLog（记录每次调用的 token 消耗，按 org 统计）
```

**速率限制**：每个 org 每分钟最多触发 3 个 AI 作业，防止单租户耗尽 API 配额。

### 4.5 前端架构调整

**新增全局状态**（推荐引入 Zustand）：

```typescript
interface OrgStore {
  activeOrgId: string | null;
  orgList: OrgInfo[];
  setActiveOrg: (orgId: string) => void;  // 切换时清空 project 级缓存
}
```

**新增 ViewKey**：

| ViewKey | 文件 | 平台 |
|---------|------|------|
| `org-settings` | OrgSettingsView | admin |
| `org-members` | OrgMembersView | admin |
| `testhub` | TestHubView | workspace |
| `wiki` | WikiView | workspace |
| `sprint-board` | SprintBoardView | workspace |
| `efficiency` | EfficiencyView | workspace |
| `automation` | AutomationView | admin |
| `api-keys` | ApiKeysView | admin |

---

## 五、开发计划与资源估算

### 5.1 工期与人力拆解

| 阶段 | 周期 | 后端 | 前端 | 主要交付物 |
|------|------|------|------|---------|
| Phase 1 | 6 周 | 2 人 | 1 人 | Organization Schema、OrgGuard、JWT 改造、组织管理页 |
| Phase 2 | 8 周 | 1 人 | 2 人 | TestHub、WikiView、SprintBoard、效能仪表盘 |
| Phase 3 | 8 周 | 2 人 | 1 人 | SSO、规则引擎、Webhook、安全策略、API Key 管理 |
| Phase 4 | 6 周 | 1 人 | 1 人 + 1 AI | AI 多租户、成本汇总报告、智能 PRD 生成 |
| **合计** | **28 周** | | **3~4 人团队** | **约 7 个月** |

### 5.2 里程碑节点

| 里程碑 | 目标时间 | 验收标准 |
|--------|---------|---------|
| M1：多租户上线 | 第 6 周末 | 两个独立 org 数据完全隔离；org 切换正常；ConfigService 按 org 取值 |
| M2：功能补齐完成 | 第 14 周末 | Bug 可创建并关联需求；Wiki 页面可编辑；Sprint 看板可使用 |
| M3：企业级能力上线 | 第 22 周末 | 飞书 SSO 登录正常；自动化规则至少 3 种触发器可用；Webhook 推送正常 |
| M4：差异化完成 | 第 28 周末 | AI 助理按租户独立运行；成本报告可导出；AI 需求描述生成可用 |

### 5.3 Phase 1 详细开发顺序

Phase 1 是整个改造的生死线，推荐按如下顺序开发，确保每步完成后系统仍可运行：

1. **Prisma migration**：为所有表追加 `organizationId` 字段（NOT NULL，default 为 seed 出的 default org id）
2. **数据迁移脚本**：将存量数据归入 default org；在 staging 环境验证后执行
3. **JWT 改造**：`login` 接口返回 `orgList`；前端 `localStorage` 存储 `activeOrgId`
4. **OrgGuard + Prisma 中间件**：校验 `X-Org-Id` Header；自动注入 `organizationId` 过滤
5. **ConfigService 租户化**：`get(key, orgId)`，添加 Redis 缓存层
6. **/organizations API**：CRUD + 成员管理（邀请/角色变更/移除）
7. **前端**：顶部组织切换器 + 组织设置页 + 成员管理表格
8. **专项安全测试**：E2E 验证跨租户数据隔离，A org 用户无法访问 B org 数据

### 5.4 人力不足时的裁剪方案

若实际团队仅有 1~2 人开发：

- **Phase 2**：仅交付测试管理（Bug 追踪）和 Wiki；Sprint 管理推迟至 Phase 3 末
- **Phase 3**：SSO 和安全策略保留；自动化规则引擎推迟至 Phase 4
- **Phase 4**：AI 多租户化和成本汇总必须保留；PWA 设为可选
- 总工期可延长至约 40 周

---

## 六、风险管控

| 风险 | 级别 | 描述 | 缓解策略 |
|------|------|------|---------|
| 数据库迁移失败 | 🔴 高 | 所有表追加 `organizationId` 是破坏性操作，迁移脚本出错将导致数据丢失或停机 | 先在 staging 执行；编写回滚脚本；`--create-only` 审查 SQL 后手动执行 |
| 越租户数据泄露 | 🔴 高 | OrgGuard 或 Prisma 中间件漏写，导致 A 租户读取 B 租户数据 | Prisma 中间件自动注入；上线前专项安全测试；E2E 跨租户访问必须覆盖 |
| PM 助理调度超载 | 🟡 中 | 多租户后 cron 作业数量倍增，单实例 NestJS Scheduler 超时或 OOM | Phase 3 前迁移至 BullMQ；按 org 设置 AI 调用速率上限（3次/分钟） |
| 飞书配置管理复杂 | 🟡 中 | 每租户独立飞书应用配置，AppSecret 管理复杂，泄露风险上升 | ConfigService 租户化时统一 AES-256 加密存储；Redis 缓存减少 DB 查询 |
| 前端状态管理混乱 | 🟢 低 | 增加 `activeOrgId` / `orgList` 后，org 切换时 project 级状态残留 | 引入 Zustand 统一管理；org 切换时清空所有 project 级缓存状态 |
| 工期估算偏差 | 🟢 低 | 28 周为 3~4 人估算，人力不足时 Phase 2 部分功能可能延期 | 优先保障 Phase 1 + 测试管理 + Wiki；Sprint 和规则引擎可顺延 |

---

## 七、与 PingCode 功能对比

| 功能模块 | ProjectLVQI 现状 | ProjectLVQI 改造后 | PingCode |
|---------|----------------|------------------|---------|
| 多租户 | ❌ 无 | ✅ Phase 1 完成 | ✅ 完整 |
| 需求管理 | ✅ 完整（5状态） | ✅ + Sprint 绑定 | ✅ 完整（含客户反馈） |
| 测试管理 | ❌ 无 | ✅ Phase 2 完成 | ✅ 完整（含报告） |
| 知识库 Wiki | ❌ 仅 PRD | ✅ Phase 2 完成 | ✅ 完整 |
| Sprint/Scrum | ❌ 无 | ✅ Phase 2 完成 | ✅ Scrum/Kanban/瀑布 |
| 效能度量 | ⚠️ 基础 Dashboard | ✅ Phase 2 扩展 | ✅ 专项效能仪表盘 |
| 成本核算 | ✅ **核心优势** | ✅ 扩展为组织级 | ❌ 无此模块 |
| AI PM 助理 | ✅ **核心优势**（12种） | ✅ 多租户化 + 更深 | ⚠️ 基础 AI 功能 |
| 飞书集成 | ✅ **一等公民** | ✅ + SSO + 部门树 | ⚠️ 第三方集成 |
| SSO 登录 | ❌ 无 | ✅ Phase 3 完成 | ✅ 完整 |
| 自动化规则 | ⚠️ 仅风险告警 | ✅ Phase 3 完整引擎 | ✅ Flow 自动化 |
| 安全策略 | ⚠️ 仅审计日志 | ✅ Phase 3 完成 | ✅ 企业版完整 |
| Webhook & API | ❌ 无 | ✅ Phase 3 完成 | ✅ 完整 |
| 风险管理 | ✅ 独立模块 | ✅ 保留并增强 | ❌ 无独立模块 |
| 私有化部署 | ✅ Docker Compose | ✅ 保留 | ✅ On-Premise |
| 移动端/PWA | ❌ 无 | ✅ Phase 4 可选 | ✅ Web + 移动端 |

---

## 八、附录

### 8.1 技术栈总览

| 层级 | 技术选型 |
|------|---------|
| 后端框架 | NestJS（模块化单体；Phase 3 后可拆分 Worker 进程） |
| 数据库 | PostgreSQL + Prisma ORM（含 Desktop Schema） |
| 缓存 / 队列 | Redis（Session、ConfigService 缓存）+ BullMQ（Phase 4 PM 助理队列） |
| 前端 | React + TypeScript + Vite，Glassmorphism UI，7 种主题，Zustand 状态管理 |
| 基础设施 | Docker Compose，支持私有化部署 |
| 第三方集成 | 飞书开放平台（OAuth / 多维表格 / 消息推送 / 通讯录） |
| AI | LLM API（通过 ConfigService 按租户配置接口地址和密钥） |
| 安全 | JWT（RS256）、AES-256 配置加密、TOTP、IP 白名单 |

### 8.2 新增 npm 依赖

| 依赖包 | 用途 | 引入阶段 |
|--------|------|---------|
| `bullmq` | PM 助理作业队列 | Phase 4 |
| `otplib` | TOTP 二次验证 | Phase 3 |
| `ldapjs` | LDAP/AD 集成（可选） | Phase 3 |
| `exceljs` | 成本报告 Excel 导出 | Phase 4 |
| `vite-plugin-pwa` | PWA 支持（可选） | Phase 4 |
| `zustand` | 前端 org 全局状态管理 | Phase 1 |
| `@tiptap/react` | Wiki 富文本编辑器 | Phase 2 |

### 8.3 人员配置建议

- **后端工程师 × 2**：负责 Phase 1 Schema 改造、OrgGuard、Phase 3 企业级能力
- **前端工程师 × 1~2**：负责组织管理 UI、新功能页面、效能仪表盘
- **AI/全栈工程师 × 1**：负责 Phase 4 AI 多租户化、智能 PRD 生成
- 若人力不足（≤2人），建议 Phase 2 仅交付测试管理和 Wiki，Sprint 顺延

### 8.4 参考资料

- `ProjectLVQI CLAUDE.md` — 系统架构、模块说明、认证体系
- PingCode 官网（pingcode.com）— 产品功能对标参考
- NestJS 官方文档 — Guard、Interceptor、中间件实现
- Prisma 官方文档 — 中间件、多 Schema、migrate 命令
- 飞书开放平台文档 — OAuth 2.0、通讯录 API、消息卡片

---

*文档结束 · ProjectLVQI 多租户改进计划 V1.0*
