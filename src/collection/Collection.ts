import { ItemNotFoundException, MultipleItemsFoundException } from './exceptions';
import type { Callback, Constructor, ItemsInput, Key, Operator, Primitive } from './types';

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
     * Get the item that comes right after the first item matching the given value or callback.
     */
    after(value: V | Callback<V, boolean>, strict: boolean = false): V | undefined {
        const entries: [Key, V][] = this.entries();
        const predicate: Callback<V, boolean> = this.equality(value, strict);
        const index: number = entries.findIndex(([key, item]: [Key, V]): boolean => this.truthy(predicate(item, key)));

        if (index === -1) {
            return undefined;
        }

        const found: [Key, V] | undefined = entries[index + 1];

        return found === undefined ? undefined : found[1];
    }

    /**
     * Get the underlying items, as an array for lists and a plain object otherwise.
     */
    all(): V[] | Record<string, V> {
        return this.list() ? [...this.items.values()] : Object.fromEntries(this.items) as Record<string, V>;
    }

    /**
     * Get the item that comes right before the first item matching the given value or callback.
     */
    before(value: V | Callback<V, boolean>, strict: boolean = false): V | undefined {
        const entries: [Key, V][] = this.entries();
        const predicate: Callback<V, boolean> = this.equality(value, strict);
        const index: number = entries.findIndex(([key, item]: [Key, V]): boolean => this.truthy(predicate(item, key)));

        if (index === -1) {
            return undefined;
        }

        const found: [Key, V] | undefined = entries[index - 1];

        return found === undefined ? undefined : found[1];
    }

    /**
     * Create a fresh collection holding the same entries.
     */
    collect(): Collection<V> {
        return new Collection<V>(this);
    }

    /**
     * Determine whether the collection contains the given value, callback match, or key-value condition.
     */
    contains(key: V | Callback<V, boolean> | Key, operator?: unknown, value?: unknown): boolean {
        if (typeof key === 'function') {
            return this.entries().some(([name, item]: [Key, V]): boolean => this.truthy((key as Callback<V, boolean>)(item, name)));
        }

        if (arguments.length === 1) {
            return [...this.items.values()].some((item: V): boolean => this.looseEquals(item, key));
        }

        const condition: Callback<V, boolean> = this.condition(key as Key, operator, value, arguments.length);

        return this.entries().some(([name, item]: [Key, V]): boolean => condition(item, name));
    }

    /**
     * Determine whether the collection holds exactly one item, or one item passing the callback.
     */
    containsOneItem(callback?: Callback<V, boolean>): boolean {
        if (callback === undefined) {
            return this.count() === 1;
        }

        return this.filter(callback).count() === 1;
    }

    /**
     * Determine whether the collection contains the given value or key-value pair using strict comparison.
     */
    containsStrict(key: V | Callback<V, boolean> | Key, value?: unknown): boolean {
        if (arguments.length === 2) {
            return this.entries().some(([, item]: [Key, V]): boolean => this.dataGet(item, key as Key) === value);
        }

        if (typeof key === 'function') {
            return this.contains(key);
        }

        return [...this.items.values()].some((item: V): boolean => item === key);
    }

    /**
     * Count the number of items in the collection.
     */
    count(): number {
        return this.items.size;
    }

    /**
     * Determine whether the collection does not contain the given value, callback match, or condition.
     */
    doesntContain(key: V | Callback<V, boolean> | Key, operator?: unknown, value?: unknown): boolean {
        switch (arguments.length) {
            case 1:
                return !this.contains(key);
            case 2:
                return !this.contains(key, operator);
            default:
                return !this.contains(key, operator, value);
        }
    }

    /**
     * Determine whether the collection does not contain the given value or pair using strict comparison.
     */
    doesntContainStrict(key: V | Callback<V, boolean> | Key, value?: unknown): boolean {
        switch (arguments.length) {
            case 1:
                return !this.containsStrict(key);
            default:
                return !this.containsStrict(key, value);
        }
    }

    /**
     * Get the values that appear more than once, keyed by the offending occurrences.
     */
    duplicates(callback?: Key | Callback<V>, strict: boolean = false): Collection<unknown> {
        const retriever: Callback<V> = this.retriever(callback);
        const seen: unknown[] = [];
        const duplicates: Map<Key, unknown> = new Map<Key, unknown>();

        for (const [key, value] of this.items) {
            const derived: unknown = retriever(value, key);
            const exists: boolean = strict ? seen.includes(derived) : seen.some((item: unknown): boolean => this.looseEquals(item, derived));

            if (exists) {
                duplicates.set(key, derived);
            } else {
                seen.push(derived);
            }
        }

        return new Collection<unknown>(duplicates);
    }

    /**
     * Get the values that appear more than once using strict comparison.
     */
    duplicatesStrict(callback?: Key | Callback<V>): Collection<unknown> {
        return this.duplicates(callback, true);
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
     * Throw when any item is not of the given primitive types or class instances.
     */
    ensure(type: Primitive | Constructor | (Primitive | Constructor)[]): this {
        const allowed: (Primitive | Constructor)[] = Array.isArray(type) ? type : [type];
        const names: string = allowed.map((entry: Primitive | Constructor): string => typeof entry === 'function' ? entry.name : entry).join(', ');

        for (const [key, value] of this.items) {
            const passes: boolean = allowed.some((entry: Primitive | Constructor): boolean => typeof entry === 'function' ? value instanceof entry : this.typeOf(value) === entry);

            if (!passes) {
                throw new TypeError(`Collection should only include [${names}] items, but [${this.typeOf(value)}] found at key [${key}].`);
            }
        }

        return this;
    }

    /**
     * Determine whether all items pass the given callback, truth test, or key-value condition.
     */
    every(key: Key | Callback<V>, operator?: unknown, value?: unknown): boolean {
        if (arguments.length === 1) {
            const retriever: Callback<V> = this.retriever(key);

            return this.entries().every(([name, item]: [Key, V]): boolean => this.truthy(retriever(item, name)));
        }

        const condition: Callback<V, boolean> = this.condition(key as Key, operator, value, arguments.length);

        return this.entries().every(([name, item]: [Key, V]): boolean => condition(item, name));
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
     * Get the first item passing the callback or key-value condition, throwing when none match.
     */
    firstOrFail(key?: Key | Callback<V>, operator?: unknown, value?: unknown): V {
        let predicate: Callback<V> | undefined = undefined;

        if (arguments.length === 1) {
            predicate = key as Callback<V>;
        } else if (arguments.length > 1) {
            predicate = this.condition(key as Key, operator, value, arguments.length);
        }

        for (const [name, item] of this.items) {
            if (predicate === undefined || this.truthy(predicate(item, name))) {
                return item;
            }
        }

        throw new ItemNotFoundException();
    }

    /**
     * Get the first item matching the given key-value condition.
     */
    firstWhere(key: Key, operator?: unknown, value?: unknown): V | undefined {
        const condition: Callback<V, boolean> = this.condition(key, operator, value, arguments.length);

        return this.first((item: V, name: Key): boolean => condition(item, name));
    }

    /**
     * Swap the keys with their corresponding string or number values.
     */
    flip(): Collection<Key> {
        const flipped: Map<Key, Key> = new Map<Key, Key>();

        for (const [key, value] of this.items) {
            if (typeof value !== 'string' && typeof value !== 'number') {
                throw new TypeError(`Collection values must be strings or numbers to flip, [${this.typeOf(value)}] found at key [${key}].`);
            }

            flipped.set(this.key(value), key);
        }

        return new Collection<Key>(flipped);
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
     * Get the key of the first item matching the given value or callback, or false when absent.
     */
    search(value: V | Callback<V, boolean>, strict: boolean = false): Key | false {
        const predicate: Callback<V, boolean> = this.equality(value, strict);

        for (const [key, item] of this.items) {
            if (this.truthy(predicate(item, key))) {
                return key;
            }
        }

        return false;
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
     * Get the sole item, or the sole item matching the truth test, throwing otherwise.
     */
    sole(key?: Key | Callback<V>, operator?: unknown, value?: unknown): V {
        let filtered: Collection<V> = this;

        if (arguments.length === 1) {
            filtered = this.filter(this.retriever(key));
        } else if (arguments.length > 1) {
            filtered = this.filter(this.condition(key as Key, operator, value, arguments.length));
        }

        const count: number = filtered.count();

        if (count === 0) {
            throw new ItemNotFoundException();
        }

        if (count > 1) {
            throw new MultipleItemsFoundException(count);
        }

        return filtered.first() as V;
    }

    /**
     * Determine whether the collection contains the given value, callback match, or condition.
     */
    some(key: V | Callback<V, boolean> | Key, operator?: unknown, value?: unknown): boolean {
        switch (arguments.length) {
            case 1:
                return this.contains(key);
            case 2:
                return this.contains(key, operator);
            default:
                return this.contains(key, operator, value);
        }
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
     * Get the items with duplicate values removed.
     */
    unique(key?: Key | Callback<V>, strict: boolean = false): Collection<V> {
        const retriever: Callback<V> = this.retriever(key);
        const seen: unknown[] = [];

        const entries: [Key, V][] = this.entries().filter(([name, value]: [Key, V]): boolean => {
            const derived: unknown = retriever(value, name);
            const exists: boolean = strict
                ? seen.includes(derived)
                : seen.some((item: unknown): boolean => this.looseEquals(item, derived));

            if (exists) {
                return false;
            }

            seen.push(derived);

            return true;
        });

        return new Collection<V>(new Map<Key, V>(entries));
    }

    /**
     * Get the items with duplicate values removed using strict comparison.
     */
    uniqueStrict(key?: Key | Callback<V>): Collection<V> {
        return this.unique(key, true);
    }

    /**
     * Get the value of the given key from the first item holding it.
     */
    value(key: Key): unknown;
    value<F>(key: Key, fallback: F | (() => F)): unknown;
    value(key: Key, fallback?: unknown): unknown {
        const found: V | undefined = this.first((item: V): boolean => this.dataGet(item, key) !== null && this.dataGet(item, key) !== undefined);

        return found === undefined ? this.resolve(fallback) : this.dataGet(found, key, fallback);
    }

    /**
     * Get the values of the collection, renumbering the keys.
     */
    values(): Collection<V> {
        return new Collection<V>([...this.items.values()]);
    }

    /**
     * Get the items matching the given key-value condition.
     */
    where(key: Key, operator?: unknown, value?: unknown): Collection<V> {
        const condition: Callback<V, boolean> = this.condition(key, operator, value, arguments.length);

        return this.filter((item: V, name: Key): boolean => condition(item, name));
    }

    /**
     * Get the items whose value at the given key falls inside the given range.
     */
    whereBetween(key: Key, range: [unknown, unknown]): Collection<V> {
        return this.filter((item: V): boolean => this.compare(this.dataGet(item, key), '>=', range[0]) && this.compare(this.dataGet(item, key), '<=', range[1]));
    }

    /**
     * Get the items whose value at the given key is present in the given values.
     */
    whereIn(key: Key, values: ItemsInput<unknown>, strict: boolean = false): Collection<V> {
        const allowed: unknown[] = this.valuesOf(values);

        return this.filter((item: V): boolean => this.included(allowed, this.dataGet(item, key), strict));
    }

    /**
     * Get the items whose value at the given key is present in the given values, compared strictly.
     */
    whereInStrict(key: Key, values: ItemsInput<unknown>): Collection<V> {
        return this.whereIn(key, values, true);
    }

    /**
     * Get the items that are instances of the given class.
     */
    whereInstanceOf<T>(type: Constructor<T>): Collection<V> {
        return this.filter((item: V): boolean => item instanceof type);
    }

    /**
     * Get the items whose value at the given key falls outside the given range.
     */
    whereNotBetween(key: Key, range: [unknown, unknown]): Collection<V> {
        return this.filter((item: V): boolean => this.compare(this.dataGet(item, key), '<', range[0]) || this.compare(this.dataGet(item, key), '>', range[1]));
    }

    /**
     * Get the items whose value at the given key is absent from the given values.
     */
    whereNotIn(key: Key, values: ItemsInput<unknown>, strict: boolean = false): Collection<V> {
        const rejected: unknown[] = this.valuesOf(values);

        return this.filter((item: V): boolean => !this.included(rejected, this.dataGet(item, key), strict));
    }

    /**
     * Get the items whose value at the given key is absent from the given values, compared strictly.
     */
    whereNotInStrict(key: Key, values: ItemsInput<unknown>): Collection<V> {
        return this.whereNotIn(key, values, true);
    }

    /**
     * Get the items whose value at the given key is not null.
     */
    whereNotNull(key?: Key): Collection<V> {
        return this.filter((item: V): boolean => !this.nullish(key === undefined ? item : this.dataGet(item, key)));
    }

    /**
     * Get the items whose value at the given key is null.
     */
    whereNull(key?: Key): Collection<V> {
        return this.filter((item: V): boolean => this.nullish(key === undefined ? item : this.dataGet(item, key)));
    }

    /**
     * Get the items matching the given key-value condition using strict comparison.
     */
    whereStrict(key: Key, value: unknown): Collection<V> {
        return this.where(key, '===', value);
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
     * Get the type name of a value for error messages and type checks.
     */
    protected typeOf(value: unknown): Primitive {
        if (value === null) {
            return 'null';
        }

        if (Array.isArray(value)) {
            return 'array';
        }

        return typeof value as Primitive;
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
     * Build a predicate from a key, an optional operator, and a value.
     */
    protected condition(key: Key, operator: unknown, value: unknown, length: number): Callback<V, boolean> {
        const comparison: Operator = (length === 2 ? '=' : operator) as Operator;
        const compared: unknown = length === 2 ? operator : value;

        return (item: V): boolean => this.compare(this.dataGet(item, key), comparison, compared);
    }

    /**
     * Compare a retrieved value against the given value using the given operator.
     */
    protected compare(retrieved: unknown, operator: Operator, value: unknown): boolean {
        switch (operator) {
            case '=':
            case '==':
                return this.looseEquals(retrieved, value);
            case '!=':
            case '<>':
                return !this.looseEquals(retrieved, value);
            case '===':
                return retrieved === value;
            case '!==':
                return retrieved !== value;
            case '<':
                return this.comparator(retrieved, value) < 0;
            case '>':
                return this.comparator(retrieved, value) > 0;
            case '<=':
                return this.comparator(retrieved, value) <= 0;
            case '>=':
                return this.comparator(retrieved, value) >= 0;
            default:
                throw new TypeError(`Unknown operator [${String(operator)}].`);
        }
    }

    /**
     * Determine whether a value is a number or a numeric string.
     */
    protected numeric(value: unknown): boolean {
        if (typeof value === 'number') {
            return !Number.isNaN(value);
        }

        return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value));
    }

    /**
     * Compare two values loosely, in the spirit of PHP's equality operator.
     */
    protected looseEquals(a: unknown, b: unknown): boolean {
        if (Object.is(a, b)) {
            return true;
        }

        if (this.nullish(a) || this.nullish(b)) {
            return this.nullish(a) && this.nullish(b);
        }

        if (typeof a === 'object' && typeof b === 'object') {
            return this.structural(a, b);
        }

        if (typeof a === 'object' || typeof b === 'object') {
            return false;
        }

        if (typeof a === typeof b) {
            return a === b;
        }

        if (typeof a === 'boolean' || typeof b === 'boolean') {
            return this.truthy(a) === this.truthy(b);
        }

        return this.numeric(a) && this.numeric(b) && Number(a) === Number(b);
    }

    /**
     * Compare two objects by the shape and values of their entries.
     */
    protected structural(a: unknown, b: unknown): boolean {
        if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        }

        if (!this.nested(a) || !this.nested(b)) {
            return false;
        }

        const left: [Key, unknown][] = this.parse(a as ItemsInput<unknown>);
        const right: Map<Key, unknown> = new Map<Key, unknown>(this.parse(b as ItemsInput<unknown>));

        if (left.length !== right.size) {
            return false;
        }

        return left.every(([key, value]: [Key, unknown]): boolean => right.has(key) && this.looseEquals(right.get(key), value));
    }

    /**
     * Compare two values for ordering, numerically when possible and by string otherwise.
     */
    protected comparator(a: unknown, b: unknown): number {
        if (this.numeric(a) && this.numeric(b)) {
            return Number(a) < Number(b) ? -1 : Number(a) > Number(b) ? 1 : 0;
        }

        if (this.nullish(a) || this.nullish(b)) {
            return this.nullish(a) && this.nullish(b) ? 0 : this.nullish(a) ? -1 : 1;
        }

        const left: string = String(a);
        const right: string = String(b);

        return left < right ? -1 : left > right ? 1 : 0;
    }

    /**
     * Build an equality predicate from a value or a callback.
     */
    protected equality(value: V | Callback<V, boolean>, strict: boolean): Callback<V, boolean> {
        if (typeof value === 'function') {
            return value as Callback<V, boolean>;
        }

        return (item: V): boolean => strict ? item === value : this.looseEquals(item, value);
    }

    /**
     * Determine whether a value is present among the given values.
     */
    protected included(values: unknown[], value: unknown, strict: boolean): boolean {
        return values.some((entry: unknown): boolean => strict ? entry === value : this.looseEquals(entry, value));
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
