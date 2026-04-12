# 权限与审计运维 SOP

本文档用于阶段 3 交付后的日常运维，覆盖：

- 角色初始化
- 组织 / 项目授权
- 审计排查
- 敏感配置巡检

## 1. 角色初始化

建议至少准备以下账号：

- `super_admin`
  - 用于系统配置、敏感信息 reveal、用户删除、组织级兜底运维
- `project_manager`
  - 用于跨项目治理、用户管理、协助授权
- `pm`
  - 用于项目日常管理、需求/任务/成本维护
- `viewer`
  - 用于只读访问验证

初始化检查项：

1. 用户是否存在于 `User` 表。
2. 用户是否存在于对应组织的 `OrgMember` 表。
3. 登录返回是否带有：
   - `organizationId`
   - `orgRole`
   - `orgList`
4. 登录后访问 `/api/v1/dashboard/overview` 是否返回 `200`。

如果用户登录后前端提示“数据加载失败”，优先检查是否缺少 `OrgMember` 关系，而不是先判断后端挂掉。

## 2. 组织授权流程

适用场景：

- 新增成员进组织
- 调整组织级角色
- 移除组织成员

建议流程：

1. 使用 `super_admin` 或组织 `owner/admin` 登录。
2. 通过管理后台或接口执行：
   - `POST /api/v1/organizations/:id/members/invite`
   - `PATCH /api/v1/organizations/:id/members/:userId`
   - `DELETE /api/v1/organizations/:id/members/:userId`
3. 执行后到审计日志检查：
   - `source`
   - `beforeSnapshot`
   - `afterSnapshot`
   - `outcome`
   - `statusCode`

审计来源标识：

- `organization.member_invite`
- `organization.member_role_change`
- `organization.member_remove`

## 3. 项目授权流程

适用场景：

- 给成员授予项目访问权
- 调整项目成员角色
- 移除项目成员

建议流程：

1. 使用 `super_admin`、`project_manager` 或项目创建者登录。
2. 调用：
   - `POST /api/v1/project-memberships`
   - `DELETE /api/v1/project-memberships/:id`
3. 如果 PM 不是项目创建者，即使已能访问项目，也不应允许其管理其他项目成员。

审计来源标识：

- `project_membership.create`
- `project_membership.role_change`
- `project_membership.remove`

常见错误：

- `No access to project <id>`
  - 当前账号没有该项目访问范围
- `Only project creator can manage project members`
  - 当前账号能看项目，但无授权管理资格

## 4. 用户管理流程

适用场景：

- 创建用户
- 修改全局角色
- 重置密码
- 删除用户

建议流程：

1. 使用 `super_admin` 或 `project_manager` 登录。
2. 调用：
   - `POST /api/v1/users`
   - `PATCH /api/v1/users/:id/role`
   - `PATCH /api/v1/users/:id/password`
   - `DELETE /api/v1/users/:id`
3. 删除用户前检查：
   - 是否仍为项目 owner
   - 是否仍被工作项 `creatorId` 引用

审计来源标识：

- `user_management.create`
- `user_management.role_change`
- `user_management.password_reset`
- `user_management.delete`

## 5. 审计排查 SOP

### 5.1 看什么

系统审计日志重点字段：

- `source`
- `outcome`
- `statusCode`
- `errorMessage`
- `resourceType`
- `resourceId`
- `beforeSnapshot`
- `afterSnapshot`

Chatbot 审计重点字段：

- `mode`
- `detailScope`
- `scopedProjectNames`
- `outcome`
- `statusCode`
- `resourceType`

### 5.2 怎么判定

如果是权限问题，先看：

1. `outcome=failed`
2. `statusCode=403`
3. `errorMessage`

常见判定：

- `No membership in organization default`
  - 账号缺组织成员关系
- `No access to project <id>`
  - 账号无项目访问权
- `Only owner or admin can update member roles`
  - 组织成员具备访问权，但无治理权
- `Only super_admin can reveal sensitive config values`
  - 敏感配置 reveal 被正确拦截

### 5.3 出现 500 怎么办

优先排查：

1. Prisma schema 与数据库枚举/字段是否一致。
2. 新增枚举值是否已实际执行到数据库。
3. 审计 JSON 字段是否写入了不可序列化内容。

## 6. 敏感配置巡检

检查项：

1. `GET /api/v1/config` 对普通 PM 返回掩码值。
2. `GET /api/v1/config?reveal=true` 对非 `super_admin` 返回 `403`。
3. 前端设置页不在默认状态展示真实密钥。
4. 审计日志中的 `requestBody / beforeSnapshot / afterSnapshot` 不包含明文密码、secret、token、api key。

## 7. 发布前最小验证

至少执行：

```bash
npm run -w backend build
npm run -w frontend build
```

关键阶段 3 回归：

```bash
TEST_API_URL=http://127.0.0.1:3002 TEST_USERNAME=superadmin TEST_PASSWORD=123456 ./node_modules/.bin/jest --config test/jest-e2e.json test/api/audit.spec.ts test/api/users.spec.ts test/api/permissions.spec.ts
```
