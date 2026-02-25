import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { FeishuUsersService } from '../feishu-users/feishu-users.service';

type TokenCache = {
  appId: string;
  token: string;
  expiresAtMs: number;
};

@Injectable()
export class FeishuService {
  private readonly logger = new Logger(FeishuService.name);
  private cache: TokenCache | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly feishuUsersService: FeishuUsersService
  ) { }

  private get appId() {
    return this.configService.getRawValue('FEISHU_APP_ID');
  }

  private get appSecret() {
    return this.configService.getRawValue('FEISHU_APP_SECRET');
  }

  private get appToken() {
    return this.configService.getRawValue('FEISHU_APP_TOKEN');
  }

  private get tableId() {
    return this.configService.getRawValue('FEISHU_TABLE_ID');
  }

  private get userIdType() {
    return this.configService.getRawValue('FEISHU_USER_ID_TYPE');
  }

  private get userNameMap() {
    return {};
  }

  private get multiSelectFields() {
    const raw = this.configService.getRawValue('FEISHU_MULTI_SELECT_FIELDS');
    if (!raw) return [];
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => this.resolveFieldName(item));
  }

  private get fieldMap() {
    const raw = this.configService.getRawValue('FEISHU_FIELD_MAP');
    if (!raw) return {};
    const trimmed = raw.trim();
    try {
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
              .map(([k, v]) => [String(k).trim(), String(v).trim()])
              .filter(([k, v]) => k && v)
          );
        }
      }
    } catch {
      // fall through to csv parsing
    }
    return Object.fromEntries(
      trimmed
        .split(',')
        .map((pair) => pair.trim())
        .filter(Boolean)
        .map((pair) => {
          const [left, right] = pair.split(/[:=]/, 2).map((v) => v?.trim());
          return [left || '', right || ''];
        })
        .filter(([k, v]) => k && v)
    );
  }

  private resolveFieldName(name: string) {
    const mapped = this.fieldMap[name];
    return mapped && mapped.trim() ? mapped.trim() : name;
  }

  private mapFieldsToLogical(fields: Record<string, unknown> | null | undefined) {
    if (!fields || typeof fields !== 'object') return fields as Record<string, unknown> | null | undefined;
    const inverseMap = Object.fromEntries(
      Object.entries(this.fieldMap).map(([logical, actual]) => [actual, logical])
    );
    const mapped: Record<string, unknown> = {};
    Object.entries(fields).forEach(([key, value]) => {
      const logical = inverseMap[key] || key;
      if (mapped[logical] === undefined) {
        mapped[logical] = value;
      }
    });
    return mapped;
  }

  private requireEnv(value: string | undefined, name: string) {
    if (!value) {
      throw new BadRequestException(`Missing env var: ${name}`);
    }
    return value;
  }

  private async getTenantAccessToken(): Promise<string> {
    const appId = this.requireEnv(this.appId, 'FEISHU_APP_ID');
    const appSecret = this.requireEnv(this.appSecret, 'FEISHU_APP_SECRET');

    const cached = this.cache;
    if (cached && cached.appId === appId && cached.expiresAtMs > Date.now() + 60_000) {
      return cached.token;
    }

    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });

    if (!res.ok) {
      throw new BadRequestException(`Feishu auth failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { code: number; msg: string; tenant_access_token: string; expire: number };
    if (data.code !== 0) {
      throw new BadRequestException(`Feishu auth failed: ${data.code} ${data.msg}`);
    }

    const expiresAtMs = Date.now() + data.expire * 1000;
    this.cache = { token: data.tenant_access_token, expiresAtMs, appId };
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
      throw new BadRequestException(`Feishu API failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { code: number; msg: string; data?: T };
    if (data.code !== 0) {
      throw new BadRequestException(`Feishu API failed: ${data.code} ${data.msg}`);
    }

    return data.data as T;
  }

  private normalizeFieldNames(fieldNames?: string) {
    if (!fieldNames) return undefined;
    const trimmed = fieldNames.trim();
    if (trimmed.startsWith('[')) return trimmed;
    return JSON.stringify(
      trimmed
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => this.resolveFieldName(name))
    );
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

  private async normalizeAssignee(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const userNameMap = await this.feishuUsersService.getNameToOpenIdMap();
    if (typeof value === 'object' && !Array.isArray(value)) return value;

    if (Array.isArray(value)) {
      const ids = value.map((v) => {
        const name = typeof v === 'object' ? (v as any).name : String(v);
        const mapped = userNameMap[name];
        if (!mapped) {
          throw new BadRequestException(`识别到未知的负责人：${name}。请前往人员名册补齐或清空负责人重新创建。`);
        }
        return { id: mapped };
      });
      return ids;
    }

    if (typeof value === 'string') {
      const names = value.split(',').map((n) => n.trim()).filter(Boolean);
      const ids = names.map((name) => {
        const mapped = userNameMap[name];
        if (!mapped) {
          throw new BadRequestException(`识别到未知的负责人：${name}。请前往人员名册补配或清空负责人重新创建。`);
        }
        return { id: mapped };
      });
      return ids;
    }

    return value;
  }

  private normalizeMultiSelect(value: unknown) {
    if (value === null || value === undefined || value === '') return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return value;
  }

  private extractUserInfo(value: unknown): { name: string; openId: string }[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const name = (item as any).name || (item as any).en_name;
          const openId = (item as any).id;
          if (name && openId) return { name: String(name), openId: String(openId) };
        }
        return null;
      })
      .filter((u): u is { name: string; openId: string } => !!u);
  }

  private extractAssigneeText(value: unknown) {
    const users = this.extractUserInfo(value);
    if (users.length > 0) return users.map((u) => u.name).join(', ');
    if (typeof value === 'string') return value;
    return '';
  }

  private async normalizeFields(fields: Record<string, unknown>, options?: { normalizeAssignee?: boolean }) {
    const mappedFields = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [this.resolveFieldName(key), value])
    );
    const multiSelect = new Set(this.multiSelectFields);
    const withMultiSelect = Object.fromEntries(
      Object.entries(mappedFields).map(([key, value]) => (
        multiSelect.has(key) ? [key, this.normalizeMultiSelect(value)] : [key, value]
      ))
    );
    const normalizeAssignee = options?.normalizeAssignee !== false;
    const assigneeKey = this.resolveFieldName('负责人');
    return {
      ...withMultiSelect,
      [assigneeKey]: normalizeAssignee
        ? await this.normalizeAssignee(withMultiSelect[assigneeKey])
        : withMultiSelect[assigneeKey],
      [this.resolveFieldName('开始时间')]: this.normalizeDate(withMultiSelect[this.resolveFieldName('开始时间')]),
      [this.resolveFieldName('截止时间')]: this.normalizeDate(withMultiSelect[this.resolveFieldName('截止时间')]),
      [this.resolveFieldName('进度')]: this.normalizeProgress(withMultiSelect[this.resolveFieldName('进度')])
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

    let data: { items: Array<Record<string, unknown>>; page_token?: string; has_more?: boolean };
    const url = `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records?${params.toString()}`;
    try {
      data = await this.request(url);
    } catch (err: any) {
      const message = err?.message || '';
      if (fieldNames && message.includes('FieldNameNotFound')) {
        this.logger.warn(`Feishu field_names invalid, retrying without field_names: ${fieldNames}`);
        params.delete('field_names');
        const fallbackUrl = `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records?${params.toString()}`;
        data = await this.request(fallbackUrl);
      } else {
        throw err;
      }
    }

    const mappedItems = (data.items || []).map((item: any) => ({
      ...item,
      fields: this.mapFieldsToLogical(item?.fields as Record<string, unknown> | undefined)
    }));

    // 自动收集名册：提取所有记录中的负责人信息并全量同步入库
    try {
      const allUsersFound: { name: string; openId: string }[] = [];
      mappedItems.forEach((item: any) => {
        const users = this.extractUserInfo(item?.fields?.['负责人']);
        allUsersFound.push(...users);
      });
      // 去重并静默保存
      const uniqueUsers = Array.from(new Map(allUsersFound.map(u => [u.name, u])).values());
      if (uniqueUsers.length > 0) {
        void this.feishuUsersService.upsertMany(uniqueUsers);
      }
    } catch (e: any) {
      this.logger.warn(`Failed to auto-collect feishu users: ${e.message}`);
    }

    const filterProject = query.filterProject?.trim();
    const filterStatus = query.filterStatus?.trim();
    const filterAssignee = query.filterAssignee?.trim().toLowerCase();
    const filterRisk = query.filterRisk?.trim();

    const projectKey = this.resolveFieldName('所属项目');
    const statusKey = this.resolveFieldName('状态');
    const riskKey = this.resolveFieldName('风险等级');
    const assigneeKey = this.resolveFieldName('负责人');

    let items = mappedItems;
    if (filterProject || filterStatus || filterAssignee || filterRisk) {
      items = items.filter((item: any) => {
        const fields = item?.fields || {};
        const project = String(fields[projectKey] ?? '');
        const status = String(fields[statusKey] ?? '');
        const risk = String(fields[riskKey] ?? '');
        const assignee = this.extractAssigneeText(fields[assigneeKey]);
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

    if (items === mappedItems && !query.search) {
      return { ...data, items: mappedItems };
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
    const normalized = await this.normalizeFields(fields);
    const userIdType = this.userIdType ? `?user_id_type=${encodeURIComponent(this.userIdType)}` : '';
    try {
      return await this.request(
        `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records${userIdType}`,
        {
          method: 'POST',
          body: JSON.stringify({ fields: normalized })
        }
      );
    } catch (err: any) {
      const message = err?.message || '';
      if (message.includes('SingleSelectFieldConvFail')) {
        const fallback = await this.normalizeFields(fields, { normalizeAssignee: false });
        return this.request(
          `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records${userIdType}`,
          {
            method: 'POST',
            body: JSON.stringify({ fields: fallback })
          }
        );
      }
      throw err;
    }
  }

  async updateRecord(recordId: string, fields: Record<string, unknown>) {
    const appToken = this.requireEnv(this.appToken, 'FEISHU_APP_TOKEN');
    const tableId = this.requireEnv(this.tableId, 'FEISHU_TABLE_ID');
    const normalized = await this.normalizeFields(fields);
    const userIdType = this.userIdType ? `?user_id_type=${encodeURIComponent(this.userIdType)}` : '';
    try {
      return await this.request(
        `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}${userIdType}`,
        {
          method: 'PUT',
          body: JSON.stringify({ fields: normalized })
        }
      );
    } catch (err: any) {
      const message = err?.message || '';
      if (message.includes('SingleSelectFieldConvFail')) {
        const fallback = await this.normalizeFields(fields, { normalizeAssignee: false });
        return this.request(
          `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}${userIdType}`,
          {
            method: 'PUT',
            body: JSON.stringify({ fields: fallback })
          }
        );
      }
      throw err;
    }
  }

  async deleteRecord(recordId: string) {
    const appToken = this.requireEnv(this.appToken, 'FEISHU_APP_TOKEN');
    const tableId = this.requireEnv(this.tableId, 'FEISHU_TABLE_ID');

    return this.request(
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
      { method: 'DELETE' }
    );
  }

  async sendInteractiveMessage(input: {
    receiveId: string;
    receiveIdType?: 'chat_id' | 'open_id' | 'user_id' | 'email';
    card: Record<string, unknown>;
    mentions?: Array<{ key: string; id: { open_id: string } }>;
  }) {
    const receiveIdType = input.receiveIdType || 'chat_id';
    const payload: Record<string, unknown> = {
      receive_id: input.receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(input.card),
    };
    if (input.mentions && input.mentions.length > 0) {
      payload.mentions = input.mentions;
    }
    return this.request(`/im/v1/messages?receive_id_type=${receiveIdType}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}
