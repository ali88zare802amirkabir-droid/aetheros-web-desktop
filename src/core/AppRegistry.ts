import type { AppDefinition } from './types';
import { EventBus } from './EventBus';

class Registry {
  private apps = new Map<string, AppDefinition>();

  register(app: AppDefinition): void {
    if (!app.id || !app.name || typeof app.render !== 'function') {
      throw new Error('Invalid app definition');
    }
    this.apps.set(app.id, app);
    EventBus.emit('appsChanged', this.list());
  }

  get(id: string): AppDefinition | undefined {
    return this.apps.get(id);
  }

  list(): AppDefinition[] {
    return Array.from(this.apps.values());
  }
}

export const AppRegistry = new Registry();
