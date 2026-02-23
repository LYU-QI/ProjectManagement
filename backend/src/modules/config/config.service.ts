import { Injectable } from '@nestjs/common';
import { readFileSync, writeFileSync } from 'fs';
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
    FEISHU_USER_NAME_MAP: { group: 'feishu', groupLabel: '飞书集成', sensitive: false, description: '用户名到飞书 ID 的映射（JSON 格式）' },
    AI_API_URL: { group: 'ai', groupLabel: 'AI 模型配置', sensitive: false, description: 'AI 模型 API 端点（兼容 OpenAI 格式，如 https://api.deepseek.com/v1）' },
    AI_API_KEY: { group: 'ai', groupLabel: 'AI 模型配置', sensitive: true, description: 'AI 模型 API 密钥' },
    AI_MODEL: { group: 'ai', groupLabel: 'AI 模型配置', sensitive: false, description: 'AI 模型名称（如 deepseek-chat、gpt-4o、qwen-plus）' },
};

@Injectable()
export class ConfigService {
    /** .env 文件路径 */
    private readonly envPath = resolve(__dirname, '..', '..', '..', '.env');

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
