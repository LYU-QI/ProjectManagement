import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { ConfigService } from '../config/config.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.getRawValue('SMTP_HOST');
    const port = parseInt(this.configService.getRawValue('SMTP_PORT') ?? '587', 10);
    const user = this.configService.getRawValue('SMTP_USER');
    const password = this.configService.getRawValue('SMTP_PASSWORD');
    this.fromAddress = this.configService.getRawValue('SMTP_FROM') ?? 'noreply@projectlvqi.local';

    if (!host) {
      this.transporter = null;
      this.logger.warn(
        'SMTP not configured (SMTP_HOST not set). Email sending is disabled. ' +
        'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM to enable.'
      );
      return;
    }

    const auth = user && password ? { user, pass: password } : undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      tls: port === 587 ? { rejectUnauthorized: false } : undefined,
      auth,
      connectionTimeout: 10000,
    });

    this.logger.log(`SMTP transport initialized: ${host}:${port}`);
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.debug(`SMTP not configured — skipping email to ${to}: ${subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send email to ${to}: ${detail}`);
      // Graceful degradation — do not throw
    }
  }
}
