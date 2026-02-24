import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '../config/config.service';
import { PmAssistantService } from './pm-assistant.service';
import { PrismaService } from '../../database/prisma.service';
import type { PmJobId, PmScheduleDefinition, PmScheduleState } from './pm-assistant.types';

const DEFAULT_TZ = 'Asia/Shanghai';
const SCHEDULES: PmScheduleDefinition[] = [
  {
    id: 'morning-batch',
    name: '早间批次（10:00）',
    jobs: ['morning-briefing', 'meeting-materials', 'resource-load', 'risk-alerts', 'overdue-reminder', 'milestone-reminder', 'blocked-alert'],
    defaultCron: '0 10 * * 1-6'
  },
  {
    id: 'noon-trend',
    name: '午间趋势（12:00）',
    jobs: ['trend-predict', 'overdue-reminder'],
    defaultCron: '0 12 * * 1-6'
  },
  {
    id: 'afternoon-risk',
    name: '下午风险（14:00）',
    jobs: ['risk-alerts', 'overdue-reminder'],
    defaultCron: '0 14 * * 1-6'
  },
  {
    id: 'afternoon-progress',
    name: '进度看板（15:00）',
    jobs: ['milestone-reminder', 'blocked-alert', 'progress-board'],
    defaultCron: '0 15 * * 1-6'
  },
  {
    id: 'overdue-16',
    name: '超期提醒（16:00）',
    jobs: ['overdue-reminder'],
    defaultCron: '0 16 * * 1-6'
  },
  {
    id: 'overdue-18',
    name: '超期提醒（18:00）',
    jobs: ['overdue-reminder'],
    defaultCron: '0 18 * * 1-6'
  },
  {
    id: 'daily-report',
    name: '晚间日报（19:00）',
    jobs: ['daily-report'],
    defaultCron: '0 19 * * 1-6'
  },
  {
    id: 'weekly-agenda',
    name: '周会讨论要点（周六 10:00）',
    jobs: ['weekly-agenda'],
    defaultCron: '0 10 * * 6'
  },
  {
    id: 'weekly-report',
    name: '周报（周六 17:00）',
    jobs: ['weekly-report'],
    defaultCron: '0 17 * * 6'
  }
];

@Injectable()
export class PmAssistantScheduler implements OnModuleInit {
  private readonly logger = new Logger(PmAssistantScheduler.name);

  constructor(
    private readonly pmAssistantService: PmAssistantService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    this.refreshSchedules();
    this.ensureCleanupJob();
  }

  private isEnabled() {
    const raw = this.configService.getRawValue('FEISHU_PM_ASSISTANT_ENABLED');
    if (!raw) return false;
    return ['true', '1', 'yes', 'on'].includes(raw.toLowerCase());
  }

  private getTimezone() {
    return this.configService.getRawValue('FEISHU_PM_ASSISTANT_TZ') || DEFAULT_TZ;
  }

  private cronKey(id: string) {
    return `FEISHU_PM_ASSISTANT_CRON_${id.toUpperCase().replace(/-/g, '_')}`;
  }

  private getCron(def: PmScheduleDefinition) {
    const key = this.cronKey(def.id);
    return this.configService.getRawValue(key) || def.defaultCron;
  }

  private async run(jobId: PmJobId) {
    if (!this.isEnabled()) return;
    try {
      const projects = await this.prisma.project.findMany({
        where: { feishuChatIds: { not: null } },
        select: { id: true, feishuChatIds: true }
      });
      const projectTargets = projects.filter((p) => (p.feishuChatIds || '').trim().length > 0);
      if (projectTargets.length > 0) {
        await Promise.all(projectTargets.map((p) => this.pmAssistantService.runJob(jobId, { triggeredBy: 'schedule', projectId: p.id })));
      } else {
        await this.pmAssistantService.runJob(jobId, { triggeredBy: 'schedule' });
      }
      this.logger.log(`PM Assistant job sent: ${jobId}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`PM Assistant job failed: ${jobId} (${detail})`);
    }
  }

  getSchedules(): PmScheduleState[] {
    const timezone = this.getTimezone();
    return SCHEDULES.map((def) => ({
      id: def.id,
      name: def.name,
      cron: this.getCron(def),
      timezone,
      jobs: def.jobs
    }));
  }

  updateSchedule(id: string, cron: string) {
    const def = SCHEDULES.find((item) => item.id === id);
    if (!def) {
      throw new BadRequestException(`未知任务批次: ${id}`);
    }
    if (!cron || cron.split(' ').length < 5) {
      throw new BadRequestException('Cron 表达式不合法');
    }
    const key = this.cronKey(id);
    const result = this.configService.updateAll({ [key]: cron });
    if (!result.success) {
      throw new BadRequestException(result.message);
    }
    this.refreshSchedules();
    return result;
  }

  updateTimezone(timezone: string) {
    const result = this.configService.updateAll({ FEISHU_PM_ASSISTANT_TZ: timezone });
    if (!result.success) {
      throw new BadRequestException(result.message);
    }
    this.refreshSchedules();
    return result;
  }

  refreshSchedules() {
    const timezone = this.getTimezone();
    SCHEDULES.forEach((def) => {
      const name = `pm-assistant:${def.id}`;
      try {
        this.schedulerRegistry.deleteCronJob(name);
      } catch {
        // ignore if job does not exist
      }
      const cron = this.getCron(def);
      const job = new CronJob(
        cron,
        () => {
          def.jobs.forEach((jobId) => void this.run(jobId));
        },
        null,
        false,
        timezone
      );
      this.schedulerRegistry.addCronJob(name, job);
      job.start();
    });
  }

  private ensureCleanupJob() {
    const name = 'pm-assistant:cleanup';
    try {
      this.schedulerRegistry.deleteCronJob(name);
    } catch {
      // ignore
    }
    const job = new CronJob(
      '0 3 * * *',
      () => {
        void this.pmAssistantService.cleanupLogs(90);
      },
      null,
      false,
      this.getTimezone()
    );
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }
}
