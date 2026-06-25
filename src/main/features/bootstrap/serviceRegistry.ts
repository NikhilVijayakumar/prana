export class ServiceRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceRegistrationError';
  }
}

export class ServiceResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceResolutionError';
  }
}

export interface IServiceRegistry {
  register<T>(key: string, service: T): void;
  resolve<T>(key: string): T;
  resolveOptional<T>(key: string): T | null;
  isRegistered(key: string): boolean;
  getRegisteredKeys(): string[];
  deregister(key: string): void;
}

type RegistryState = 'OPEN' | 'OPERATIONAL' | 'CLOSING';

class ServiceRegistry implements IServiceRegistry {
  private services = new Map<string, unknown>();
  private state: RegistryState = 'OPEN';

  setOperational(): void {
    this.state = 'OPERATIONAL';
  }

  setClosing(): void {
    this.state = 'CLOSING';
  }

  register<T>(key: string, service: T): void {
    if (this.state === 'OPERATIONAL') {
      throw new ServiceRegistrationError(
        `Cannot register service '${key}' — registry is OPERATIONAL and no longer accepts registrations`
      );
    }
    this.services.set(key, service);
  }

  resolve<T>(key: string): T {
    const service = this.services.get(key);
    if (service === undefined) {
      throw new ServiceResolutionError(
        `Service '${key}' is not registered. Use resolveOptional() for optional services.`
      );
    }
    return service as T;
  }

  resolveOptional<T>(key: string): T | null {
    const service = this.services.get(key);
    return service !== undefined ? (service as T) : null;
  }

  isRegistered(key: string): boolean {
    return this.services.has(key);
  }

  getRegisteredKeys(): string[] {
    return Array.from(this.services.keys());
  }

  deregister(key: string): void {
    this.services.delete(key);
  }
}

export const serviceRegistry = new ServiceRegistry();
