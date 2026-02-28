import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 配置项的描述信息
 */
export interface ConfigItemMeta {
    /** 配置键名 */
    key: string;
    /** 配置当前值 */
    value: string;
    /** 所属分组 */
    group: string;
    /** 分组中文标签 */
    groupLabel: string;
    /** 是否为敏感字段 */
    sensitive: boolean;
    /** 字段说明 */
    description: string;
}

/** 分组与敏感字段的定义 */
const CONFIG_META: Record<string, { group: string; groupLabel: string; sensitive: boolean; description: string }> = {
    DATABASE_URL: { group: 'database', groupLabel: '数据库配置', sensitive: true, description: 'PostgreSQL 数据库连接地址' },
    JWT_SECRET: { group: 'security', groupLabel: '安全配置', sensitive: true, description: 'JWT 签名密钥' },
    FEISHU_APP_ID: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '飞书应用 App ID' },
    FEISHU_APP_SECRET: { group: 'feishu', groupLabel: '飞书集成', sensitive: true, description: '飞书应用 App Secret' },
    FEISHU_APP_TOKEN: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '飞书多维表格 App Token' },
    FEISHU_TABLE_ID: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '飞书多维表格 Table ID' },
    FEISHU_USER_ID_TYPE: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '飞书用户 ID 类型' },
    FEISHU_MULTI_SELECT_FIELDS: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '多维表格多选字段名（逗号分隔）' },
    FEISHU_FIELD_MAP: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '字段名映射（逻辑名=实际名，逗号分隔；或 JSON 对象）' },
    FEISHU_PM_ASSISTANT_ENABLED: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 定时任务开关（true/false）' },
    FEISHU_PM_ASSISTANT_TZ: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 定时任务时区（如 Asia/Shanghai）' },
    FEISHU_PM_ASSISTANT_CRON_MORNING_BATCH: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '早间批次 Cron (10:00)。包含：早间播报、会议材料、资源负载、风险预警、超期提醒、里程碑提醒、阻塞预警。格式：分 时 日 月 周' },
    FEISHU_PM_ASSISTANT_CRON_NOON_TREND: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '午间趋势 Cron (12:00)。包含：趋势预测、超期提醒。格式：分 时 日 月 周' },
    FEISHU_PM_ASSISTANT_CRON_AFTERNOON_RISK: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '下午风险 Cron (14:00)。包含：风险预警、超期提醒。格式：分 时 日 月 周' },
    FEISHU_PM_ASSISTANT_CRON_AFTERNOON_PROGRESS: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '进度看板 Cron (15:00)。包含：进度看板、里程碑提醒、阻塞预警。格式：分 时 日 月 周' },
    FEISHU_PM_ASSISTANT_CRON_OVERDUE_16: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '超期提醒 16:00 Cron。格式：分 时 日 月 周' },
    FEISHU_PM_ASSISTANT_CRON_OVERDUE_18: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '超期提醒 18:00 Cron。格式：分 时 日 月 周' },
    FEISHU_PM_ASSISTANT_CRON_DAILY_REPORT: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '晚间日报 Cron (19:00)。格式：分 时 日 月 周' },
    FEISHU_PM_ASSISTANT_CRON_WEEKLY_AGENDA: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '周会讨论要点 Cron (周六 10:00)。格式：分 时 日 月 周' },
    FEISHU_PM_ASSISTANT_CRON_WEEKLY_REPORT: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '周报 Cron (周六 17:00)。格式：分 时 日 月 周' },
    FEISHU_PM_ASSISTANT_PROMPT_MORNING_BRIEFING: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 早间播报 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_MEETING_MATERIALS: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 会议材料 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_RISK_ALERTS: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 风险预警 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_OVERDUE_REMINDER: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 超期提醒 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_MILESTONE_REMINDER: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 里程碑提醒 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_BLOCKED_ALERT: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 阻塞预警 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_RESOURCE_LOAD: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 资源负载 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_PROGRESS_BOARD: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 进度看板 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_TREND_PREDICT: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 趋势预测 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_WEEKLY_AGENDA: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 周会要点 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_DAILY_REPORT: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 晚间日报 Prompt' },
    FEISHU_PM_ASSISTANT_PROMPT_WEEKLY_REPORT: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: 'PM Assistant 周报 Prompt' },
    AI_API_URL: { group: 'ai', groupLabel: 'AI 模型配置', sensitive: false, description: 'AI 模型 API 端点（兼容 OpenAI 格式，如 https://api.deepseek.com/v1）' },
    AI_API_KEY: { group: 'ai', groupLabel: 'AI 模型配置', sensitive: true, description: 'AI 模型 API 密钥' },
    AI_MODEL: { group: 'ai', groupLabel: 'AI 模型配置', sensitive: false, description: 'AI 模型名称（如 deepseek-chat、gpt-4o、qwen-plus）' },
};

