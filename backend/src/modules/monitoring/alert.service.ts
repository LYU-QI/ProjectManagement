import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { MetricsService } from './metrics.service';
import { ConfigService } from '../config/config.service';

interface AlertResult {
  triggered: boolean;
  condition: string;
  value: number;
  threshold: number;
}

@Injectable()
export class AlertService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertService.name);

  // Alert thresholds
  private readonly ERROR_RATE_THRESHOLD = 0.05; // 5%
  private readonly RESPONSE_TIME_THRESHOLD_MS = 2000; // 2s
  private readonly CHECK_INTERVAL_CRON = '*/5 * * * *'; // every 5 minutes

  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    this.schedulerRegistry.addCronJob('alert-check', new CronJob(this.CHECK_INTERVAL_CRON, () => {
      this.checkAndAlert().catch((err) => {
        this.logger.error('Alert check failed', err);
      });
    }));
    this.schedulerRegistry.getCronJob('alert-check').start();
    this.logger.log('Alert service started (checking every 5 minutes)');
  }

  onModuleDestroy() {
    try {
      this.schedulerRegistry.getCronJob('alert-check').stop();
    } catch {
      // ignore if not running
    }
  }

  async checkAndAlert(): Promise<void> {
    const alerts: AlertResult[] = [];
    const messages: string[] = [];

    // Check error rate
    const errorRate = this.metricsService.getErrorRate();
    if (errorRate > this.ERROR_RATE_THRESHOLD) {
      alerts.push({
        triggered: true,
        condition: 'error_rate_high',
        value: errorRate,
        threshold: this.ERROR_RATE_THRESHOLD,
      });
      messages.push(
        `Error rate: ${(errorRate * 100).toFixed(2)}% (threshold: ${(this.ERROR_RATE_THRESHOLD * 100).toFixed(0)}%)`,
      );
    }

    // Check average response time
    const avgResponseTime = this.metricsService.getAverageResponseTime();
    if (avgResponseTime > this.RESPONSE_TIME_THRESHOLD_MS) {
      alerts.push({
        triggered: true,
        condition: 'response_time_high',
        value: avgResponseTime,
        threshold: this.RESPONSE_TIME_THRESHOLD_MS,
      });
      messages.push(
        `Avg response time: ${avgResponseTime.toFixed(0)}ms (threshold: ${this.RESPONSE_TIME_THRESHOLD_MS}ms)`,
      );
    }

    if (alerts.length === 0) {
      this.logger.debug('No alerts triggered');
      return;
    }

    const alertMessage =
      `[ALERT] ${new Date().toISOString()}\n` +
      messages.join('\n') +
      `\nRequests in last 5 min: ${this.metricsService.getRequestCount()}`;

    this.logger.warn(alertMessage);

    // Send to FeishuService if configured
    await this.sendAlert(alertMessage, alerts);
  }

  private async sendAlert(message: string, _alerts: AlertResult[]): Promise<void> {
    try {
      const alertWebhook = await this.configService.get('ALERT_WEBHOOK_URL');
      if (!alertWebhook) {
        this.logger.debug('No alert webhook configured');
        return;
      }

      await fetch(alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg_type: 'text', content: { text: message } }),
      });
    } catch (err) {
      this.logger.error('Failed to send alert notification', err);
    }
  }
}
