import { serviceRegistry } from './serviceRegistry';
import { eventRegistryService, IEventRegistry } from '../event-registry/eventRegistryService';
import { sqliteRuntimeService } from '../storage/sqliteRuntimeService';

export type BootstrapState =
  | 'INIT'
  | 'CONFIGURATION_READY'
  | 'SERVICES_READY'
  | 'OPERATIONAL'
  | 'FAILED'
  | 'STOPPING'
  | 'STOPPED';

export interface BootstrapError {
  lifecycleState: BootstrapState;
  failingService: string | null;
  reason: string;
  timestamp: string;
}

export interface IPranaRuntime {
  configuration: IConfigurationService;
  events: IEventRegistry;
  services: typeof serviceRegistry;
  state: 'OPERATIONAL';
}

export interface IConfigurationService {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  isReady(): boolean;
}

export interface PranaConfig {
  dbPath: string;
  serviceTimeoutMs?: number;
  [key: string]: unknown;
}

class ConfigurationService implements IConfigurationService {
  private config: Map<string, unknown>;
  private readOnly = false;

  constructor(config: Record<string, unknown>) {
    this.config = new Map(Object.entries(config));
  }

  get(key: string): unknown {
    return this.config.get(key);
  }

  set(key: string, value: unknown): void {
    if (this.readOnly) {
      throw new Error(
        'ConfigurationMutationError: Configuration is read-only after OPERATIONAL state. Use the runtime configuration API to request changes.'
      );
    }
    this.config.set(key, value);
  }

  makeReadOnly(): void {
    this.readOnly = true;
  }

  isReady(): boolean {
    return true;
  }
}

class PranaBootstrapService {
  private lifecycleState: BootstrapState = 'INIT';
  private runtime: IPranaRuntime | null = null;
  private serviceTimeoutMs = 10_000;

  async initialize(config: PranaConfig): Promise<IPranaRuntime> {
    if (this.runtime) return this.runtime;

    try {
      this.lifecycleState = 'INIT';

      // Phase 1: Configuration
      this.lifecycleState = 'CONFIGURATION_READY';
      if (!config.dbPath) {
        this.recordFailure(null, 'config_validation_failed');
        throw this.buildError(null, 'config_validation_failed');
      }
      if (config.serviceTimeoutMs) {
        this.serviceTimeoutMs = config.serviceTimeoutMs;
      }

      const configService = new ConfigurationService(config);

      // Phase 2: Services (sequential, ordered)
      this.lifecycleState = 'SERVICES_READY';

      // 1. Configuration
      await this.registerRequired('configuration', configService);

      // 2. Event Registry
      await this.registerRequired('events', async () => {
        eventRegistryService.initialize();
        return eventRegistryService;
      });

      // 3. Storage
      await this.registerRequired('storage', async () => {
        await sqliteRuntimeService.initialize(config.dbPath as string);
        return sqliteRuntimeService;
      });

      // 4-13. Domain services registered as stubs for now — real implementations injected externally
      // storageScheduler, vaultAdapter, documentAdapter, sheetAdapter, syncEngine,
      // identity, appRegistry, googleBridge, documents (optional), sheets (optional)
      // These are registered by the application that calls prana.initialize()
      // via the service registry before calling this method.

      // Install read-only proxy on config at OPERATIONAL transition
      configService.makeReadOnly();

      // Phase 3: Operational
      this.lifecycleState = 'OPERATIONAL';
      serviceRegistry.setOperational();

      const events = serviceRegistry.resolve<IEventRegistry>('events');
      events.emit({ eventType: 'runtime:startup', source: 'bootstrap' });

      this.runtime = {
        configuration: configService,
        events,
        services: serviceRegistry,
        state: 'OPERATIONAL'
      };

      return this.runtime;
    } catch (err) {
      if (this.lifecycleState !== 'FAILED') {
        this.lifecycleState = 'FAILED';
      }
      if (err instanceof Error && 'lifecycleState' in err) throw err;
      throw err;
    }
  }

  private async registerRequired<T>(key: string, factory: T | (() => Promise<T>)): Promise<void> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Service '${key}' initialization timed out`)),
        this.serviceTimeoutMs
      )
    );

    try {
      const service =
        typeof factory === 'function'
          ? await Promise.race([(factory as () => Promise<T>)(), timeout])
          : factory;
      serviceRegistry.register(key, service);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.lifecycleState = 'FAILED';
      this.recordFailure(key, reason);
      throw this.buildError(key, reason);
    }
  }

  private recordFailure(failingService: string | null, reason: string): void {
    try {
      if (sqliteRuntimeService.isReady()) {
        const db = sqliteRuntimeService.getDb();
        db.prepare(
          `INSERT OR REPLACE INTO prana_startup_log (lifecycle_state, failing_service, reason, timestamp)
           VALUES (?, ?, ?, ?)`
        ).run(this.lifecycleState, failingService, reason, new Date().toISOString());
      }
    } catch {
      // best-effort — storage may not be available
    }
  }

  private buildError(failingService: string | null, reason: string): Error {
    const err = new Error(
      `BootstrapError: ${reason}${failingService ? ` (service: ${failingService})` : ''}`
    ) as Error & BootstrapError;
    (err as unknown as BootstrapError).lifecycleState = this.lifecycleState;
    (err as unknown as BootstrapError).failingService = failingService;
    (err as unknown as BootstrapError).reason = reason;
    (err as unknown as BootstrapError).timestamp = new Date().toISOString();
    return err;
  }

  async shutdown(): Promise<void> {
    if (!this.runtime) return;

    this.lifecycleState = 'STOPPING';
    serviceRegistry.setClosing();

    try {
      const events = serviceRegistry.resolveOptional<IEventRegistry>('events');
      if (events) {
        events.emit({ eventType: 'runtime:shutdown', source: 'bootstrap' });
      }
    } catch { /* ignore emit errors during shutdown */ }

    // Tear down in reverse order, Event Registry last
    const keys = serviceRegistry.getRegisteredKeys();
    const reversedKeys = [...keys].reverse();
    const eventRegistryKey = 'events';

    for (const key of reversedKeys) {
      if (key === eventRegistryKey) continue;
      try {
        const service = serviceRegistry.resolveOptional<{ teardown?: () => void }>(key);
        if (service && typeof service.teardown === 'function') {
          service.teardown();
        }
        (serviceRegistry as unknown as { deregister: (k: string) => void }).deregister(key);
      } catch { /* continue teardown */ }
    }

    // Event Registry last
    try {
      eventRegistryService.teardown();
      (serviceRegistry as unknown as { deregister: (k: string) => void }).deregister(eventRegistryKey);
    } catch { /* ignore */ }

    sqliteRuntimeService.close();
    this.lifecycleState = 'STOPPED';
    this.runtime = null;
  }

  getState(): BootstrapState {
    return this.lifecycleState;
  }
}

export const prana = new PranaBootstrapService();
