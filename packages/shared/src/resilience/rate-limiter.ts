/**
 * Rate Limiter — Redis-backed
 * Prevents API overload with per-service limits
 * State persisted in Redis for restart safety
 */

import { createLogger } from '../logger.js';

const logger = createLogger('rate-limiter');

// Lazy-loaded Redis connection
let redisClient: any = null;

async function getRedis() {
  if (!redisClient) {
    try {
      // Direct ioredis import to avoid circular dependency with @elio/workflow
      const Redis = await import('ioredis').then(m => m.default);
      const host = process.env.REDIS_HOST || 'localhost';
      const port = parseInt(process.env.REDIS_PORT || '6379', 10);
      const db = parseInt(process.env.REDIS_STATE_DB || '2', 10);
      redisClient = new Redis({
        host,
        port,
        db,
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 50, 2000);
        }
      });
    } catch (err) {
      logger.warn('Redis not available, falling back to in-memory rate limiting');
      return null;
    }
  }
  return redisClient;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  strategy: 'queue' | 'fail' | 'delay';
}

// Default limits for known services
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  perplexity: { requestsPerMinute: 20, requestsPerDay: 1000, strategy: 'queue' },
  notion: { requestsPerMinute: 3, requestsPerDay: 2000, strategy: 'queue' },
  gmail: { requestsPerMinute: 60, requestsPerDay: 10000, strategy: 'delay' },
  calendar: { requestsPerMinute: 60, requestsPerDay: 10000, strategy: 'delay' },
  telegram: { requestsPerMinute: 30, strategy: 'delay' },
  linkedin: { requestsPerMinute: 10, requestsPerDay: 100, strategy: 'fail' },
  slack: { requestsPerMinute: 50, strategy: 'delay' },
  openai: { requestsPerMinute: 60, strategy: 'queue' },
  anthropic: { requestsPerMinute: 60, strategy: 'queue' },
  groq: { requestsPerMinute: 30, strategy: 'queue' }
};

// Fallback in-memory state when Redis unavailable
interface ServiceState {
  minuteRequests: number;
  dayRequests: number;
  minuteResetAt: number;
  dayResetAt: number;
}

const fallbackStates = new Map<string, ServiceState>();

async function checkLimit(service: string, config: RateLimitConfig): Promise<{
  allowed: boolean;
  minuteCount: number;
  dayCount: number;
  waitTime?: number;
}> {
  const redis = await getRedis();

  if (!redis) {
    // Fallback to in-memory
    return checkLimitInMemory(service, config);
  }

  const minuteKey = `ratelimit:${service}:minute`;
  const dayKey = `ratelimit:${service}:day`;
  const now = Date.now();

  // Atomic increment with TTL
  const pipeline = redis.pipeline();
  pipeline.incr(minuteKey);
  pipeline.ttl(minuteKey);
  pipeline.incr(dayKey);
  pipeline.ttl(dayKey);
  const results = await pipeline.exec();

  const minuteCount = results[0][1] as number;
  const minuteTTL = results[1][1] as number;
  const dayCount = results[2][1] as number;
  const dayTTL = results[3][1] as number;

  // Set TTL on first request
  if (minuteTTL === -1) await redis.expire(minuteKey, 60);
  if (dayTTL === -1) await redis.expire(dayKey, 86400);

  // Check limits
  const minuteExceeded = minuteCount > config.requestsPerMinute;
  const dayExceeded = config.requestsPerDay && dayCount > config.requestsPerDay;

  if (dayExceeded) {
    const waitTime = dayTTL > 0 ? dayTTL * 1000 : 0;
    return { allowed: false, minuteCount, dayCount, waitTime };
  }

  if (minuteExceeded) {
    const waitTime = minuteTTL > 0 ? minuteTTL * 1000 : 0;
    return { allowed: false, minuteCount, dayCount, waitTime };
  }

  return { allowed: true, minuteCount, dayCount };
}

