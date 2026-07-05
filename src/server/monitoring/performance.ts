// 性能监控服务

export interface PerformanceRecord {
  id: string;
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: number;
  tokenUsage?: number;
  error?: string;
}

export interface PerformanceStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  endpoints: Record<string, { count: number; avgDuration: number }>;
  tokenUsage: number;
}

const MAX_RECORDS = 1000;
const records: PerformanceRecord[] = [];

function generateId(): string {
  return `perf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordPerformance(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number,
  tokenUsage?: number,
  error?: string,
): void {
  const record: PerformanceRecord = {
    id: generateId(),
    endpoint,
    method,
    duration,
    statusCode,
    timestamp: Date.now(),
    tokenUsage,
    error,
  };

  records.push(record);
  if (records.length > MAX_RECORDS) {
    records.shift();
  }
}

export function getStats(hours: number = 24): PerformanceStats {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const recent = records.filter((r) => r.timestamp >= cutoff);

  if (recent.length === 0) {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgDuration: 0,
      p95Duration: 0,
      p99Duration: 0,
      endpoints: {},
      tokenUsage: 0,
    };
  }

  const durations = recent.map((r) => r.duration).sort((a, b) => a - b);
  const successful = recent.filter((r) => r.statusCode >= 200 && r.statusCode < 400);
  const tokenUsage = recent.reduce((sum, r) => sum + (r.tokenUsage || 0), 0);

  const endpoints: Record<string, { count: number; avgDuration: number }> = {};
  for (const r of recent) {
    const key = `${r.method} ${r.endpoint}`;
    if (!endpoints[key]) {
      endpoints[key] = { count: 0, avgDuration: 0 };
    }
    endpoints[key].count++;
    endpoints[key].avgDuration += r.duration;
  }
  for (const key of Object.keys(endpoints)) {
    endpoints[key].avgDuration = Math.round(endpoints[key].avgDuration / endpoints[key].count);
  }

  return {
    totalRequests: recent.length,
    successfulRequests: successful.length,
    failedRequests: recent.length - successful.length,
    avgDuration: Math.round(recent.reduce((sum, r) => sum + r.duration, 0) / recent.length),
    p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
    p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
    endpoints,
    tokenUsage,
  };
}

export function getRecentRecords(limit: number = 50): PerformanceRecord[] {
  return [...records].reverse().slice(0, limit);
}

export function clearRecords(): void {
  records.length = 0;
}

export function initPerformanceMonitor(): void {}
