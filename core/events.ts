/**
 * Event Bus
 * Centralized pub/sub for cross-module communication
 */

type EventCallback<T = unknown> = (data: T) => void | Promise<void>;

interface EventSubscription {
  unsubscribe: () => void;
}

class EventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  /**
   * Subscribe to an event
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    return {
      unsubscribe: () => {
        this.listeners.get(event)?.delete(callback as EventCallback);
      }
    };
  }

  /**
   * Subscribe to an event once
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): EventSubscription {
    const wrapper: EventCallback<T> = (data) => {
      this.listeners.get(event)?.delete(wrapper as EventCallback);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emit an event
   */
  emit<T = unknown>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (err) {
        console.error(`Event handler error for ${event}:`, err);
      }
    }
  }

  /**
   * Emit an event and wait for all handlers
   */
  async emitAsync<T = unknown>(event: string, data?: T): Promise<void> {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    const promises: Promise<void>[] = [];
    for (const callback of callbacks) {
      try {
        const result = callback(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (err) {
        console.error(`Event handler error for ${event}:`, err);
      }
    }

    await Promise.all(promises);
  }

  /**
   * Remove all listeners for an event
   */
  off(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Common event types
export const Events = {
  // Store events
  STORE_UPDATED: 'store:updated',
  STORE_LOADED: 'store:loaded',

  // Task events
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_COMPLETED: 'task:completed',
  TASK_DELETED: 'task:deleted',

  // Entity events
  ENTITY_CREATED: 'entity:created',
  ENTITY_UPDATED: 'entity:updated',
  ENTITY_DELETED: 'entity:deleted',

  // Correction events
  CORRECTION_LOGGED: 'correction:logged',
  PATTERN_DETECTED: 'pattern:detected',

  // System events
  ERROR: 'error',
  WARNING: 'warning',
} as const;

// Event payload types
export interface StoreUpdatedEvent {
  module: string;
  action: 'create' | 'update' | 'delete';
  id?: string;
}

export interface TaskEvent {
  id: string;
  title: string;
  status?: string;
}

export interface EntityEvent {
  id: string;
  type: string;
  name: string;
}

export interface CorrectionEvent {
  id: string;
  type: string;
  original: string;
  corrected: string;
}
