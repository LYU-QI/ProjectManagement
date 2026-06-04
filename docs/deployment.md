# ProjectLVQI 云端部署指南

本文档用于将 `ProjectLVQI` 部署到云端服务器或私有化服务器。当前项目形态为：

- 前端：Vite + React，构建后为静态文件
- 后端：NestJS + Prisma
- 数据库：PostgreSQL
- 缓存：Redis
- 外部依赖：飞书开放平台、多维表格、AI 模型 API

## 1. 推荐资源配置

### 1.1 配置档位

| 场景 | 应用服务器 | PostgreSQL | Redis | 适用情况 |
| --- | --- | --- | --- | --- |
| 最低可跑 | 2 vCPU / 4GB RAM / 40GB SSD | 同机 | 同机 | 试用、小团队、低并发 |
| 推荐起步 | 4 vCPU / 8GB RAM / 80-100GB SSD | 同机或托管库 | 同机 | 10-50 人日常使用 |
| 稳定生产 | 应用 2-4 vCPU / 4-8GB RAM | 独立 2 vCPU / 4-8GB RAM / 100GB SSD | 1GB+ | 多组织、多项目、持续使用 |
| 中大型 | 应用 2 台 4C8G | 独立 4C16G 或托管高可用库 | 独立 Redis | 高并发、频繁导入导出、定时任务密集 |

建议第一版生产部署使用：

```text
4 vCPU / 8GB RAM / 100GB SSD / Ubuntu 22.04 或 24.04 LTS
PostgreSQL 16 + Redis 7 + NestJS 后端 + Nginx 同机部署
```

如果预算允许，更稳的方式是：

```text
应用服务器：2 vCPU / 4GB RAM
托管 PostgreSQL：2 vCPU / 4GB RAM / 100GB SSD
Redis：同应用服务器或托管 Redis 1GB
```

### 1.2 为什么不建议 1C1G

后端除了普通 API，还会处理：

- 飞书多维表读取、写回、同步
- 三大看板聚合和 Redis 缓存
- Excel 导入导出
- PDF / Word / 文档解析依赖
- PM 助手定时任务
- 审计日志、组织权限、项目权限查询
- AI 接口调用与结果落库

Node 后端 CPU 压力通常不大，但 Excel、批量同步、文档解析会带来瞬时内存和 CPU 峰值。PostgreSQL 也需要内存给连接、缓存和系统页缓存，因此生产环境建议从 2C4G 起步，推荐 4C8G。

## 2. 推荐部署拓扑

### 2.1 单机部署

适合试用、小团队、第一版生产。

```text
公网 HTTPS
   |
Nginx / Caddy
   |-- /             -> frontend/dist 静态文件
   |-- /api/v1/*     -> backend:3000
   |-- /health       -> backend:3000/health

同机服务：
- Node.js 后端
- PostgreSQL
- Redis
```

优点：成本低、维护简单。

风险：数据库和应用共用资源，后续数据增长后需要迁移数据库。

### 2.2 应用与数据库分离

适合稳定生产。

```text
公网 HTTPS
   |
Nginx / Caddy
   |
应用服务器：frontend + backend + Redis
   |
内网 PostgreSQL / 托管 PostgreSQL
```

优点：数据库更稳定，备份、扩容和恢复更可控。

## 3. 端口与安全

建议公网只开放：

| 端口 | 用途 |
| --- | --- |
| 80 | HTTP，建议只用于跳转 HTTPS |
| 443 | HTTPS |

不要公网开放：

| 端口 | 用途 | 处理方式 |
| --- | --- | --- |
| 3000 | NestJS 后端 | 仅本机或内网访问，由 Nginx 反代 |
| 5432 / 5433 | PostgreSQL | 仅内网访问 |
| 6379 / 6380 | Redis | 仅本机或内网访问 |

必须配置：

- HTTPS 证书
- 防火墙安全组
- 强密码数据库账号
- `.env` 权限隔离
- 日志轮转
- 数据库定时备份
- 飞书和 AI Key 禁止提交到代码仓库

## 4. 环境变量

后端至少需要配置：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"
REDIS_URL="redis://HOST:PORT"
JWT_SECRET="替换为强随机密钥"

FEISHU_APP_ID="飞书应用 ID"
FEISHU_APP_SECRET="飞书应用 Secret"
FEISHU_USER_ID_TYPE="open_id"

