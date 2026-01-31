/**
 * Circuit Breaker — Redis-backed
 * Prevents cascade failures by temporarily stopping requests to failing services
 * State persisted in Redis for restart safety
 */

import { createLogger } from '../logger.js';
import { notify } from '../notify.js';

const logger = createLogger('circuit-breaker');

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
      logger.warn('Redis not available, falling back to in-memory circuit breaker');
      return null;
    }
  }
  return redisClient;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

interface ServiceCircuit {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number;
  nextRetry: number;
  halfOpenAllowed: number;
}

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 3,
  resetTimeout: 30000,
  halfOpenRequests: 1
};

const SERVICE_CONFIGS: Record<string, Partial<CircuitConfig>> = {
  perplexity: { failureThreshold: 5, resetTimeout: 60000 },
  notion: { failureThreshold: 3, resetTimeout: 30000 },
  gmail: { failureThreshold: 5, resetTimeout: 30000 },
  linkedin: { failureThreshold: 2, resetTimeout: 120000 },
  openai: { failureThreshold: 5, resetTimeout: 60000 },
  anthropic: { failureThreshold: 5, resetTimeout: 60000 },
  groq: { failureThreshold: 5, resetTimeout: 60000 }
};

// Fallback in-memory state when Redis unavailable
const fallbackCircuits = new Map<string, ServiceCircuit>();

function getConfig(service: string): CircuitConfig {
  return { ...DEFAULT_CONFIG, ...SERVICE_CONFIGS[service] };
}

async function getCircuit(service: string): Promise<ServiceCircuit> {
  const redis = await getRedis();

  if (!redis) {
    // Fallback to in-memory
    let circuit = fallbackCircuits.get(service);
    if (!circuit) {
      circuit = {
        state: 'closed',
        failures: 0,
        successes: 0,
        lastFailure: 0,
        nextRetry: 0,
        halfOpenAllowed: 0
      };
      fallbackCircuits.set(service, circuit);
    }
    return circuit;
  }

  const key = `circuit:${service}`;
  const data = await redis.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    // Initialize
    const circuit: ServiceCircuit = {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailure: 0,
      nextRetry: 0,
      halfOpenAllowed: 0
    };
    await saveCircuit(service, circuit);
    return circuit;
  }

  return {
    state: data.state as CircuitState,
    failures: parseInt(data.failures || '0', 10),
    successes: parseInt(data.successes || '0', 10),
    lastFailure: parseInt(data.lastFailure || '0', 10),
    nextRetry: parseInt(data.nextRetry || '0', 10),
    halfOpenAllowed: parseInt(data.halfOpenAllowed || '0', 10)
  };
}

async function saveCircuit(service: string, circuit: ServiceCircuit): Promise<void> {
  const redis = await getRedis();

  if (!redis) {
    // Fallback to in-memory
    fallbackCircuits.set(service, circuit);
    return;
  }

  const key = `circuit:${service}`;
  await redis.hset(key, {
    state: circuit.state,
    failures: circuit.failures.toString(),
    successes: circuit.successes.toString(),
    lastFailure: circuit.lastFailure.toString(),
    nextRetry: circuit.nextRetry.toString(),
    halfOpenAllowed: circuit.halfOpenAllowed.toString()
  });

  // Set TTL to prevent stale data (expire after 24 hours if not updated)
  await redis.expire(key, 86400);
}

export async function isOpen(service: string): Promise<boolean> {
  const circuit = await getCircuit(service);
  const config = getConfig(service);
  const now = Date.now();

  if (circuit.state === 'closed') {
    return false;
  }

  if (circuit.state === 'open') {
    if (now >= circuit.nextRetry) {
      circuit.state = 'half-open';
      circuit.halfOpenAllowed = config.halfOpenRequests;
      await saveCircuit(service, circuit);
      logger.info(`${service} transitioning to half-open`);
      return false;
    }
    return true;
  }

  if (circuit.state === 'half-open') {
    if (circuit.halfOpenAllowed > 0) {
      circuit.halfOpenAllowed--;
      await saveCircuit(service, circuit);
      return false;
    }
    return true;
  }

  return false;
}

export async function recordSuccess(service: string): Promise<void> {
  const circuit = await getCircuit(service);

  if (circuit.state === 'half-open') {
    circuit.state = 'closed';
    circuit.failures = 0;
    circuit.successes = 0;
    await saveCircuit(service, circuit);
    logger.info(`${service} circuit closed (recovered)`);
    void notify(`✅ ${service} recovered`);
    return;
  }

  circuit.successes++;
  await saveCircuit(service, circuit);
}

export async function recordFailure(service: string, error?: string): Promise<void> {
  const circuit = await getCircuit(service);
  const config = getConfig(service);
  const now = Date.now();

  circuit.failures++;
  circuit.lastFailure = now;

  logger.warn(`${service} failure recorded`, {
    failures: circuit.failures,
    threshold: config.failureThreshold,
    error
  });

  if (circuit.state === 'half-open') {
    circuit.state = 'open';
    circuit.nextRetry = now + config.resetTimeout;
    await saveCircuit(service, circuit);
    logger.error(`${service} circuit reopened`);
    void notify(`⚠️ ${service} still failing, circuit reopened`);
    return;
  }

  if (circuit.state === 'closed' && circuit.failures >= config.failureThreshold) {
    circuit.state = 'open';
    circuit.nextRetry = now + config.resetTimeout;
    await saveCircuit(service, circuit);
    logger.error(`${service} circuit opened`, {
      failures: circuit.failures,
      retryIn: config.resetTimeout
    });
    void notify(`🔴 ${service} circuit OPEN (${circuit.failures} failures). Retry in ${config.resetTimeout / 1000}s`);
    return;
  }

  await saveCircuit(service, circuit);
}

export async function getStatus(service: string): Promise<{
  state: CircuitState;
  failures: number;
  nextRetryIn: number | null;
}> {
  const circuit = await getCircuit(service);
  const now = Date.now();

  return {
    state: circuit.state,
    failures: circuit.failures,
    nextRetryIn: circuit.state === 'open' ? Math.max(0, circuit.nextRetry - now) : null
  };
}

export async function getAllStatus(): Promise<Record<string, Awaited<ReturnType<typeof getStatus>>>> {
  const redis = await getRedis();
  const result: Record<string, Awaited<ReturnType<typeof getStatus>>> = {};

  if (!redis) {
    // Fallback
    for (const [service] of fallbackCircuits) {
      result[service] = await getStatus(service);
    }
    return result;
  }

  const keys = await redis.keys('circuit:*');
  for (const key of keys) {
    const service = key.replace('circuit:', '');
    result[service] = await getStatus(service);
  }

  return result;
}

export async function reset(service: string): Promise<void> {
  const circuit = await getCircuit(service);
  circuit.state = 'closed';
  circuit.failures = 0;
  circuit.successes = 0;
  await saveCircuit(service, circuit);
  logger.info(`${service} circuit manually reset`);
}

export async function resetAll(): Promise<void> {
  fallbackCircuits.clear();

  const redis = await getRedis();
  if (redis) {
    const keys = await redis.keys('circuit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Cleared ${keys.length} circuit breaker keys from Redis`);
    }
  }
}

export async function withCircuitBreaker<T>(
  service: string,
  fn: () => Promise<T>
): Promise<T> {
  if (await isOpen(service)) {
    const status = await getStatus(service);
    throw new Error(`Circuit open for ${service}. Retry in ${status.nextRetryIn}ms`);
  }

  try {
    const result = await fn();
    await recordSuccess(service);
    return result;
  } catch (error) {
    await recordFailure(service, String(error));
    throw error;
  }
}
