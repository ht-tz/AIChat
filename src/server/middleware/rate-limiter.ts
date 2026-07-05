// API 限流中间件

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitState {
  count: number;
  resetTime: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60000,
};

const limits: Map<string, RateLimitState> = new Map();

function getKey(ip: string, path: string): string {
  return `${ip}:${path}`;
}

export function checkRateLimit(
  ip: string,
  path: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): { allowed: boolean; remaining: number; resetTime: number } {
  const key = getKey(ip, path);
  const now = Date.now();

  let state = limits.get(key);

  if (!state || now > state.resetTime) {
    state = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    limits.set(key, state);
  }

  const allowed = state.count < config.maxRequests;
  if (allowed) {
    state.count++;
  }

  return {
    allowed,
    remaining: config.maxRequests - state.count,
    resetTime: state.resetTime,
  };
}

export function applyRateLimit(
  ip: string,
  path: string,
  config?: RateLimitConfig,
): { allowed: boolean; headers: Record<string, string> } {
  const result = checkRateLimit(ip, path, config);

  return {
    allowed: result.allowed,
    headers: {
      "X-RateLimit-Limit": String(config?.maxRequests || DEFAULT_CONFIG.maxRequests),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
    },
  };
}