@Injectable()
export class ConfigService {
    /** .env 文件路径 */
    private readonly envPath = this.resolveEnvPath();

    private resolveEnvPath(): string {
        const candidates = [
            // 1) 优先使用 backend/.env（兼容从仓库根目录启动）
            resolve(process.cwd(), 'backend', '.env'),
            // 2) 其次使用当前工作目录 .env（通常为 backend/.env）
            resolve(process.cwd(), '.env'),
            // 3) 兼容 ts-node/nest watch
            resolve(__dirname, '..', '..', '..', '.env'),
            // 4) 兼容 dist 目录执行，回退到 backend/.env（而非 dist/.env）
            resolve(__dirname, '..', '..', '..', '..', '.env'),
        ];
        for (const file of candidates) {
            if (existsSync(file)) return file;
        }
        // 保底：沿用旧路径
        return resolve(__dirname, '..', '..', '..', '.env');
    }

    /**
     * 读取 .env 文件，解析为键值对
     */
    private parseEnvFile(): Record<string, string> {
        let content: string;
        try {
            content = readFileSync(this.envPath, 'utf-8');
        } catch {
            return {};
        }

        const result: Record<string, string> = {};
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            // 跳过空行和注释行
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex < 0) continue;
            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();
            // 去除引号
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            result[key] = value;
        }
        return result;
    }

    /**
     * 获取所有配置项（敏感字段返回掩码）
     */
    getAll(): ConfigItemMeta[] {
        const envVars = this.parseEnvFile();
        const items: ConfigItemMeta[] = [];

        for (const [key, meta] of Object.entries(CONFIG_META)) {
            const rawValue = envVars[key] ?? '';
            items.push({
                key,
                value: meta.sensitive ? this.maskValue(rawValue) : rawValue,
                group: meta.group,
                groupLabel: meta.groupLabel,
                sensitive: meta.sensitive,
                description: meta.description,
            });
        }

        return items;
    }

    /**
     * 获取所有配置项（包含真实值，需要管理员权限）
     */
    getAllRaw(): ConfigItemMeta[] {
        const envVars = this.parseEnvFile();
        const items: ConfigItemMeta[] = [];

        for (const [key, meta] of Object.entries(CONFIG_META)) {
            items.push({
                key,
                value: envVars[key] ?? '',
                group: meta.group,
                groupLabel: meta.groupLabel,
                sensitive: meta.sensitive,
                description: meta.description,
            });
        }

        return items;
    }

    /**
     * 获取单个配置项的原始值（内部使用）
     */
    getRawValue(key: string): string {
        const envVars = this.parseEnvFile();
        return envVars[key] ?? '';
    }

    /**
     * 批量更新配置项，写回 .env 文件
     */
    updateAll(updates: Record<string, string>): { success: boolean; message: string } {
        const current = this.parseEnvFile();

        // 仅允许更新已定义的配置键
        for (const key of Object.keys(updates)) {
            if (!(key in CONFIG_META)) {
                return { success: false, message: `不允许设置未定义的配置项: ${key}` };
            }
            current[key] = updates[key];
        }

        // 重建 .env 文件内容
        const lines: string[] = [];
        const groups = ['database', 'security', 'feishu', 'ai'];
        const groupLabels: Record<string, string> = {
            database: '数据库配置',
            security: '安全配置',
            feishu: '飞书多维表格配置',
            ai: 'AI 模型配置',
        };

        for (const group of groups) {
            lines.push(`# ${groupLabels[group]}`);
            for (const [key, meta] of Object.entries(CONFIG_META)) {
                if (meta.group === group) {
                    const val = current[key] ?? '';
                    // JSON 或含空格的值使用引号包裹
                    const needsQuote = val.includes(' ') || val.startsWith('{') || val.includes('://');
                    lines.push(`${key}=${needsQuote ? `"${val}"` : val}`);
                }
            }
            lines.push('');
        }

        try {
            writeFileSync(this.envPath, lines.join('\n'), 'utf-8');
            return { success: true, message: '配置已保存，部分配置项需要重启后端服务才能生效。' };
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            return { success: false, message: `写入 .env 文件失败: ${detail}` };
        }
    }

    /**
     * 对敏感值进行掩码处理
     */
    private maskValue(value: string): string {
        if (!value || value.length <= 4) return '****';
        return value.slice(0, 2) + '*'.repeat(Math.min(value.length - 4, 20)) + value.slice(-2);
    }
}
