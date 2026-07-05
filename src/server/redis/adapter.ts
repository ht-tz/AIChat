// Redis 适配层 —— 支持 Redis 和内存降级
// 生产环境配置 REDIS_URL 启用 Redis，开发环境自动降级为内存

export interface CacheAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  incr(key: string): Promise<number>;
  del(key: string): Promise<void>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
}

// 内存实现（开发/降级用）
class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
    });
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (parseInt(current || "0", 10) || 0) + 1;
    await this.set(key, String(next));
    return next;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt === 0) return -1;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
}

// Redis 实现
class RedisCacheAdapter implements CacheAdapter {
  private redis: any;

  constructor(redisUrl: string) {
    // 动态导入 ioredis（可选依赖）
    this.redis = null;
    this.connect(redisUrl);
  }

  private async connect(url: string): Promise<void> {
    try {
      const mod = await import(/* webpackIgnore: true */ "ioredis" as string);
      const Redis = mod.default ?? mod;
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
      });
    } catch {
      console.warn("[redis] ioredis not installed, falling back to memory cache");
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.redis) return null;
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.redis) return;
    if (ttlSeconds) {
      await this.redis.set(key, value, "EX", ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.redis) return 0;
    return this.redis.incr(key);
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    await this.redis.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    if (!this.redis) return -1;
    return this.redis.ttl(key);
  }
}

// 单例
let adapter: CacheAdapter | null = null;

export function getCache(): CacheAdapter {
  if (adapter) return adapter;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    adapter = new RedisCacheAdapter(redisUrl);
  } else {
    adapter = new MemoryCacheAdapter();
  }
  return adapter;
}
