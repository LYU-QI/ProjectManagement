import type { FeishuFormState } from './types';

export const FEISHU_FIELDS: Array<{ key: keyof FeishuFormState; label: string; type: 'text' | 'select' | 'date' | 'number'; options?: string[]; required?: boolean }> = [
  { key: '任务ID', label: '任务ID', type: 'text', required: true },
  { key: '任务名称', label: '任务名称', type: 'text', required: true },
  { key: '任务类型', label: '任务类型', type: 'select', options: ['需求', '开发', '测试', '缺陷', '风险', '会议纪要', '客户事项'] },
  { key: '状态', label: '状态', type: 'select', options: ['待办', '进行中', '已完成'], required: true },
  { key: '优先级', label: '优先级', type: 'select', options: ['低', '中', '高'], required: true },
  { key: '负责人', label: '负责人(姓名)', type: 'select', required: true },
  { key: '协作人', label: '协作人', type: 'text' },
  { key: '开始时间', label: '开始时间', type: 'date' },
  { key: '截止时间', label: '截止时间', type: 'date' },
  { key: '承诺时间', label: '承诺时间', type: 'date' },
  { key: '完成时间', label: '完成时间', type: 'date' },
  { key: '进度', label: '进度(0-100)', type: 'number' },
  { key: '所属项目', label: '所属项目', type: 'select' },
  { key: '是否阻塞', label: '是否阻塞', type: 'select', options: ['是', '否'], required: true },
  { key: '阻塞原因', label: '阻塞原因', type: 'text' },
  { key: '风险等级', label: '风险等级', type: 'select', options: ['低', '中', '高'], required: true },
  { key: '风险原因', label: '风险原因', type: 'text' },
  { key: '下一步动作', label: '下一步动作', type: 'text' },
  { key: '动作截止时间', label: '动作截止时间', type: 'date' },
  { key: '依赖/前置条件', label: '依赖/前置条件', type: 'text' },
  { key: '里程碑', label: '里程碑', type: 'select', options: ['是', '否'], required: true },
  { key: '更新时间', label: '更新时间', type: 'date' },
  { key: '更新人', label: '更新人', type: 'text' }
];

export const FEISHU_FIELD_NAMES = FEISHU_FIELDS.map((item) => item.key).join(',');

export const FEISHU_DEFAULT_FORM: FeishuFormState = {
  任务ID: '',
  任务名称: '',
  任务类型: '',
  状态: '待办',
  优先级: '中',
  负责人: '',
  协作人: '',
  开始时间: '',
  截止时间: '',
  承诺时间: '',
  完成时间: '',
  进度: '',
  所属项目: '',
  是否阻塞: '否',
  阻塞原因: '',
  风险等级: '中',
  风险原因: '',
  下一步动作: '',
  动作截止时间: '',
  '依赖/前置条件': '',
  里程碑: '否',
  更新时间: '',
  更新人: ''
};
