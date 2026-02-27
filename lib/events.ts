'use client';

/**
 * Event-driven architecture for real-time updates
 * Replaces polling with event-based state synchronization
 */

type EventType = 'subject:updated' | 'subject:added' | 'subject:deleted' | 'absence:added' | 'config:updated';
type EventListener = (data: any) => void;

class EventEmitter {
  private listeners: Map<EventType, Set<EventListener>> = new Map();

  on(event: EventType, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit(event: EventType, data: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  off(event: EventType, listener: EventListener) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(listener);
    }
  }

  offAll(event: EventType) {
    this.listeners.delete(event);
  }
}

export const eventEmitter = new EventEmitter();

// Hook for subscribing to events in components
export function useEventListener(event: EventType, callback: (data: any) => void) {
  const unsubscribe = eventEmitter.on(event, callback);
  return unsubscribe;
}
