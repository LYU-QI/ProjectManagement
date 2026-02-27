# ProjectLVQI MVP

基于 `spec.md` 与 `development-plan.md` 的首版可运行代码骨架，包含：
- 后端：NestJS 模块化单体（Auth/Project/Requirement/Cost/Schedule/Dashboard/AI）
- 前端：React 管理台（Dashboard、需求、成本、进度、AI 周报）
- 基础设施：PostgreSQL + Redis（docker-compose）

## 目录
- `backend/` 后端服务（默认 3000）
- `frontend/` 前端应用（默认 5173）
- `docs/api.md` 接口速查
- `docs/permission-architecture.md` 多项目权限架构方案
- `docs/permission-dev-plan.md` 权限控制开发计划
- `spec.md` 技术规格说明书
- `development-plan.md` 开发计划
- `development-plan-estimate.md` 人天估算

## 本地启动
1. 安装依赖
```bash
npm install
npm install --workspace backend
npm install --workspace frontend
```

2. 启动基础服务（可选）
```bash
docker compose up -d
```

3. 配置后端数据库连接
```bash
cp backend/.env.example backend/.env
```

4. 启动后端
```bash
npm run -w backend prisma:generate
npm run -w backend prisma:migrate
npm run -w backend prisma:seed
npm run dev:backend
```

5. 启动前端
```bash
npm run dev:frontend
```

## 当前实现说明
- 当前为 MVP 第一阶段可运行版本，`Project`、`Requirement`、`Cost`、`Worklog`、`Schedule`、`Dashboard`、`AI`、`Notification`、`AuditLog` 已接入 Prisma + PostgreSQL 持久化。
- 当前已接入 JWT 鉴权，除 `/health` 与 `/api/v1/auth/login` 外接口默认需要 `Bearer Token`。
- 默认登录账号：`pm`，密码：`123456`（由 seed 写入，可在数据库中修改）。
- 默认测试账号：`pm / 123456`、`lead / 123456`、`viewer / 123456`。
- 角色策略：支持 `super_admin / project_director / project_manager / viewer`（兼容 `lead/pm`），并引入项目级授权关系（ProjectMembership）进行数据隔离。
- 新增能力：通知中心（未读/已读）、审计日志查询（pm/lead）、工时录入并纳入成本汇总。

## 对应计划映射
- 已覆盖 `development-plan.md` 的 S1-S3 主干能力
- 提供 S4-S5 的基础接口占位（需求变更、风险、AI 周报）
