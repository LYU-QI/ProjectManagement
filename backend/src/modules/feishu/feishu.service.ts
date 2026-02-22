import { Injectable } from '@nestjs/common';

type TokenCache = {
  token: string;
  expiresAtMs: number;
};

@Injectable()
export class FeishuService {
  private cache: TokenCache | null = null;
  private userNameMapCache: Record<string, string> | null = null;

  private get appId() {
    return process.env.FEISHU_APP_ID;
  }

  private get appSecret() {
    return process.env.FEISHU_APP_SECRET;
  }

  private get appToken() {
    return process.env.FEISHU_APP_TOKEN;
  }

  private get tableId() {
    return process.env.FEISHU_TABLE_ID;
  }

  private get userIdType() {
    return process.env.FEISHU_USER_ID_TYPE || 'open_id';
  }

  private get userNameMap() {
    if (this.userNameMapCache) {
      return this.userNameMapCache;
    }
    const raw = process.env.FEISHU_USER_NAME_MAP;
    if (!raw) {
      this.userNameMapCache = {};
      return this.userNameMapCache;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      this.userNameMapCache = parsed ?? {};
      return this.userNameMapCache;
    } catch {
      throw new Error('Invalid FEISHU_USER_NAME_MAP JSON');
    }
  }

  private get multiSelectFields() {
    const raw = process.env.FEISHU_MULTI_SELECT_FIELDS;
    if (!raw) return [];
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private requireEnv(value: string | undefined, name: string) {
    if (!value) {
      throw new Error(`Missing env var: ${name}`);
    }
    return value;
  }

  private async getTenantAccessToken(): Promise<string> {
    const cached = this.cache;
    if (cached && cached.expiresAtMs > Date.now() + 60_000) {
      return cached.token;
    }

    const appId = this.requireEnv(this.appId, 'FEISHU_APP_ID');
    const appSecret = this.requireEnv(this.appSecret, 'FEISHU_APP_SECRET');

    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });

    if (!res.ok) {
      throw new Error(`Feishu auth failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { code: number; msg: string; tenant_access_token: string; expire: number };
    if (data.code !== 0) {
      throw new Error(`Feishu auth failed: ${data.code} ${data.msg}`);
    }

    const expiresAtMs = Date.now() + data.expire * 1000;
    this.cache = { token: data.tenant_access_token, expiresAtMs };
    return data.tenant_access_token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getTenantAccessToken();
    const res = await fetch(`https://open.feishu.cn/open-apis${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      throw new Error(`Feishu API failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { code: number; msg: string; data?: T };
    if (data.code !== 0) {
      throw new Error(`Feishu API failed: ${data.code} ${data.msg}`);
    }

    return data.data as T;
  }

  private normalizeFieldNames(fieldNames?: string) {
    if (!fieldNames) return undefined;
    const trimmed = fieldNames.trim();
    if (trimmed.startsWith('[')) return trimmed;
    return JSON.stringify(trimmed.split(',').map((name) => name.trim()).filter(Boolean));
  }

  private normalizeDate(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const ts = Date.parse(value);
      if (!Number.isNaN(ts)) return ts;
    }
    return null;
  }

