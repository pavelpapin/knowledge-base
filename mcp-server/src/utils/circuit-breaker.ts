/**
 * Circuit Breaker
 * Prevents cascade failures by temporarily stopping requests to failing services
 */

import { fileLogger } from './file-logger.js';
import { notifyTelegram } from './progress.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitConfig {
  failureThreshold: number;    // Failures before opening
  resetTimeout: number;        // ms to wait before half-open
  halfOpenRequests: number;    // Requests to allow in half-open
}

interface ServiceCircuit {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number;
  nextRetry: number;
  halfOpenAllowed: number;
}

// Default configs
const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 3,
  resetTimeout: 30000,    // 30 seconds
  halfOpenRequests: 1
};

const SERVICE_CONFIGS: Record<string, Partial<CircuitConfig>> = {
  perplexity: { failureThreshold: 5, resetTimeout: 60000 },
  notion: { failureThreshold: 3, resetTimeout: 30000 },
  gmail: { failureThreshold: 5, resetTimeout: 30000 },
  linkedin: { failureThreshold: 2, resetTimeout: 120000 },
  openai: { failureThreshold: 5, resetTimeout: 60000 }
};

// Circuit states
const circuits = new Map<string, ServiceCircuit>();

// Get or create circuit for service
function getCircuit(service: string): ServiceCircuit {
  let circuit = circuits.get(service);
  if (!circuit) {
    circuit = {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailure: 0,
      nextRetry: 0,
      halfOpenAllowed: 0
    };
    circuits.set(service, circuit);
  }
  return circuit;
}

// Get config for service
function getConfig(service: string): CircuitConfig {
  return { ...DEFAULT_CONFIG, ...SERVICE_CONFIGS[service] };
}

/**
 * Check if circuit allows requests
 */
export function isOpen(service: string): boolean {
  const circuit = getCircuit(service);
  const config = getConfig(service);
  const now = Date.now();

  if (circuit.state === 'closed') {
    return false; // Allow
  }

  if (circuit.state === 'open') {
    // Check if we should transition to half-open
    if (now >= circuit.nextRetry) {
      circuit.state = 'half-open';
      circuit.halfOpenAllowed = config.halfOpenRequests;
      fileLogger.info('circuit-breaker', `${service} transitioning to half-open`);
      return false; // Allow test request
    }
    return true; // Still blocked
  }

  if (circuit.state === 'half-open') {
    if (circuit.halfOpenAllowed > 0) {
      circuit.halfOpenAllowed--;
      return false; // Allow test request
    }
    return true; // Block until we get success/failure result
  }

  return false;
}

/**
 * Record a successful request
 */
export function recordSuccess(service: string): void {
  const circuit = getCircuit(service);

  if (circuit.state === 'half-open') {
    // Success in half-open -> close circuit
    circuit.state = 'closed';
    circuit.failures = 0;
    circuit.successes = 0;
    fileLogger.info('circuit-breaker', `${service} circuit closed (recovered)`);
    notifyTelegram(`✅ ${service} recovered`);
  }

  circuit.successes++;
}

/**
 * Record a failed request
 */
export function recordFailure(service: string, error?: string): void {
  const circuit = getCircuit(service);
  const config = getConfig(service);
  const now = Date.now();

  circuit.failures++;
  circuit.lastFailure = now;

  fileLogger.warn('circuit-breaker', `${service} failure recorded`, {
    failures: circuit.failures,
    threshold: config.failureThreshold,
    error
  });

  if (circuit.state === 'half-open') {
    // Failure in half-open -> reopen circuit
    circuit.state = 'open';
    circuit.nextRetry = now + config.resetTimeout;
    fileLogger.error('circuit-breaker', `${service} circuit reopened`);
    notifyTelegram(`⚠️ ${service} still failing, circuit reopened`);
    return;
  }

  if (circuit.state === 'closed' && circuit.failures >= config.failureThreshold) {
    // Too many failures -> open circuit
    circuit.state = 'open';
    circuit.nextRetry = now + config.resetTimeout;
    fileLogger.error('circuit-breaker', `${service} circuit opened`, {
      failures: circuit.failures,
      retryIn: config.resetTimeout
    });
    notifyTelegram(`🔴 ${service} circuit OPEN (${circuit.failures} failures). Retry in ${config.resetTimeout / 1000}s`);
  }
}

/**
 * Get circuit status
 */
export function getStatus(service: string): {
  state: CircuitState;
  failures: number;
  nextRetryIn: number | null;
} {
  const circuit = getCircuit(service);
  const now = Date.now();

  return {
    state: circuit.state,
    failures: circuit.failures,
    nextRetryIn: circuit.state === 'open' ? Math.max(0, circuit.nextRetry - now) : null
  };
}

/**
 * Get all circuit statuses
 */
export function getAllStatus(): Record<string, ReturnType<typeof getStatus>> {
  const result: Record<string, ReturnType<typeof getStatus>> = {};

  for (const service of circuits.keys()) {
    result[service] = getStatus(service);
  }

  return result;
}

/**
 * Manually reset a circuit
 */
export function reset(service: string): void {
  const circuit = getCircuit(service);
  circuit.state = 'closed';
  circuit.failures = 0;
  circuit.successes = 0;
  fileLogger.info('circuit-breaker', `${service} circuit manually reset`);
}

/**
 * Wrap a function with circuit breaker
 */
export async function withCircuitBreaker<T>(
  service: string,
  fn: () => Promise<T>
): Promise<T> {
  if (isOpen(service)) {
    const status = getStatus(service);
    throw new Error(`Circuit open for ${service}. Retry in ${status.nextRetryIn}ms`);
  }

  try {
    const result = await fn();
    recordSuccess(service);
    return result;
  } catch (error) {
    recordFailure(service, String(error));
    throw error;
  }
}