function checkLimitInMemory(service: string, config: RateLimitConfig): {
  allowed: boolean;
  minuteCount: number;
  dayCount: number;
  waitTime?: number;
} {
  let state = fallbackStates.get(service);
  const now = Date.now();

  if (!state) {
    state = {
      minuteRequests: 0,
      dayRequests: 0,
      minuteResetAt: now + 60000,
      dayResetAt: now + 86400000,
    };
    fallbackStates.set(service, state);
  }

  // Reset counters if expired
  if (now >= state.minuteResetAt) {
    state.minuteRequests = 0;
    state.minuteResetAt = now + 60000;
  }
  if (now >= state.dayResetAt) {
    state.dayRequests = 0;
    state.dayResetAt = now + 86400000;
  }

  state.minuteRequests++;
  state.dayRequests++;

  const minuteExceeded = state.minuteRequests > config.requestsPerMinute;
  const dayExceeded = config.requestsPerDay && state.dayRequests > config.requestsPerDay;

  if (dayExceeded) {
    return {
      allowed: false,
      minuteCount: state.minuteRequests,
      dayCount: state.dayRequests,
      waitTime: state.dayResetAt - now
    };
  }

  if (minuteExceeded) {
    return {
      allowed: false,
      minuteCount: state.minuteRequests,
      dayCount: state.dayRequests,
      waitTime: state.minuteResetAt - now
    };
  }

  return {
    allowed: true,
    minuteCount: state.minuteRequests,
    dayCount: state.dayRequests
  };
}

export async function acquire(service: string): Promise<void> {
  const config = DEFAULT_LIMITS[service] || { requestsPerMinute: 100, strategy: 'delay' };
  const result = await checkLimit(service, config);

  if (!result.allowed) {
    const isDaily = config.requestsPerDay && result.dayCount > config.requestsPerDay;
    const limitType = isDaily ? 'daily' : 'minute';
    const error = `${limitType} rate limit exceeded for ${service}`;

    logger.warn(error, {
      service,
      minuteCount: result.minuteCount,
      dayCount: result.dayCount,
      strategy: config.strategy
    });

    switch (config.strategy) {
      case 'fail':
        throw new Error(error);

      case 'delay': {
        const waitTime = result.waitTime || 1000;
        logger.info(`Delaying ${service} request`, { waitTime });
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000)));
        return acquire(service);
      }

      case 'queue': {
        // For queue strategy, wait and retry
        const waitTime = result.waitTime || 1000;
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000)));
        return acquire(service);
      }
    }
  }
}

export function release(_service: string): void {
  // No-op for now
}

export async function getStatus(service: string): Promise<{
  minuteRequests: number;
  minuteLimit: number;
  dayRequests: number;
  dayLimit: number | undefined;
  minuteResetIn: number;
}> {
  const config = DEFAULT_LIMITS[service] || { requestsPerMinute: 100, strategy: 'delay' };
  const redis = await getRedis();

  if (!redis) {
    // Fallback
    const state = fallbackStates.get(service);
    if (!state) {
      return {
        minuteRequests: 0,
        minuteLimit: config.requestsPerMinute,
        dayRequests: 0,
        dayLimit: config.requestsPerDay,
        minuteResetIn: 0
      };
    }

    return {
      minuteRequests: state.minuteRequests,
      minuteLimit: config.requestsPerMinute,
      dayRequests: state.dayRequests,
      dayLimit: config.requestsPerDay,
      minuteResetIn: Math.max(0, state.minuteResetAt - Date.now())
    };
  }

  const minuteKey = `ratelimit:${service}:minute`;
  const dayKey = `ratelimit:${service}:day`;

  const [minuteCount, minuteTTL, dayCount] = await Promise.all([
    redis.get(minuteKey).then((v: string | null) => parseInt(v || '0', 10)),
    redis.ttl(minuteKey),
    redis.get(dayKey).then((v: string | null) => parseInt(v || '0', 10))
  ]);

  return {
    minuteRequests: minuteCount,
    minuteLimit: config.requestsPerMinute,
    dayRequests: dayCount,
    dayLimit: config.requestsPerDay,
    minuteResetIn: Math.max(0, minuteTTL * 1000)
  };
}

export async function getAllStatus(): Promise<Record<string, Awaited<ReturnType<typeof getStatus>>>> {
  const result: Record<string, Awaited<ReturnType<typeof getStatus>>> = {};
  for (const service of Object.keys(DEFAULT_LIMITS)) {
    result[service] = await getStatus(service);
  }
  return result;
}

export function withRateLimit<T>(
  service: string,
  fn: () => Promise<T>
): Promise<T> {
  return acquire(service).then(() => fn());
}

export function configure(service: string, config: RateLimitConfig): void {
  DEFAULT_LIMITS[service] = config;
  logger.info(`Configured ${service}`, config);
}

export async function resetLimits(): Promise<void> {
  fallbackStates.clear();

  const redis = await getRedis();
  if (redis) {
    // Clear all ratelimit:* keys from Redis
    const keys = await redis.keys('ratelimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Cleared ${keys.length} rate limit keys from Redis`);
    }
  }
}
