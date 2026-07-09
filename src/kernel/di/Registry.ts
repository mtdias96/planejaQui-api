import { Constructor } from '@shared/types/Constructor.js';

export interface IInjectableClass<T = unknown> extends Constructor<T> {
  inject?: IInjectableClass<unknown>[];
}

export class Registry {
  private static instance: Registry | undefined;

  static getInstance(): Registry {
    if (!this.instance) {
      this.instance = new Registry();
    }
    return this.instance;
  }

  private constructor() {}

  private readonly providers = new Map<string, { impl: IInjectableClass; deps: IInjectableClass<unknown>[] }>();
  private readonly instances = new Map<string, unknown>();

  register(impl: IInjectableClass): void {
    const token = impl.name;

    if (this.providers.has(token)) {
      return;
    }

    const deps = impl.inject ?? [];
    this.providers.set(token, { impl, deps });
  }

  resolve<T>(impl: IInjectableClass<T>): T {
    const token = impl.name;

    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    const provider = this.providers.get(token);
    if (!provider) {
      this.register(impl);
    }

    const currentProvider = this.providers.get(token);
    if (!currentProvider) {
      throw new Error(`Could not resolve provider for "${token}"`);
    }

    const resolvedDeps = currentProvider.deps.map(dep => this.resolve(dep));
    const instance = new currentProvider.impl(...resolvedDeps) as T;

    this.instances.set(token, instance);

    return instance;
  }
}
