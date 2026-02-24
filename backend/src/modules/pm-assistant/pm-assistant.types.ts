export type PmJobId =
  | 'morning-briefing'
  | 'meeting-materials'
  | 'risk-alerts'
  | 'overdue-reminder'
  | 'milestone-reminder'
  | 'blocked-alert'
  | 'resource-load'
  | 'progress-board'
  | 'trend-predict'
  | 'weekly-agenda'
  | 'daily-report'
  | 'weekly-report';

export type PmJobMeta = {
  id: PmJobId;
  name: string;
  color: 'red' | 'orange' | 'green' | 'blue' | 'purple';
  description: string;
};

export type FeishuTaskRecord = {
  id: string;
  fields: Record<string, unknown>;
};

export type PmRunResult = {
  jobId: PmJobId;
  sent: boolean;
  summary: string;
  card: unknown;
};

export type PmRunLog = {
  id: string;
  jobId: PmJobId;
  triggeredBy: 'manual' | 'schedule';
  status: 'success' | 'failed' | 'dry-run' | 'skipped';
  summary: string;
  rawSummary?: string;
  aiSummary?: string;
  error?: string;
  createdAt: string;
};

export type PmScheduleDefinition = {
  id: string;
  name: string;
  jobs: PmJobId[];
  defaultCron: string;
};

export type PmScheduleState = {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  jobs: PmJobId[];
};
