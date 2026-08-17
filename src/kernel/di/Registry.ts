import { Constructor } from '@shared/types/Constructor.js';
import { UnitOfWork } from '@application/contracts/UnitOfWork.js';
import { DrizzleUnitOfWork } from '@infra/database/drizzle/DrizzleUnitOfWork.js';

export type AbstractConstructor<T = unknown> = abstract new (...args: any[]) => T;
export type ConcreteConstructor<T = unknown> = Constructor<T>;

export type IInjectableClass<T = unknown> = (ConcreteConstructor<T> | AbstractConstructor<T>) & {
  inject?: IInjectableClass<unknown>[];
};

export class Registry {
  private static instance: Registry | undefined;

  static getInstance(): Registry {
    if (!this.instance) {
      this.instance = new Registry();
      this.instance.registerDefaultBindings();
    }
    return this.instance;
  }

  private constructor() {}

  private readonly providers = new Map<string, { impl: ConcreteConstructor; deps: IInjectableClass<unknown>[] }>();
  private readonly instances = new Map<string, unknown>();

  private registerDefaultBindings(): void {
    this.bind(UnitOfWork, DrizzleUnitOfWork);
  }

  bind<T>(abstractClass: IInjectableClass<T>, concreteClass: IInjectableClass<T>): void {
    const token = abstractClass.name;
    const deps = concreteClass.inject ?? [];
    this.providers.set(token, { impl: concreteClass as ConcreteConstructor, deps });
  }

  register(impl: IInjectableClass): void {
    const token = impl.name;

    if (this.providers.has(token)) {
      return;
    }

    const deps = impl.inject ?? [];
    this.providers.set(token, { impl: impl as ConcreteConstructor, deps });
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
