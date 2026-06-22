import { EventEmitter } from 'events';
import { logger } from '@/shared/logger/WinstonLogger';

export interface DomainEvent {
  name: string;
  aggregateId: string;
  aggregateType: string;
  data: Record<string, unknown>;
  metadata: {
    eventId: string;
    occurredAt: Date;
    correlationId?: string;
    causationId?: string;
  };
}

type EventHandler = (event: DomainEvent) => Promise<void>;

export class EventBus {
  private static instance: EventBus;
  private emitter: EventEmitter;
  private handlers: Map<string, Set<EventHandler>>;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    this.handlers = new Map();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Register an event handler
   */
  subscribe(eventName: string, handler: EventHandler): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler);

    this.emitter.on(eventName, async (event: DomainEvent) => {
      try {
        await handler(event);
      } catch (error) {
        logger.error(`Event handler failed for ${eventName}`, { error });
      }
    });

    logger.debug(`Handler registered for event: ${eventName}`);
  }

  /**
   * Remove an event handler
   */
  unsubscribe(eventName: string, handler: EventHandler): void {
    this.handlers.get(eventName)?.delete(handler);
    this.emitter.off(eventName, handler);
  }

  /**
   * Publish a domain event
   */
  async publish(event: DomainEvent): Promise<void> {
    logger.debug(`Publishing event: ${event.name}`, {
      aggregateId: event.aggregateId,
      eventId: event.metadata.eventId,
    });

    this.emitter.emit(event.name, event);
  }

  /**
   * Get all registered handlers for an event
   */
  getHandlers(eventName: string): EventHandler[] {
    return Array.from(this.handlers.get(eventName) || []);
  }

  /**
   * Check if event has any handlers
   */
  hasHandlers(eventName: string): boolean {
    return (this.handlers.get(eventName)?.size || 0) > 0;
  }
}

export const eventBus = EventBus.getInstance();
