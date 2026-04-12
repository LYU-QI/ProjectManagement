# 阶段 2 回归清单

本文档用于阶段 2 “关键流程稳定性”开发期间的最小回归检查。

## 1. 回归目标

确保以下链路在持续修改后仍然可用：

- 登录与鉴权
- 项目切换后的数据范围
- 成本与工时核心口径
- 任务中心加载与统计
- 飞书写回失败时的可定位性
- PM 助手执行与失败恢复
- 自动化规则执行与失败恢复

## 2. 自动化 smoke tests

当前已纳入 API smoke tests 的内容：

- `auth`
- `audit`
- `users`
- `requirements`
- `health`
- `task-center`
- `costs`
- `pm-assistant`
- `automation`
- `feishu`

执行命令：

```bash
npm run -w backend test:api
```

审计专项可单独执行：

```bash
TEST_API_URL=http://127.0.0.1:3002 TEST_USERNAME=superadmin TEST_PASSWORD=123456 npm run -w backend test:api:audit
```

用户管理专项可单独执行：

```bash
TEST_API_URL=http://127.0.0.1:3002 TEST_USERNAME=superadmin TEST_PASSWORD=123456 npm run -w backend test:api:users
```

当前 `audit.spec.ts` 覆盖：

- 通用 HTTP 审计成功落库
- 通用 HTTP 审计失败落库
- 审计 CSV 导出字段完整性
- `AI_CHAT` 失败审计落库
- `AI_CHAT` 的 `outcome / statusCode / resourceType / scopedProjectNames` 可查询

当前 `users.spec.ts` 覆盖：

- `super_admin` 可删除临时用户
- 当前登录账号不可自删

如需指定环境，可设置：

```bash
TEST_API_URL=http://127.0.0.1:3002
TEST_USERNAME=pm
TEST_PASSWORD=123456
TEST_PROJECT_ID=8
npm run -w backend test:api
```

## 3. 手工回归清单

### 3.1 项目与上下文

- 登录后顶部组织和项目选择器可正常切换
- 切换项目后：
  - 成本与工时页切到对应项目
  - 飞书集成页作用域提示正确
  - AI 分析页作用域提示正确
  - 任务中心作用域提示正确

### 3.2 成本与工时

- 成本页“实际支出 = 直接成本 + 工时成本”
- AI 聊天/AI 周报里的财务口径与成本页一致
- 项目没有工时或成本时，页面和 AI 不出现跨项目残留

### 3.3 飞书集成

- 飞书页能正常读取当前项目绑定表
- 写回失败时，任务中心能看到：
  - 错误分类
  - 错误码
  - 严重级别
  - 恢复建议
- 对常见飞书失败（权限、人员映射、写回待确认），任务中心详情能展示步骤化检查清单
- `91403` 权限问题能被识别为权限类错误
- 任务中心支持按严重级别和错误码筛选失败项
- 任务中心顶部能显示最近高频错误码聚合，并可一键带入筛选

### 3.4 PM 助手

- 手动执行一次 PM 助手任务
- 任务中心出现对应记录
- 如失败，可看到明确恢复建议、错误码、推荐入口
- 点击重试后，最近恢复结果区域出现记录

### 3.5 自动化规则

- 新建一条自动化规则
- 手动运行规则后，任务中心能看到记录
- 失败时详情区有错误分类、错误码、恢复建议和推荐入口
- 点击重试后，最近恢复结果区域出现记录
- 通过统一接口 `/api/v1/task-center/retry` 可重新试跑

### 3.6 审计与可追溯性

- 审计日志页可看到成功/失败状态、状态码、资源类型、资源 ID
- 普通写操作会在系统审计日志中落记录
- 失败请求会记录 `outcome=failed` 和明确错误信息
- `AI_CHAT` 请求会在 chatbot 审计中记录：
  - `mode`
  - `detailScope`
  - `scopedProjectNames`
  - `outcome`
  - `statusCode`
  - `resourceType`
- 审计 CSV 导出包含：
  - 结果
  - 状态码
  - 错误信息
  - 资源类型
  - 资源 ID

### 3.7 用户管理安全边界

- `super_admin` 可创建、改角色、重置密码、删除普通用户
- 当前登录账号不可自删
- 删除用户后，用户列表应即时刷新
- 若用户仍拥有项目或仍被工作项创建人引用，应返回明确错误，而不是模糊失败

## 4. 发布前最小验收

进入下一轮开发前，至少满足：

- `npm run -w backend build`
- `npm run -w frontend build`
- `npm run -w backend test:api`

如果涉及飞书、PM 助手、自动化相关改动，还需要至少执行一轮手工回归。
