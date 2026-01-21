/**
 * Rate Limiter
 * Prevents API overload with per-service limits
 */

import { fileLogger } from './file-logger.js';

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  strategy: 'queue' | 'fail' | 'delay';
}

interface ServiceState {
  minuteRequests: number;
  dayRequests: number;
  minuteResetAt: number;
  dayResetAt: number;
  queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }>;
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
  anthropic: { requestsPerMinute: 60, strategy: 'queue' }
};

// Service states
const states = new Map<string, ServiceState>();

// Get or create state for service
function getState(service: string): ServiceState {
  let state = states.get(service);
  if (!state) {
    const now = Date.now();
    state = {
      minuteRequests: 0,
      dayRequests: 0,
      minuteResetAt: now + 60000,
      dayResetAt: now + 86400000,
      queue: []
    };
    states.set(service, state);
  }

  // Reset counters if time passed
  const now = Date.now();
  if (now >= state.minuteResetAt) {
    state.minuteRequests = 0;
    state.minuteResetAt = now + 60000;
    processQueue(service);
  }
  if (now >= state.dayResetAt) {
    state.dayRequests = 0;
    state.dayResetAt = now + 86400000;
  }

  return state;
}

// Process queued requests
function processQueue(service: string): void {
  const state = states.get(service);
  const config = DEFAULT_LIMITS[service];
  if (!state || !config) return;

  while (state.queue.length > 0 && state.minuteRequests < config.requestsPerMinute) {
    const item = state.queue.shift();
    if (item) {
      state.minuteRequests++;
      state.dayRequests++;
      item.resolve();
    }
  }
}

/**
 * Acquire permission to make a request
 * Returns immediately if under limit, queues/delays/fails based on strategy
 */
export async function acquire(service: string): Promise<void> {
  const config = DEFAULT_LIMITS[service] || { requestsPerMinute: 100, strategy: 'delay' };
  const state = getState(service);

  // Check daily limit
  if (config.requestsPerDay && state.dayRequests >= config.requestsPerDay) {
    const error = `Daily rate limit exceeded for ${service}`;
    fileLogger.warn('rate-limiter', error, { service, dayRequests: state.dayRequests });

    if (config.strategy === 'fail') {
      throw new Error(error);
    }

    // Queue until tomorrow (not practical, but handles the case)
    const waitTime = state.dayResetAt - Date.now();
    await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000)));
    return acquire(service); // Retry
  }

  // Check minute limit
  if (state.minuteRequests >= config.requestsPerMinute) {
    fileLogger.debug('rate-limiter', `Rate limit reached for ${service}`, {
      minuteRequests: state.minuteRequests,
      strategy: config.strategy
    });

    switch (config.strategy) {
      case 'fail':
        throw new Error(`Rate limit exceeded for ${service}`);

      case 'delay': {
        const waitTime = state.minuteResetAt - Date.now();
        if (waitTime > 0) {
          fileLogger.info('rate-limiter', `Delaying ${service} request`, { waitTime });
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        return acquire(service); // Retry after delay
      }

      case 'queue':
        return new Promise((resolve, reject) => {
          state.queue.push({ resolve, reject });
          fileLogger.debug('rate-limiter', `Queued ${service} request`, {
            queueLength: state.queue.length
          });
        });
    }
  }

  // Under limit, proceed
  state.minuteRequests++;
  state.dayRequests++;
}

/**
 * Release (currently no-op, but available for future semaphore-style limiting)
 */
export function release(_service: string): void {
  // No-op for now
}

/**
 * Get current status for a service
 */
export function getStatus(service: string): {
  minuteRequests: number;
  minuteLimit: number;
  dayRequests: number;
  dayLimit: number | undefined;
  queueLength: number;
  minuteResetIn: number;
} {
  const config = DEFAULT_LIMITS[service] || { requestsPerMinute: 100, strategy: 'delay' };
  const state = getState(service);

  return {
    minuteRequests: state.minuteRequests,
    minuteLimit: config.requestsPerMinute,
    dayRequests: state.dayRequests,
    dayLimit: config.requestsPerDay,
    queueLength: state.queue.length,
    minuteResetIn: Math.max(0, state.minuteResetAt - Date.now())
  };
}

/**
 * Get status for all services
 */
export function getAllStatus(): Record<string, ReturnType<typeof getStatus>> {
  const result: Record<string, ReturnType<typeof getStatus>> = {};

  for (const service of Object.keys(DEFAULT_LIMITS)) {
    result[service] = getStatus(service);
  }

  return result;
}

/**
 * Wrap an async function with rate limiting
 */
export function withRateLimit<T>(
  service: string,
  fn: () => Promise<T>
): Promise<T> {
  return acquire(service).then(() => fn());
}

/**
 * Configure custom limits for a service
 */
export function configure(service: string, config: RateLimitConfig): void {
  DEFAULT_LIMITS[service] = config;
  fileLogger.info('rate-limiter', `Configured ${service}`, config);
}
