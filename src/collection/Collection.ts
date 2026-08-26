import type { Callback, ItemsInput, Key } from './types';

// A sentinel telling an absent value apart from a stored undefined, which is what
// lets `select` skip the keys an item does not carry instead of writing them out
// with an undefined value.
const MISSING: unique symbol = Symbol('missing');

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
     * Create a fresh collection holding the same entries.
     */
    collect(): Collection<V> {
        return new Collection<V>(this);
    }

    /**
     * Count the number of items in the collection.
     */
    count(): number {
        return this.items.size;
    }

    /**
     * Iterate over the items, stopping when the callback returns false.
     */
    each(callback: Callback<V>): this {
        for (const [key, value] of this.items) {
            if (callback(value, key) === false) {
                break;
            }
        }

        return this;
    }

    /**
     * Iterate over the items, spreading each nested item into the callback arguments.
     */
    eachSpread(callback: (...args: unknown[]) => unknown): this {
        return this.each((value: V, key: Key): unknown => callback(...this.spread(value), key));
    }

    /**
     * Get all items except those with the given keys.
     */
    except(...keys: Key[]): Collection<V> {
        const excluded: Key[] = keys.map((key: Key): Key => this.key(key));

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key]: [Key, V]): boolean => !excluded.includes(key))));
    }

    /**
     * Get the items passing the callback, or the truthy items when no callback is given.
     */
    filter(callback?: Callback<V>): Collection<V> {
        const predicate: Callback<V> = callback ?? ((value: V): unknown => value);

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key, value]: [Key, V]): boolean => this.truthy(predicate(value, key)))));
    }

    /**
     * Get the first item, or the first item passing the callback, falling back when none match.
     */
    first(): V | undefined;
    first(callback: Callback<V>): V | undefined;
    first<F>(callback: Callback<V> | undefined, fallback: F | (() => F)): V | F;
    first(callback?: Callback<V>, fallback?: unknown): unknown {
        const predicate: Callback<V> = callback ?? ((): boolean => true);

        for (const [key, value] of this.items) {
            if (this.truthy(predicate(value, key))) {
                return value;
            }
        }

        return this.resolve(fallback);
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
     * Get the last item, or the last item passing the callback, falling back when none match.
     */
    last(): V | undefined;
    last(callback: Callback<V>): V | undefined;
    last<F>(callback: Callback<V> | undefined, fallback: F | (() => F)): V | F;
    last(callback?: Callback<V>, fallback?: unknown): unknown {
        const predicate: Callback<V> = callback ?? ((): boolean => true);
        let found: unknown = undefined;
        let matched: boolean = false;

        for (const [key, value] of this.items) {
            if (this.truthy(predicate(value, key))) {
                found = value;
                matched = true;
            }
        }

        return matched ? found : this.resolve(fallback);
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
     * Map the items into instances of the given class.
     */
    mapInto<T>(type: new (value: V, key: Key) => T): Collection<T> {
        return this.map((value: V, key: Key): T => new type(value, key));
    }

    /**
     * Map the items through the callback, spreading each nested item into its arguments.
     */
    mapSpread<R>(callback: (...args: unknown[]) => R): Collection<R> {
        return this.map((value: V, key: Key): R => callback(...this.spread(value), key));
    }

    /**
     * Map the items into a dictionary, grouping the values of each returned key into an array.
     */
    mapToDictionary<R>(callback: Callback<V, [Key, R]>): Collection<R[]> {
        const dictionary: Map<Key, R[]> = new Map<Key, R[]>();

        for (const [key, value] of this.items) {
            const [name, mapped]: [Key, R] = callback(value, key);
            const grouped: Key = this.key(name);

            dictionary.set(grouped, [...(dictionary.get(grouped) ?? []), mapped]);
        }

        return new Collection<R[]>(dictionary);
    }

    /**
     * Map the items into groups keyed by the returned key.
     */
    mapToGroups<R>(callback: Callback<V, [Key, R]>): Collection<Collection<R>> {
        return this.mapToDictionary(callback).map((group: R[]): Collection<R> => new Collection<R>(group));
    }

    /**
     * Map the items into a collection keyed by the returned key.
     */
    mapWithKeys<R>(callback: Callback<V, [Key, R]>): Collection<R> {
        const mapped: Map<Key, R> = new Map<Key, R>();

        for (const [key, value] of this.items) {
            const [name, entry]: [Key, R] = callback(value, key);

            mapped.set(this.key(name), entry);
        }

        return new Collection<R>(mapped);
    }

    /**
     * Get only the items with the given keys.
     */
    only(...keys: Key[]): Collection<V> {
        const wanted: Key[] = keys.map((key: Key): Key => this.key(key));

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key]: [Key, V]): boolean => wanted.includes(key))));
    }

    /**
     * Get the values of the given key from every item, optionally keyed by another key.
     */
    pluck(value: Key, key?: Key): Collection<unknown> {
        if (key === undefined) {
            return new Collection<unknown>([...this.items.values()].map((item: V): unknown => this.dataGet(item, value)));
        }

        const plucked: Map<Key, unknown> = new Map<Key, unknown>();

        for (const item of this.items.values()) {
            plucked.set(this.scalar(this.dataGet(item, key)), this.dataGet(item, value));
        }

        return new Collection<unknown>(plucked);
    }

    /**
     * Set the item at the given key.
     */
    put(key: Key, value: V): this {
        this.items.set(this.key(key), value);

        return this;
    }

    /**
     * Reduce the collection to a single value, carrying the result between iterations.
     */
    reduce<R>(callback: (carry: R, value: V, key: Key) => R, initial: R): R {
        let carry: R = initial;

        for (const [key, value] of this.items) {
            carry = callback(carry, value, key);
        }

        return carry;
    }

    /**
     * Reduce the collection to multiple values, carrying an array of results between iterations.
     */
    reduceSpread(callback: (carry: unknown[], value: V, key: Key) => unknown[], ...initial: unknown[]): unknown[] {
        let carry: unknown[] = initial;

        for (const [key, value] of this.items) {
            carry = callback(carry, value, key);
        }

        return carry;
    }

    /**
     * Get the items failing the callback, or the falsy items when no callback is given.
     */
    reject(callback?: Callback<V>): Collection<V> {
        const predicate: Callback<V> = callback ?? ((value: V): unknown => value);

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key, value]: [Key, V]): boolean => !this.truthy(predicate(value, key)))));
    }

    /**
     * Reduce each item to only the given keys.
     */
    select(...keys: Key[]): Collection<Record<string, unknown>> {
        return this.map((value: V): Record<string, unknown> => {
            const selected: Record<string, unknown> = {};

            for (const key of keys) {
                const retrieved: unknown = this.dataGet(value, key, MISSING);

                if (retrieved !== MISSING) {
                    selected[String(key)] = retrieved;
                }
            }

            return selected;
        });
    }

    /**
     * Map the items through the callback in place.
     */
    transform(callback: Callback<V, V>): this {
        for (const [key, value] of this.entries()) {
            this.items.set(key, callback(value, key));
        }

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
     * Reduce an arbitrary value to a key usable for grouping and counting.
     */
    protected scalar(value: unknown): Key {
        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'string') {
            return this.key(value);
        }

        if (this.nullish(value)) {
            return '';
        }

        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }

        return String(value);
    }

    /**
     * Get the values of any supported input.
     */
    protected valuesOf<T>(items: ItemsInput<T>): T[] {
        return this.parse(items).map(([, value]: [Key, T]): T => value);
    }

    /**
     * Determine whether a value holds nested items.
     */
    protected nested(value: unknown): boolean {
        return value instanceof Collection || value instanceof Map || Array.isArray(value) || Collection.plain(value);
    }

    /**
     * Get the values of a nested item, or the value itself when it holds none.
     */
    protected spread(value: unknown): unknown[] {
        return this.nested(value) ? this.valuesOf(value as ItemsInput<unknown>) : [value];
    }

    /**
     * Determine whether a value is null or undefined.
     */
    protected nullish(value: unknown): boolean {
        return value === null || value === undefined;
    }

    /**
     * Coerce a callback result to a boolean using JavaScript truthiness.
     */
    protected truthy(value: unknown): boolean {
        return Boolean(value);
    }

    /**
     * Resolve a value that may be given as a callback.
     */
    protected resolve<T>(value: T | (() => T)): T {
        return typeof value === 'function' ? (value as () => T)() : value;
    }

    /**
     * Build a value retriever from a key, a callback, or nothing at all.
     */
    protected retriever(key?: Key | Callback<V>): Callback<V> {
        if (key === undefined) {
            return (value: V): unknown => value;
        }

        if (typeof key === 'function') {
            return key;
        }

        return (value: V): unknown => this.dataGet(value, key);
    }

    /**
     * Read a value out of a nested structure using dot notation and wildcards.
     */
    protected dataGet(target: unknown, key: Key | null, fallback?: unknown): unknown {
        if (key === null) {
            return target;
        }

        const segments: string[] = typeof key === 'number' ? [String(key)] : key.split('.');
        let current: unknown = target;

        for (let index: number = 0; index < segments.length; index++) {
            const segment: string = segments[index] as string;

            if (segment === '*') {
                if (!this.nested(current)) {
                    return this.resolve(fallback);
                }

                const rest: string = segments.slice(index + 1).join('.');

                return this.valuesOf(current as ItemsInput<unknown>).map((entry: unknown): unknown => this.dataGet(entry, rest === '' ? null : rest, fallback));
            }

            current = this.member(current, segment);

            if (current === undefined) {
                return this.resolve(fallback);
            }
        }

        return current;
    }

    /**
     * Read a single member out of a collection, map, array, or object.
     */
    protected member(target: unknown, segment: string): unknown {
        if (target instanceof Collection) {
            return target.items.get(this.key(segment));
        }

        if (target instanceof Map) {
            return (target as Map<Key, unknown>).get(this.key(segment));
        }

        if (this.nullish(target)) {
            return undefined;
        }

        return (target as Record<string, unknown>)[segment];
    }
}
