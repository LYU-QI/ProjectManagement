import type { FeishuFormState } from './types';

export const FEISHU_FIELDS: Array<{ key: keyof FeishuFormState; label: string; type: 'text' | 'select' | 'date' | 'number'; options?: string[]; required?: boolean }> = [
  { key: '任务ID', label: '任务ID', type: 'text', required: true },
  { key: '任务名称', label: '任务名称', type: 'text', required: true },
  { key: '状态', label: '状态', type: 'select', options: ['待办', '进行中', '已完成'], required: true },
  { key: '优先级', label: '优先级', type: 'select', options: ['低', '中', '高'], required: true },
  { key: '负责人', label: '负责人(姓名)', type: 'text', required: true },
  { key: '开始时间', label: '开始时间', type: 'date' },
  { key: '截止时间', label: '截止时间', type: 'date' },
  { key: '进度', label: '进度(0-100)', type: 'number' },
  { key: '所属项目', label: '所属项目', type: 'select' },
  { key: '是否阻塞', label: '是否阻塞', type: 'select', options: ['是', '否'], required: true },
  { key: '阻塞原因', label: '阻塞原因', type: 'text' },
  { key: '风险等级', label: '风险等级', type: 'select', options: ['低', '中', '高'], required: true }
];

export const FEISHU_FIELD_NAMES = FEISHU_FIELDS.map((item) => item.key).join(',');

export const FEISHU_DEFAULT_FORM: FeishuFormState = {
  任务ID: '',
  任务名称: '',
  状态: '待办',
  优先级: '中',
  负责人: '',
  开始时间: '',
  截止时间: '',
  进度: '',
  所属项目: '',
  是否阻塞: '否',
  阻塞原因: '',
  风险等级: '中'
};
