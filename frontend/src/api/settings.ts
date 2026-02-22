import { apiGet, apiPost } from './client';

/** 配置项接口定义 */
export interface ConfigItem {
    /** 配置键名 */
    key: string;
    /** 配置值 */
    value: string;
    /** 分组标识 */
    group: string;
    /** 分组中文标签 */
    groupLabel: string;
    /** 是否为敏感字段 */
    sensitive: boolean;
    /** 字段说明 */
    description: string;
}

/** 保存结果 */
export interface SaveConfigResult {
    success: boolean;
    message: string;
}

/**
 * 获取所有配置项
 * @param reveal 是否显示敏感字段真实值
 */
export function getConfigItems(reveal = false): Promise<ConfigItem[]> {
    const query = reveal ? '?reveal=true' : '';
    return apiGet<ConfigItem[]>(`/config${query}`);
}

/**
 * 批量保存配置项
 */
export function saveConfigItems(updates: Record<string, string>): Promise<SaveConfigResult> {
    return apiPost<SaveConfigResult>('/config', updates);
}
