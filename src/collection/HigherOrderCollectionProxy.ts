import type { Collection } from './Collection';

export type HigherOrderResults<V, R> = {
    average: number | undefined;
    avg: number | undefined;
    contains: boolean;
    each: Collection<V>;
    every: boolean;
    filter: Collection<V>;
    first: V | undefined;
    flatMap: Collection<unknown>;
    groupBy: Collection<Collection<V>>;
    keyBy: Collection<V>;
    map: Collection<R>;
    max: unknown;
    min: unknown;
    partition: Collection<Collection<V>>;
    reject: Collection<V>;
    skipUntil: Collection<V>;
    skipWhile: Collection<V>;
    some: boolean;
    sortBy: Collection<V>;
    sortByDesc: Collection<V>;
    sum: number;
    takeUntil: Collection<V>;
    takeWhile: Collection<V>;
    unique: Collection<V>;
};

export type Proxied = keyof HigherOrderResults<unknown, unknown>;

export type HigherOrderMessages<V, M extends Proxied> = {
    readonly [K in keyof NonNullable<V>]-?: NonNullable<NonNullable<V>[K]> extends (...args: infer A) => infer R
        ? (...args: A) => HigherOrderResults<V, R>[M]
        : HigherOrderResults<V, NonNullable<V>[K]>[M];
};

type Method = (...args: unknown[]) => unknown;

// The getters installed in place of proxied methods, which is how registering a
// method twice, or once more from a subclass, is told apart from a missing one.
const getters: WeakSet<object> = new WeakSet<object>();

export class HigherOrderCollectionProxy {
    /**
     * The collection being operated on.
     */
    protected collection: object;

    /**
     * The method being proxied.
     */
    protected method: Method;

    /**
     * Create a new proxy instance.
     */
    constructor(collection: object, method: Method) {
        this.collection = collection;
        this.method = method;
    }

    /**
     * Proxy reading an attribute, or calling a method, onto the collection items.
     */
    get(key: string): unknown {
        const invoke: Method = (...args: unknown[]): unknown => this.method.call(this.collection, (item: unknown): unknown => ((item as Record<string, Method>)[key] as Method)(...args));

        // PHP tells `$users->each->markAsVip()` from a property by its separate __get
        // and __call, while JavaScript reads the member before it knows whether a call
        // follows, so the form is told apart by what the items hold under the key.
        const sample: unknown = this.sample(key);

        if (typeof sample === 'function') {
            return invoke;
        }

        const result: unknown = this.method.call(this.collection, (item: unknown): unknown => (item as Record<string, unknown> | null | undefined)?.[key]);

        if (sample !== undefined || typeof result !== 'object' || result === null) {
            return result;
        }

        return this.deferred(result, invoke);
    }

    /**
     * Get the member of the first item carrying the given key.
     */
    protected sample(key: string): unknown {
        for (const item of this.collection as Iterable<unknown>) {
            const member: unknown = (item as Record<string, unknown> | null | undefined)?.[key];

            if (member !== undefined) {
                return member;
            }
        }

        return undefined;
    }

    /**
     * Stand in for a result whose form the items could not tell, behaving like it until called as a method.
     */
    protected deferred(result: object, invoke: Method): unknown {
        // Only an empty collection, or one whose items all lack the member, lands here.
        // An empty one never runs the callback, so both forms share this result, and
        // wrapping it keeps `users.each.markAsVip()` from throwing when nobody matched.
        return new Proxy<Method>(invoke, {
            get: (_: Method, key: string | symbol): unknown => Reflect.get(result, key),
            set: (_: Method, key: string | symbol, value: unknown): boolean => Reflect.set(result, key, value),
            has: (_: Method, key: string | symbol): boolean => Reflect.has(result, key),
            ownKeys: (): (string | symbol)[] => Reflect.ownKeys(result),
            getOwnPropertyDescriptor: (_: Method, key: string | symbol): PropertyDescriptor | undefined => Reflect.getOwnPropertyDescriptor(result, key),
            getPrototypeOf: (): object | null => Reflect.getPrototypeOf(result),
        });
    }
}

/**
 * Replace the given method with a getter whose result is still callable but also takes higher order messages.
 */
export function install(prototype: object, method: string): void {
    let owner: object | null = prototype;
    let descriptor: PropertyDescriptor | undefined = undefined;

    while (owner !== null && descriptor === undefined) {
        descriptor = Object.getOwnPropertyDescriptor(owner, method);
        owner = Object.getPrototypeOf(owner) as object | null;
    }

    if (descriptor?.get !== undefined && getters.has(descriptor.get)) {
        return;
    }

    if (typeof descriptor?.value !== 'function') {
        throw new TypeError(`Method [${method}] does not exist on this collection instance.`);
    }

    const original: Method = descriptor.value as Method;
    const getter: (this: object) => Method = function (this: object): Method {
        return callable(this, original);
    };

    getters.add(getter);

    Object.defineProperty(prototype, method, { get: getter, configurable: true });
}

/**
 * Wrap the method so that calling it runs the method, while reading a member off it sends a higher order message.
 */
function callable(collection: object, method: Method): Method {
    const proxy: HigherOrderCollectionProxy = new HigherOrderCollectionProxy(collection, method);

    return new Proxy<Method>(method, {
        apply: (target: Method, _: unknown, args: unknown[]): unknown => Reflect.apply(target, collection, args),
        get: (target: Method, key: string | symbol): unknown => typeof key === 'symbol' ? Reflect.get(target, key) : proxy.get(key),
    });
}
