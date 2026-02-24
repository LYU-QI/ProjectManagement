# PM Assistant 定时提醒系统

本模块提供一组后端接口，生成并发送飞书互动卡片，用于早间播报、风险预警、超期提醒等。调度可交由 OpenClaw / Cron 调用。

## 配置要求
在「系统配置 → 飞书集成」填写：
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_APP_TOKEN`
- `FEISHU_TABLE_ID`
- `FEISHU_CHAT_ID`
- `FEISHU_USER_ID_TYPE`（可选）
- `FEISHU_MULTI_SELECT_FIELDS`（可选，逗号分隔）
- `FEISHU_PM_ASSISTANT_ENABLED`（true/false，开启定时任务）

## 接口列表
- `GET /api/v1/pm-assistant/jobs` 任务列表
- `POST /api/v1/pm-assistant/run` 运行任务（发送卡片）
  - body: `{ "jobId": "overdue-reminder", "dryRun": false }`
- `GET /api/v1/pm-assistant/logs` 执行记录
- `GET /api/v1/pm-assistant/schedules` 定时配置
- `POST /api/v1/pm-assistant/schedules` 更新 cron（body: `{ "id": "morning-batch", "cron": "0 10 * * 1-6" }`）
- `POST /api/v1/pm-assistant/schedules/timezone` 更新时区（body: `{ "timezone": "Asia/Shanghai" }`）
- `GET /api/v1/pm-assistant/configs` 任务开关列表
- `POST /api/v1/pm-assistant/configs` 更新任务开关（body: `{ "jobId": "overdue-reminder", "enabled": false }`）

支持的 `jobId`：
- `morning-briefing` 早间播报
- `meeting-materials` 会议材料
- `risk-alerts` 风险预警
- `overdue-reminder` 超期提醒
- `milestone-reminder` 里程碑提醒
- `blocked-alert` 阻塞预警
- `resource-load` 资源负载分析
- `progress-board` 进度看板
- `trend-predict` 任务趋势预测
- `weekly-agenda` 周会讨论要点
- `daily-report` 晚间日报
- `weekly-report` 周报

## OpenClaw jobs.json 示例
```json
{
  "version": 1,
  "jobs": [
    {
      "id": "pm-overdue-reminder",
      "name": "PM超期任务提醒",
      "enabled": true,
      "sessionTarget": "isolated",
      "schedule": { "kind": "cron", "expr": "0 10,12,14,16,18 * * 1-6", "tz": "Asia/Shanghai" },
      "payload": {
        "kind": "http",
        "method": "POST",
        "url": "http://localhost:3000/api/v1/pm-assistant/run",
        "headers": { "Content-Type": "application/json" },
        "body": { "jobId": "overdue-reminder" }
      },
      "delivery": { "mode": "announce" }
    }
  ]
}
```

## 内置定时任务（无需 OpenClaw）
- 使用 NestJS Schedule 模块，默认时区 `Asia/Shanghai`。
- 开关配置：`FEISHU_PM_ASSISTANT_ENABLED=true`。
- 可通过配置项覆盖 cron：`FEISHU_PM_ASSISTANT_CRON_*`。
- 任务开关：每个 jobId 可单独启停。
- AI 总结：自动调用系统 AI 配置（未配置则回退为模板摘要）。
- AI 提示词：可在 PM 助手页面配置系统提示词与用户模板（支持 {{jobId}} / {{summary}}）。
