import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

export interface RequestRecord {
  method: string;
  endpoint: string;
  status: number;
  responseTimeMs: number;
  timestamp: number;
}

interface AggregatedMetrics {
  requests: Map<string, number>;
  errors: Map<string, number>;
  responseTimes: Map<string, number[]>;
}

/**
 * Ring-buffer backed metrics store.
 * Tracks the last N requests in memory and exposes them in Prometheus text format.
 */
@Injectable()
export class MetricsService {
  private readonly buffer: RequestRecord[] = [];
  private readonly maxBufferSize = 2000;

  constructor(private readonly configService: ConfigService) {}

  record(request: RequestRecord): void {
    this.buffer.push(request);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Returns a Prometheus-compatible text exposition format string.
   */
  toPrometheusFormat(): string {
    const cutoff = Date.now() - 5 * 60 * 1000; // 5-minute window
    const recent = this.buffer.filter((r) => r.timestamp > cutoff);

    const aggregated: AggregatedMetrics = {
      requests: new Map(),
      errors: new Map(),
      responseTimes: new Map(),
    };

    for (const rec of recent) {
      const key = `${rec.method}:${rec.endpoint}:${rec.status}`;

      aggregated.requests.set(key, (aggregated.requests.get(key) ?? 0) + 1);
      if (rec.status >= 400) {
        aggregated.errors.set(key, (aggregated.errors.get(key) ?? 0) + 1);
      }

      const rtKey = `${rec.method}:${rec.endpoint}`;
      const times = aggregated.responseTimes.get(rtKey) ?? [];
      times.push(rec.responseTimeMs);
      aggregated.responseTimes.set(rtKey, times);
    }

    const lines: string[] = [];

    // http_requests_total
    lines.push('# HELP http_requests_total Total HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    for (const [key, count] of aggregated.requests) {
      const [method, endpoint, status] = key.split(':');
      const labels = `method="${method}",endpoint="${endpoint}",status="${status}"`;
      lines.push(`http_requests_total{${labels}} ${count}`);
    }

    // http_request_errors_total
    lines.push('# HELP http_request_errors_total Total HTTP error responses (4xx/5xx)');
    lines.push('# TYPE http_request_errors_total counter');
    for (const [key, count] of aggregated.errors) {
      const [method, endpoint, status] = key.split(':');
      const labels = `method="${method}",endpoint="${endpoint}",status="${status}"`;
      lines.push(`http_request_errors_total{${labels}} ${count}`);
    }

    // http_request_duration_seconds (histogram buckets)
    lines.push('# HELP http_request_duration_seconds Average HTTP request duration');
    lines.push('# TYPE http_request_duration_seconds gauge');
    for (const [key, times] of aggregated.responseTimes) {
      const [method, endpoint] = key.split(':');
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const avgSeconds = (avg / 1000).toFixed(6);
      const labels = `method="${method}",endpoint="${endpoint}"`;
      lines.push(`http_request_duration_seconds{${labels}} ${avgSeconds}`);
    }

    // Summary metrics
    const totalRequests = recent.length;
    const totalErrors = recent.filter((r) => r.status >= 400).length;
    const allResponseTimes = recent.map((r) => r.responseTimeMs);
    const overallAvg =
      allResponseTimes.length > 0
        ? (allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length / 1000).toFixed(6)
        : '0';

    lines.push('');
    lines.push('# HELP http_requests_summary_total Total requests in last 5 minutes');
    lines.push('# TYPE http_requests_summary_total gauge');
    lines.push(`http_requests_summary_total ${totalRequests}`);
    lines.push('');
    lines.push('# HELP http_errors_summary_total Total errors in last 5 minutes');
    lines.push('# TYPE http_errors_summary_total gauge');
    lines.push(`http_errors_summary_total ${totalErrors}`);
    lines.push('');
    lines.push('# HELP http_request_duration_seconds_avg Overall average response time (seconds)');
    lines.push('# TYPE http_request_duration_seconds_avg gauge');
    lines.push(`http_request_duration_seconds_avg ${overallAvg}`);

    return lines.join('\n');
  }

  getRecentRequests(count = 100): RequestRecord[] {
    return this.buffer.slice(-count);
  }

  getErrorRate(): number {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const recent = this.buffer.filter((r) => r.timestamp > cutoff);
    if (recent.length === 0) return 0;
    const errors = recent.filter((r) => r.status >= 400).length;
    return errors / recent.length;
  }

  getAverageResponseTime(): number {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const recent = this.buffer.filter((r) => r.timestamp > cutoff);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, r) => sum + r.responseTimeMs, 0) / recent.length;
  }

  getRequestCount(): number {
    const cutoff = Date.now() - 5 * 60 * 1000;
    return this.buffer.filter((r) => r.timestamp > cutoff).length;
  }
}