  private normalizeProgress(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 1 ? value / 100 : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.replace('%', '').trim();
      const num = Number(trimmed);
      if (Number.isFinite(num)) return num > 1 ? num / 100 : num;
    }
    return null;
  }

  private normalizeAssignee(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const name = value.trim();
      if (!name) return null;
      const mapped = this.userNameMap[name];
      if (!mapped) {
        throw new Error(`Unknown assignee name: ${name}. Add to FEISHU_USER_NAME_MAP.`);
      }
      return [{ id: mapped }];
    }
    return value;
  }

  private normalizeMultiSelect(value: unknown) {
    if (value === null || value === undefined || value === '') return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return value;
  }

  private extractAssigneeText(value: unknown) {
    if (Array.isArray(value)) {
      const names = value
        .map((item) => {
          if (item && typeof item === 'object') {
            const candidate = (item as any).name || (item as any).en_name || (item as any).id;
            if (candidate) return String(candidate);
          }
          if (typeof item === 'string') return item;
          return '';
        })
        .filter(Boolean);
      return names.join(', ');
    }
    if (typeof value === 'string') return value;
    return '';
  }

  private normalizeFields(fields: Record<string, unknown>) {
    const multiSelect = new Set(this.multiSelectFields);
    const withMultiSelect = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => (
        multiSelect.has(key) ? [key, this.normalizeMultiSelect(value)] : [key, value]
      ))
    );
    return {
      ...withMultiSelect,
      负责人: this.normalizeAssignee(withMultiSelect['负责人']),
      开始时间: this.normalizeDate(withMultiSelect['开始时间']),
      截止时间: this.normalizeDate(withMultiSelect['截止时间']),
      进度: this.normalizeProgress(withMultiSelect['进度'])
    };
  }

  async listRecords(query: {
    pageSize?: number;
    pageToken?: string;
    viewId?: string;
    filter?: string;
    sort?: string;
    fieldNames?: string;
    textFieldAsArray?: boolean;
    displayFormulaRef?: boolean;
    automaticFields?: boolean;
    userIdType?: string;
    search?: string;
    searchFields?: string;
    filterProject?: string;
    filterStatus?: string;
    filterAssignee?: string;
    filterRisk?: string;
  }) {
    const appToken = this.requireEnv(this.appToken, 'FEISHU_APP_TOKEN');
    const tableId = this.requireEnv(this.tableId, 'FEISHU_TABLE_ID');
    const params = new URLSearchParams();

    if (query.pageSize) params.set('page_size', String(query.pageSize));
    if (query.pageToken) params.set('page_token', query.pageToken);
    if (query.viewId) params.set('view_id', query.viewId);
    if (query.filter) params.set('filter', query.filter);
    if (query.sort) params.set('sort', query.sort);
    const fieldNames = this.normalizeFieldNames(query.fieldNames);
    if (fieldNames) params.set('field_names', fieldNames);
    if (query.textFieldAsArray !== undefined) params.set('text_field_as_array', String(query.textFieldAsArray));
    if (query.displayFormulaRef !== undefined) params.set('display_formula_ref', String(query.displayFormulaRef));
    if (query.automaticFields !== undefined) params.set('automatic_fields', String(query.automaticFields));
    const userIdType = query.userIdType || this.userIdType;
    if (userIdType) params.set('user_id_type', userIdType);

    const data = await this.request<{ items: Array<Record<string, unknown>>; page_token?: string; has_more?: boolean }>(
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records?${params.toString()}`
    );

    const filterProject = query.filterProject?.trim();
    const filterStatus = query.filterStatus?.trim();
    const filterAssignee = query.filterAssignee?.trim().toLowerCase();
    const filterRisk = query.filterRisk?.trim();

    let items = data.items;
    if (filterProject || filterStatus || filterAssignee || filterRisk) {
      items = items.filter((item: any) => {
        const fields = item?.fields || {};
        const project = String(fields['所属项目'] ?? '');
        const status = String(fields['状态'] ?? '');
        const risk = String(fields['风险等级'] ?? '');
        const assignee = this.extractAssigneeText(fields['负责人']);
        if (filterProject && project !== filterProject) return false;
        if (filterStatus && status !== filterStatus) return false;
        if (filterRisk && risk !== filterRisk) return false;
        if (filterAssignee && !assignee.toLowerCase().includes(filterAssignee)) return false;
        return true;
      });
    }

    if (query.search) {
      const searchText = query.search.toLowerCase();
      const searchFields = (query.searchFields || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      items = items.filter((item: any) => {
        const fields = item?.fields || {};
        const entries = searchFields.length
          ? searchFields.map((key) => [key, fields[key]])
          : Object.entries(fields);

        return entries.some(([, value]) => {
          if (value === null || value === undefined) return false;
          if (typeof value === 'string') return value.toLowerCase().includes(searchText);
          return JSON.stringify(value).toLowerCase().includes(searchText);
        });
      });
    }

    if (items === data.items && !query.search) {
      return data;
    }

    return {
      ...data,
      items,
      search_applied: Boolean(query.search),
      filters_applied: Boolean(filterProject || filterStatus || filterAssignee || filterRisk)
    };
  }

  async createRecord(fields: Record<string, unknown>) {
    const appToken = this.requireEnv(this.appToken, 'FEISHU_APP_TOKEN');
    const tableId = this.requireEnv(this.tableId, 'FEISHU_TABLE_ID');
    const normalized = this.normalizeFields(fields);
    const userIdType = this.userIdType ? `?user_id_type=${encodeURIComponent(this.userIdType)}` : '';

    return this.request(
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records${userIdType}`,
      {
        method: 'POST',
        body: JSON.stringify({ fields: normalized })
      }
    );
  }

  async updateRecord(recordId: string, fields: Record<string, unknown>) {
    const appToken = this.requireEnv(this.appToken, 'FEISHU_APP_TOKEN');
    const tableId = this.requireEnv(this.tableId, 'FEISHU_TABLE_ID');
    const normalized = this.normalizeFields(fields);
    const userIdType = this.userIdType ? `?user_id_type=${encodeURIComponent(this.userIdType)}` : '';

    return this.request(
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}${userIdType}`,
      {
        method: 'PUT',
        body: JSON.stringify({ fields: normalized })
      }
    );
  }

  async deleteRecord(recordId: string) {
    const appToken = this.requireEnv(this.appToken, 'FEISHU_APP_TOKEN');
    const tableId = this.requireEnv(this.tableId, 'FEISHU_TABLE_ID');

    return this.request(
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
      { method: 'DELETE' }
    );
  }
}
