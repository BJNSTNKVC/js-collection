import type { Callback, ItemsInput, Key } from './types';

export class Collection<V = unknown> implements Iterable<V> {
    /**
     * The entries contained in the collection, keyed like a PHP array.
     */
    protected items: Map<Key, V>;

    /**
     * Create a new collection.
     */
    constructor(items?: ItemsInput<V>) {
        this.items = new Map<Key, V>(this.parse(items));
    }

    /**
     * Create a new empty collection.
     */
    static empty<T = unknown>(): Collection<T> {
        return new Collection<T>();
    }

    /**
     * Create a collection by decoding the given JSON string.
     */
    static fromJson(json: string): Collection<unknown> {
        return new Collection<unknown>(JSON.parse(json) as ItemsInput<unknown>);
    }

    /**
     * Create a new collection from the given items.
     */
    static make<T = unknown>(items?: ItemsInput<T>): Collection<T> {
        return new Collection<T>(items);
    }

    /**
     * Create a collection with an inclusive range of numbers, ascending or descending.
     */
    static range(from: number, to: number): Collection<number> {
        const values: number[] = [];

        if (from <= to) {
            for (let value: number = from; value <= to; value++) {
                values.push(value);
            }
        } else {
            for (let value: number = from; value >= to; value--) {
                values.push(value);
            }
        }

        return new Collection<number>(values);
    }

    /**
     * Create a collection by invoking the callback once for each number from 1 to count.
     */
    static times(count: number): Collection<number>;
    static times<T>(count: number, callback: (index: number) => T): Collection<T>;
    static times<T>(count: number, callback?: (index: number) => T): Collection<T> | Collection<number> {
        if (count < 1) {
            return new Collection<number>();
        }

        const range: Collection<number> = Collection.range(1, count);

        return callback === undefined ? range : range.map((value: number): T => callback(value));
    }

    /**
     * Get the underlying items of the given value when it is a collection.
     */
    static unwrap<T>(value: Collection<T> | T): T[] | Record<string, T> | T {
        return value instanceof Collection ? value.all() : value;
    }

    /**
     * Wrap the given value in a collection when it is not one already.
     */
    static wrap<T>(value: ItemsInput<T> | T): Collection<T> {
        if (value instanceof Collection) {
            return new Collection<T>(value as Collection<T>);
        }

        if (value === null || value === undefined) {
            return new Collection<T>();
        }

        if (Array.isArray(value) || value instanceof Map || Collection.plain(value)) {
            return new Collection<T>(value as ItemsInput<T>);
        }

        return new Collection<T>([value as T]);
    }

    /**
     * Get the underlying items, as an array for lists and a plain object otherwise.
     */
    all(): V[] | Record<string, V> {
        return this.list() ? [...this.items.values()] : Object.fromEntries(this.items) as Record<string, V>;
    }

    /**
     * Count the number of items in the collection.
     */
    count(): number {
        return this.items.size;
    }

    /**
     * Remove the items with the given keys from the collection.
     */
    forget(...keys: Key[]): this {
        for (const key of keys) {
            this.items.delete(this.key(key));
        }

        return this;
    }

    /**
     * Get the item at the given key, falling back when the key is missing.
     */
    get(key: Key): V | undefined;
    get<F>(key: Key, fallback: F | (() => F)): V | F;
    get(key: Key, fallback?: unknown): unknown {
        const name: Key = this.key(key);

        return this.items.has(name) ? this.items.get(name) : this.resolve(fallback);
    }

    /**
     * Determine whether all of the given keys are present in the collection.
     */
    has(...keys: Key[]): boolean {
        return keys.every((key: Key): boolean => this.items.has(this.key(key)));
    }

    /**
     * Determine whether any of the given keys are present in the collection.
     */
    hasAny(...keys: Key[]): boolean {
        return keys.some((key: Key): boolean => this.items.has(this.key(key)));
    }

    /**
     * Determine whether the collection is empty.
     */
    isEmpty(): boolean {
        return this.items.size === 0;
    }

    /**
     * Determine whether the collection is not empty.
     */
    isNotEmpty(): boolean {
        return this.items.size > 0;
    }

    /**
     * Get the keys of the collection.
     */
    keys(): Collection<Key> {
        return new Collection<Key>([...this.items.keys()]);
    }

    /**
     * Map the items through the callback, preserving keys.
     */
    map<R>(callback: Callback<V, R>): Collection<R> {
        const mapped: Map<Key, R> = new Map<Key, R>();

        for (const [key, value] of this.items) {
            mapped.set(key, callback(value, key));
        }

        return new Collection<R>(mapped);
    }

    /**
     * Set the item at the given key.
     */
    put(key: Key, value: V): this {
        this.items.set(this.key(key), value);

        return this;
    }

    /**
     * Get the values of the collection, renumbering the keys.
     */
    values(): Collection<V> {
        return new Collection<V>([...this.items.values()]);
    }

    /**
     * Iterate over the values of the collection.
     */
    [Symbol.iterator](): Iterator<V> {
        return this.items.values();
    }

    /**
     * Determine whether a value is a plain object rather than a class instance.
     */
    protected static plain(value: unknown): value is Record<Key, unknown> {
        if (typeof value !== 'object' || value === null) {
            return false;
        }

        const prototype: object | null = Object.getPrototypeOf(value) as object | null;

        return prototype === Object.prototype || prototype === null;
    }

    /**
     * Normalize any supported input into an ordered list of key-value entries.
     */
    protected parse<T>(items?: ItemsInput<T>): [Key, T][] {
        if (items === null || items === undefined) {
            return [];
        }

        if (items instanceof Collection) {
            return items.entries();
        }

        if (items instanceof Map) {
            return [...items.entries()].map(([key, value]: [Key, T]): [Key, T] => [this.key(key), value]);
        }

        if (Array.isArray(items)) {
            return items.map((value: T, index: number): [Key, T] => [index, value]);
        }

        // Sets and generators are the JavaScript counterpart of a PHP Traversable,
        // so any other iterable is consumed as a list of values rather than being
        // read as a record of its own enumerable properties.
        if (typeof (items as Iterable<T>)[Symbol.iterator] === 'function') {
            return [...(items as Iterable<T>)].map((value: T, index: number): [Key, T] => [index, value]);
        }

        return Object.entries(items).map(([key, value]: [string, T]): [Key, T] => [this.key(key), value]);
    }

    /**
     * Get the entries of the collection as an array.
     */
    protected entries(): [Key, V][] {
        return [...this.items.entries()];
    }

    /**
     * Normalize a key, folding canonical integer strings into numbers.
     */
    protected key(key: Key): Key {
        return typeof key === 'string' && /^(0|-?[1-9]\d*)$/.test(key) ? Number(key) : key;
    }

    /**
     * Determine whether the keys form a zero-based sequence, i.e. a list.
     */
    protected list(): boolean {
        let index: number = 0;

        for (const key of this.items.keys()) {
            if (key !== index++) {
                return false;
            }
        }

        return true;
    }

    /**
     * Resolve a value that may be given as a callback.
     */
    protected resolve<T>(value: T | (() => T)): T {
        return typeof value === 'function' ? (value as () => T)() : value;
    }
}