AI_API_URL="AI 服务地址"
AI_API_KEY="AI API Key"
AI_MODEL="模型名称"
```

按需配置：

```bash
FEISHU_APP_TOKEN="组织级默认多维表 App Token"
FEISHU_TABLE_ID="组织级默认 Table ID"
FEISHU_FIELD_MAP="字段映射 JSON 或 key=value 配置"
FEISHU_MULTI_SELECT_FIELDS="多选字段名，逗号分隔"
```

项目级飞书配置通常在系统页面中维护：

- `feishuAppToken`
- `feishuTableId`
- `feishuViewId`

三大看板相关配置通常在系统配置中维护：

- `CLUSTER_RISK_BOARD_*`
- `DELIVERY_ROADMAP_*`
- `RESOURCE_CALENDAR_PEOPLE_*`
- `RESOURCE_CALENDAR_ALLOCATIONS_*`
- `RESOURCE_CALENDAR_AVAILABILITY_*`

## 5. 部署步骤

### 5.1 安装基础环境

建议版本：

```text
Node.js 20 LTS 或 22 LTS
PostgreSQL 16
Redis 7
Nginx 或 Caddy
```

### 5.2 拉取代码并安装依赖

```bash
git clone <repo-url> ProjectManagement
cd ProjectManagement
npm ci
```

### 5.3 配置后端环境变量

```bash
cp backend/.env.example backend/.env
```

然后按第 4 节填写生产环境配置。

### 5.4 数据库初始化和迁移

生产或非交互环境使用：

```bash
npm run -w backend prisma:generate
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

仅首次初始化且确认需要种子账号时执行：

```bash
npm run -w backend prisma:seed
```

生产环境执行 seed 前需要确认默认账号和密码策略，避免保留弱密码。

### 5.5 构建

```bash
npm run build
```

构建产物：

- 后端：`backend/dist/`
- 前端：`frontend/dist/`

### 5.6 启动后端

可以使用 `systemd`、`pm2` 或容器方式。

直接启动示例：

```bash
cd backend
node dist/src/main.js
```

PM2 示例：

```bash
pm2 start backend/dist/src/main.js --name projectlvqi-backend
pm2 save
pm2 startup
```

### 5.7 Nginx 反向代理示例

```nginx
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name example.com;

  ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  root /opt/projectlvqi/frontend/dist;
  index index.html;

  location /api/v1/ {
    proxy_pass http://127.0.0.1:3000/api/v1/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /health {
    proxy_pass http://127.0.0.1:3000/health;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## 6. 备份与恢复

### 6.1 PostgreSQL 备份

建议至少每日备份一次，并保存到对象存储或另一台机器。

```bash
pg_dump "$DATABASE_URL" > "projectlvqi-$(date +%F).sql"
```

恢复示例：

```bash
psql "$DATABASE_URL" < projectlvqi-YYYY-MM-DD.sql
```

### 6.2 需要重点备份的数据

- PostgreSQL 数据库
- 后端 `.env`
- Nginx 配置
- 上传文件目录，如果后续启用本地文件存储
- 生产部署脚本和 systemd/pm2 配置

Redis 当前主要用于缓存，通常不作为核心业务数据备份对象。

## 7. 上线检查

上线前：

```bash
npm run build
npm run -w backend test:api:permissions
```

上线后检查：

- `/health` 正常
- 前端首页可访问
- 登录正常
- 组织切换、项目切换正常
- 总览三大看板可加载
- 飞书记录列表可读取
- 资源维护台写回飞书正常
- PM 助手手动执行正常
- 任务中心无高频失败
- 后端日志没有持续错误

## 8. 扩容建议

优先扩容顺序：

1. 数据库独立出来，使用托管 PostgreSQL 或独立数据库服务器。
2. Redis 独立出来，避免缓存和应用争抢内存。
3. 应用服务横向扩容为多实例。
4. 前端静态文件放到 CDN。
5. 对飞书同步、AI 分析、文档解析类任务引入队列和后台 worker。

出现以下情况时建议拆分数据库：

- 大看板加载明显变慢
- Excel 导入导出期间页面变慢
- PostgreSQL CPU 或内存长期较高
- 组织、项目、审计日志数据持续增长
- 需要更可靠的自动备份和恢复能力
