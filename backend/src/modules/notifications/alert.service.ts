import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';

export type AlertType = 'risk' | 'milestone' | 'system';

export interface SendAlertOptions {
  to: string;
  subject: string;
  body: string;
  type: AlertType;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(private readonly emailService: EmailService) {}

  async sendAlert(opts: SendAlertOptions): Promise<void> {
    const { to, subject, body, type } = opts;

    const badgeColor = this.typeBadgeColor(type);
    const badgeLabel = this.typeLabel(type);
    const html = this.buildHtml(subject, body, badgeLabel, badgeColor);

    await this.emailService.sendEmail(to, subject, html);
    this.logger.log(`Alert sent to ${to} [${type}]: ${subject}`);
  }

  private typeBadgeColor(type: AlertType): string {
    const map: Record<AlertType, string> = {
      risk: '#dc2626',
      milestone: '#2563eb',
      system: '#6b7280',
    };
    return map[type];
  }

  private typeLabel(type: AlertType): string {
    const map: Record<AlertType, string> = {
      risk: 'Risk Alert',
      milestone: 'Milestone',
      system: 'System',
    };
    return map[type];
  }

  private buildHtml(
    subject: string,
    body: string,
    badgeLabel: string,
    badgeColor: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${this.escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'PingFang SC','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#2563eb;border-radius:8px 8px 0 0;padding:24px 32px;">
              <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">
                ProjectLVQI
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-top:none;">
              <!-- Badge + Subject -->
              <div style="margin-bottom:20px;">
                <span style="display:inline-block;background:${badgeColor};color:#ffffff;font-size:12px;font-weight:600;
                             padding:3px 10px;border-radius:4px;letter-spacing:0.5px;margin-bottom:8px;">
                  ${badgeLabel}
                </span>
                <h2 style="margin:0;font-size:20px;font-weight:600;color:#1f2937;line-height:1.4;">
                  ${this.escapeHtml(subject)}
                </h2>
              </div>

              <!-- Body -->
              <div style="font-size:15px;color:#374151;line-height:1.8;white-space:pre-wrap;">${this.escapeHtml(body)}</div>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />

              <!-- Footer -->
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                This message was sent automatically by <strong>ProjectLVQI</strong>.<br />
                Please do not reply directly to this email.
              </p>
            </td>
          </tr>

          <!-- Bottom bar -->
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb;padding:16px 32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Project Management System · ProjectLVQI
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
