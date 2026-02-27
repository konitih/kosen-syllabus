'use client';

type EventType =
  | 'subject:updated'
  | 'subject:added'
  | 'subject:deleted'
  | 'absence:added'
  | 'config:updated'
  | 'pool:updated'; // ← 科目プール変更通知

type EventListener = (data: any) => void;

class EventEmitter {
  private listeners: Map<EventType, Set<EventListener>> = new Map();

  on(event: EventType, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit(event: EventType, data: any) {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  off(event: EventType, listener: EventListener) {
    this.listeners.get(event)?.delete(listener);
  }
}

export const eventEmitter = new EventEmitter();

export function useEventListener(event: EventType, callback: (data: any) => void) {
  return eventEmitter.on(event, callback);
}
