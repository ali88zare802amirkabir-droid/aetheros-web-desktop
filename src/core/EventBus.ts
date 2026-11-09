import type { OSEvents } from './types';

type Handler<K extends keyof OSEvents> = (data: OSEvents[K]) => void;

class Bus {
  private listeners = new Map<string, Function[]>();

  on<K extends keyof OSEvents>(event: K, cb: Handler<K>): void {
    const list = this.listeners.get(event as string) ?? [];
    list.push(cb as Function);
    this.listeners.set(event as string, list);
  }

  off<K extends keyof OSEvents>(event: K, cb: Handler<K>): void {
    const list = this.listeners.get(event as string);
    if (!list) return;
    const i = list.indexOf(cb as Function);
    if (i >= 0) list.splice(i, 1);
  }

  emit<K extends keyof OSEvents>(event: K, data: OSEvents[K]): void {
    const list = this.listeners.get(event as string);
    if (!list) return;
    for (const cb of list) {
      try {
        cb(data);
      } catch (e) {
        console.error(`EventBus error on ${String(event)}:`, e);
      }
    }
  }
}

export const EventBus = new Bus();
