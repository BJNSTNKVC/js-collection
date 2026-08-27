import { ItemNotFoundException, MultipleItemsFoundException } from './exceptions';
import type { Callback, Comparator, Constructor, Criteria, Direction, ItemsInput, Key, Operator, Primitive } from './types';

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
     * Append an item to the collection under the next integer key.
     */
    add(item: V): this {
        this.items.set(this.next(), item);

        return this;
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
     * Break the collection into chunks of the given size, preserving keys.
     */
    chunk(size: number): Collection<Collection<V>> {
        if (size <= 0) {
            return new Collection<Collection<V>>();
        }

        const entries: [Key, V][] = this.entries();
        const chunks: Collection<V>[] = [];

        for (let index: number = 0; index < entries.length; index += size) {
            chunks.push(new Collection<V>(new Map<Key, V>(entries.slice(index, index + size))));
        }

        return new Collection<Collection<V>>(chunks);
    }

    /**
     * Chunk the collection into groups for as long as the callback returns true.
     */
    chunkWhile(callback: (value: V, key: Key, chunk: Collection<V>) => boolean): Collection<Collection<V>> {
        const chunks: Collection<V>[] = [];
        let current: [Key, V][] = [];

        for (const [key, value] of this.items) {
            if (current.length > 0 && !this.truthy(callback(value, key, new Collection<V>(new Map<Key, V>(current))))) {
                chunks.push(new Collection<V>(new Map<Key, V>(current)));
                current = [];
            }

            current.push([key, value]);
        }

        if (current.length > 0) {
            chunks.push(new Collection<V>(new Map<Key, V>(current)));
        }

        return new Collection<Collection<V>>(chunks);
    }

    /**
     * Create a fresh collection holding the same entries.
     */
    collect(): Collection<V> {
        return new Collection<V>(this);
    }

    /**
     * Create a collection using the current values as keys and the given values as values.
     */
    combine<T>(values: ItemsInput<T>): Collection<T> {
        const keys: V[] = [...this.items.values()];
        const combined: T[] = this.valuesOf(values);

        if (keys.length !== combined.length) {
            throw new RangeError('The number of keys and values must be equal.');
        }

        const entries: [Key, T][] = keys.map((key: V, index: number): [Key, T] => [this.scalar(key), combined[index] as T]);

        return new Collection<T>(new Map<Key, T>(entries));
    }

    /**
     * Append the values of the given items onto the end of the collection.
     */
    concat(source: ItemsInput<V>): Collection<V> {
        const result: Collection<V> = new Collection<V>(this);

        for (const value of this.valuesOf(source)) {
            result.push(value);
        }

        return result;
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
     * Cross join the values with the given lists, returning all possible permutations.
     */
    crossJoin(...lists: ItemsInput<unknown>[]): Collection<unknown[]> {
        let results: unknown[][] = [...this.items.values()].map((value: V): unknown[] => [value]);

        for (const list of lists) {
            const values: unknown[] = this.valuesOf(list);
            const appended: unknown[][] = [];

            for (const result of results) {
                for (const value of values) {
                    appended.push([...result, value]);
                }
            }

            results = appended;
        }

        return new Collection<unknown[]>(results);
    }

    /**
     * Get the items whose values are not present in the given items.
     */
    diff(items: ItemsInput<V>): Collection<V> {
        return this.diffUsing(items, (a: V, b: V): number => this.looseEquals(a, b) ? 0 : 1);
    }

    /**
     * Get the items whose key-value pairs are not present in the given items.
     */
    diffAssoc(items: ItemsInput<V>): Collection<V> {
        const others: Map<Key, V> = new Map<Key, V>(this.parse(items));
        const entries: [Key, V][] = this.entries().filter(([key, value]: [Key, V]): boolean => !others.has(key) || !this.looseEquals(others.get(key), value));

        return new Collection<V>(new Map<Key, V>(entries));
    }

    /**
     * Get the items whose key-value pairs are not present in the given items, comparing keys with the callback.
     */
    diffAssocUsing(items: ItemsInput<V>, callback: Comparator<Key>): Collection<V> {
        const others: [Key, V][] = this.parse(items);
        const entries: [Key, V][] = this.entries().filter(([key, value]: [Key, V]): boolean => {
            const match: [Key, V] | undefined = others.find(([other]: [Key, V]): boolean => callback(key, other) === 0);

            return match === undefined || !this.looseEquals(match[1], value);
        });

        return new Collection<V>(new Map<Key, V>(entries));
    }

    /**
     * Get the items whose keys are not present in the given items.
     */
    diffKeys(items: ItemsInput<unknown>): Collection<V> {
        const others: Map<Key, unknown> = new Map<Key, unknown>(this.parse(items));

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key]: [Key, V]): boolean => !others.has(key))));
    }

    /**
     * Get the items whose keys are not present in the given items, comparing keys with the callback.
     */
    diffKeysUsing(items: ItemsInput<unknown>, callback: Comparator<Key>): Collection<V> {
        const others: [Key, unknown][] = this.parse(items);

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key]: [Key, V]): boolean => !others.some(([other]: [Key, unknown]): boolean => callback(key, other) === 0))));
    }

    /**
     * Get the items whose values are not present in the given items, comparing values with the callback.
     */
    diffUsing(items: ItemsInput<V>, callback: Comparator<V>): Collection<V> {
        const others: V[] = this.valuesOf(items);
        const entries: [Key, V][] = this.entries().filter(([, value]: [Key, V]): boolean => !others.some((other: V): boolean => callback(value, other) === 0));

        return new Collection<V>(new Map<Key, V>(entries));
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
     * Get the items for the given page number, sized by the given per-page count.
     */
    forPage(page: number, perPage: number): Collection<V> {
        return this.slice(Math.max(0, (page - 1) * perPage), perPage);
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
     * Get the item at the given key, storing and returning the given value when missing.
     */
    getOrPut(key: Key, value: V | (() => V)): V {
        const name: Key = this.key(key);

        if (!this.items.has(name)) {
            this.items.set(name, this.resolve(value));
        }

        return this.items.get(name) as V;
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
     * Get the items whose values are present in the given items.
     */
    intersect(items: ItemsInput<V>): Collection<V> {
        return this.intersectUsing(items, (a: V, b: V): number => this.looseEquals(a, b) ? 0 : 1);
    }

    /**
     * Get the items whose key-value pairs are present in the given items.
     */
    intersectAssoc(items: ItemsInput<V>): Collection<V> {
        const others: Map<Key, V> = new Map<Key, V>(this.parse(items));

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key, value]: [Key, V]): boolean => others.has(key) && this.looseEquals(others.get(key), value))));
    }

    /**
     * Get the items whose key-value pairs are present in the given items, comparing keys with the callback.
     */
    intersectAssocUsing(items: ItemsInput<V>, callback: Comparator<Key>): Collection<V> {
        const others: [Key, V][] = this.parse(items);

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key, value]: [Key, V]): boolean => others.some(([other, item]: [Key, V]): boolean => callback(key, other) === 0 && this.looseEquals(item, value)))));
    }

    /**
     * Get the items whose keys are present in the given items.
     */
    intersectByKeys(items: ItemsInput<unknown>): Collection<V> {
        const others: Map<Key, unknown> = new Map<Key, unknown>(this.parse(items));

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key]: [Key, V]): boolean => others.has(key))));
    }

    /**
     * Get the items whose values are present in the given items, comparing values with the callback.
     */
    intersectUsing(items: ItemsInput<V>, callback: Comparator<V>): Collection<V> {
        const others: V[] = this.valuesOf(items);

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([, value]: [Key, V]): boolean => others.some((other: V): boolean => callback(value, other) === 0))));
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
     * Merge the given items onto the collection, overwriting string keys and appending integer ones.
     */
    merge(items: ItemsInput<V>): Collection<V> {
        return new Collection<V>(this.merged([this.entries(), this.parse(items)]) as Map<Key, V>);
    }

    /**
     * Recursively merge the given items onto the collection.
     */
    mergeRecursive(items: ItemsInput<V>): Collection<V> {
        return new Collection<V>(this.recursive(new Map<Key, unknown>(this.entries()), this.parse(items), true) as Map<Key, V>);
    }

    /**
     * Repeat the values of the collection the given number of times.
     */
    multiply(times: number): Collection<V> {
        const multiplied: Collection<V> = new Collection<V>();

        for (let index: number = 0; index < times; index++) {
            multiplied.push(...this.items.values());
        }

        return multiplied;
    }

    /**
     * Get every n-th item, starting at the given offset.
     */
    nth(step: number, offset: number = 0): Collection<V> {
        const values: V[] = [];
        let position: number = 0;

        for (const value of this.slice(offset)) {
            if (position % step === 0) {
                values.push(value);
            }

            position++;
        }

        return new Collection<V>(values);
    }

    /**
     * Get only the items with the given keys.
     */
    only(...keys: Key[]): Collection<V> {
        const wanted: Key[] = keys.map((key: Key): Key => this.key(key));

        return new Collection<V>(new Map<Key, V>(this.entries().filter(([key]: [Key, V]): boolean => wanted.includes(key))));
    }

    /**
     * Pad the collection to the given size with the given value, prepending for a negative size.
     */
    pad(size: number, value: V): Collection<V> {
        const values: V[] = [...this.items.values()];
        const missing: number = Math.abs(size) - values.length;

        if (missing <= 0) {
            return new Collection<V>(values);
        }

        const padding: V[] = new Array<V>(missing).fill(value);

        return new Collection<V>(size < 0 ? [...padding, ...values] : [...values, ...padding]);
    }

    /**
     * Split the collection into the items that pass the truth test and those that fail it.
     */
    partition(key: Key | Callback<V>, operator?: unknown, value?: unknown): Collection<Collection<V>> {
        const predicate: Callback<V> = arguments.length === 1
            ? this.retriever(key)
            : this.condition(key as Key, operator, value, arguments.length);

        const passed: [Key, V][] = [];
        const failed: [Key, V][] = [];

        for (const [name, item] of this.items) {
            (this.truthy(predicate(item, name)) ? passed : failed).push([name, item]);
        }

        return new Collection<Collection<V>>([new Collection<V>(new Map<Key, V>(passed)), new Collection<V>(new Map<Key, V>(failed))]);
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
     * Remove and return the last item, or the last given number of items.
     */
    pop(): V | undefined;
    pop(count: number): Collection<V>;
    pop(count?: number): V | Collection<V> | undefined {
        const entries: [Key, V][] = this.entries();

        if (count === undefined) {
            const last: [Key, V] | undefined = entries[entries.length - 1];

            if (last === undefined) {
                return undefined;
            }

            this.items.delete(last[0]);

            return last[1];
        }

        const removed: [Key, V][] = entries.slice(Math.max(0, entries.length - count)).reverse();

        for (const [key] of removed) {
            this.items.delete(key);
        }

        return new Collection<V>(removed.map(([, value]: [Key, V]): V => value));
    }

    /**
     * Prepend an item to the front of the collection, optionally under the given key.
     */
    prepend(value: V, key?: Key): this {
        const entries: [Key, V][] = this.entries();

        this.items = new Map<Key, V>();

        if (key === undefined) {
            this.items.set(0, value);

            let index: number = 1;

            for (const [name, item] of entries) {
                this.items.set(typeof name === 'number' ? index++ : name, item);
            }

            return this;
        }

        this.items.set(this.key(key), value);

        for (const [name, item] of entries) {
            if (!this.items.has(name)) {
                this.items.set(name, item);
            }
        }

        return this;
    }

    /**
     * Remove and return the item at the given key.
     */
    pull(key: Key): V | undefined;
    pull<F>(key: Key, fallback: F | (() => F)): V | F;
    pull(key: Key, fallback?: unknown): unknown {
        const name: Key = this.key(key);

        if (!this.items.has(name)) {
            return this.resolve(fallback);
        }

        const value: V = this.items.get(name) as V;

        this.items.delete(name);

        return value;
    }

    /**
     * Append the given values onto the end of the collection.
     */
    push(...values: V[]): this {
        for (const value of values) {
            this.items.set(this.next(), value);
        }

        return this;
    }

    /**
     * Set the item at the given key.
     */
    put(key: Key, value: V): this {
        this.items.set(this.key(key), value);

        return this;
    }

    /**
     * Get one random item, or the given number of random items.
     */
    random(): V | undefined;
    random(count: number): Collection<V>;
    random(count?: number): V | Collection<V> | undefined {
        const values: V[] = [...this.items.values()];

        if (count === undefined) {
            return values.length === 0 ? undefined : values[Math.floor(Math.random() * values.length)];
        }

        if (count > values.length) {
            throw new RangeError(`You requested ${count} items, but there are only ${values.length} items available.`);
        }

        return new Collection<V>(this.shuffled(values).slice(0, count));
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
     * Replace the items at the keys of the given items.
     */
    replace(items: ItemsInput<V>): Collection<V> {
        const replaced: Map<Key, V> = new Map<Key, V>(this.entries());

        for (const [key, value] of this.parse(items)) {
            replaced.set(key, value);
        }

        return new Collection<V>(replaced);
    }

    /**
     * Recursively replace the items at the keys of the given items.
     */
    replaceRecursive(items: ItemsInput<V>): Collection<V> {
        return new Collection<V>(this.recursive(new Map<Key, unknown>(this.entries()), this.parse(items), false) as Map<Key, V>);
    }

    /**
     * Reverse the order of the items, preserving keys.
     */
    reverse(): Collection<V> {
        return new Collection<V>(new Map<Key, V>(this.entries().reverse()));
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
     * Remove and return the first item, or the first given number of items.
     */
    shift(): V | undefined;
    shift(count: number): Collection<V>;
    shift(count?: number): V | Collection<V> | undefined {
        const entries: [Key, V][] = this.entries();

        if (count === undefined) {
            const first: [Key, V] | undefined = entries[0];

            if (first === undefined) {
                return undefined;
            }

            this.items.delete(first[0]);

            return first[1];
        }

        const removed: [Key, V][] = entries.slice(0, Math.max(0, count));

        for (const [key] of removed) {
            this.items.delete(key);
        }

        return new Collection<V>(removed.map(([, value]: [Key, V]): V => value));
    }

    /**
     * Shuffle the items into a random order.
     */
    shuffle(): Collection<V> {
        return new Collection<V>(this.shuffled([...this.items.values()]));
    }

    /**
     * Skip the given number of items.
     */
    skip(count: number): Collection<V> {
        return this.slice(count);
    }

    /**
     * Skip items until the given value or callback matches.
     */
    skipUntil(value: V | Callback<V, boolean>): Collection<V> {
        return this.skipping(value, false);
    }

    /**
     * Skip items while the given value or callback matches.
     */
    skipWhile(value: V | Callback<V, boolean>): Collection<V> {
        return this.skipping(value, true);
    }

    /**
     * Get a slice of the items, preserving keys.
     */
    slice(offset: number, length?: number): Collection<V> {
        const entries: [Key, V][] = this.entries();
        const start: number = offset < 0 ? Math.max(0, entries.length + offset) : offset;

        if (length === undefined) {
            return new Collection<V>(new Map<Key, V>(entries.slice(start)));
        }

        const end: number = length < 0 ? entries.length + length : start + length;

        return new Collection<V>(new Map<Key, V>(entries.slice(start, Math.max(start, end))));
    }

    /**
     * Get a sliding window over the items of the given size, advanced by the given step.
     */
    sliding(size: number = 2, step: number = 1): Collection<Collection<V>> {
        const count: number = Math.floor((this.items.size - size) / step) + 1;
        const windows: Collection<V>[] = [];

        for (let index: number = 0; index < count; index++) {
            windows.push(this.slice(index * step, size));
        }

        return new Collection<Collection<V>>(windows);
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
     * Sort the items, preserving keys.
     */
    sort(callback?: Comparator<V>): Collection<V> {
        return this.sorted((a: [Key, V], b: [Key, V]): number => callback === undefined ? this.comparator(a[1], b[1]) : callback(a[1], b[1]));
    }

    /**
     * Sort the items by the given key, callback, or list of criteria.
     */
    sortBy(criteria: Criteria<V>, descending: boolean = false): Collection<V> {
        if (Array.isArray(criteria)) {
            const comparators: [Callback<V>, boolean][] = criteria.map(([target, direction]: [Key | Callback<V>, Direction]): [Callback<V>, boolean] => [this.retriever(target), direction === 'desc']);

            return this.sorted((a: [Key, V], b: [Key, V]): number => {
                for (const [retriever, reversed] of comparators) {
                    const result: number = this.comparator(retriever(a[1], a[0]), retriever(b[1], b[0]));

                    if (result !== 0) {
                        return reversed ? -result : result;
                    }
                }

                return 0;
            });
        }

        const retriever: Callback<V> = this.retriever(criteria);

        return this.sorted((a: [Key, V], b: [Key, V]): number => {
            const result: number = this.comparator(retriever(a[1], a[0]), retriever(b[1], b[0]));

            return descending ? -result : result;
        });
    }

    /**
     * Sort the items by the given key, callback, or list of criteria in descending order.
     */
    sortByDesc(criteria: Criteria<V>): Collection<V> {
        return this.sortBy(criteria, true);
    }

    /**
     * Sort the items in descending order, preserving keys.
     */
    sortDesc(): Collection<V> {
        return this.sorted((a: [Key, V], b: [Key, V]): number => -this.comparator(a[1], b[1]));
    }

    /**
     * Sort the items by their keys.
     */
    sortKeys(descending: boolean = false): Collection<V> {
        return this.sorted((a: [Key, V], b: [Key, V]): number => {
            const result: number = this.comparator(a[0], b[0]);

            return descending ? -result : result;
        });
    }

    /**
     * Sort the items by their keys in descending order.
     */
    sortKeysDesc(): Collection<V> {
        return this.sortKeys(true);
    }

    /**
     * Sort the items by their keys using the given comparator.
     */
    sortKeysUsing(callback: Comparator<Key>): Collection<V> {
        return this.sorted((a: [Key, V], b: [Key, V]): number => callback(a[0], b[0]));
    }

    /**
     * Remove and return a slice of the items, optionally replacing them, renumbering keys.
     */
    splice(offset: number, length?: number, replacement: ItemsInput<V> = []): Collection<V> {
        const values: V[] = [...this.items.values()];
        const count: number = length === undefined ? values.length - offset : length;
        const removed: V[] = values.splice(offset, count, ...this.valuesOf(replacement));

        this.items = new Map<Key, V>(values.map((value: V, index: number): [Key, V] => [index, value]));

        return new Collection<V>(removed);
    }

    /**
     * Split the items into the given number of groups.
     */
    split(groups: number): Collection<Collection<V>> {
        if (this.items.size === 0) {
            return new Collection<Collection<V>>();
        }

        const size: number = Math.floor(this.items.size / groups);
        const remaining: number = this.items.size % groups;
        const result: Collection<V>[] = [];
        let start: number = 0;

        for (let index: number = 0; index < groups; index++) {
            const length: number = index < remaining ? size + 1 : size;

            if (length > 0) {
                result.push(this.slice(start, length));
                start += length;
            }
        }

        return new Collection<Collection<V>>(result);
    }

    /**
     * Split the items into groups, filling each group before moving to the next.
     */
    splitIn(groups: number): Collection<Collection<V>> {
        return this.chunk(Math.ceil(this.items.size / groups));
    }

    /**
     * Take the given number of items, taking from the end for a negative limit.
     */
    take(limit: number): Collection<V> {
        return limit < 0 ? this.slice(limit, Math.abs(limit)) : this.slice(0, limit);
    }

    /**
     * Take items until the given value or callback matches.
     */
    takeUntil(value: V | Callback<V, boolean>): Collection<V> {
        return this.taking(value, false);
    }

    /**
     * Take items while the given value or callback matches.
     */
    takeWhile(value: V | Callback<V, boolean>): Collection<V> {
        return this.taking(value, true);
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
     * Add the items of the given input that are missing from the collection.
     */
    union(items: ItemsInput<V>): Collection<V> {
        const united: Map<Key, V> = new Map<Key, V>(this.entries());

        for (const [key, value] of this.parse(items)) {
            if (!united.has(key)) {
                united.set(key, value);
            }
        }

        return new Collection<V>(united);
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
     * Zip the collection together with the given lists, index by index.
     */
    zip(...lists: ItemsInput<unknown>[]): Collection<Collection<unknown>> {
        const sources: unknown[][] = [[...this.items.values()], ...lists.map((list: ItemsInput<unknown>): unknown[] => this.valuesOf(list))];
        const length: number = Math.max(...sources.map((source: unknown[]): number => source.length));
        const zipped: Collection<unknown>[] = [];

        for (let index: number = 0; index < length; index++) {
            zipped.push(new Collection<unknown>(sources.map((source: unknown[]): unknown => index < source.length ? source[index] : null)));
        }

        return new Collection<Collection<unknown>>(zipped);
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
     * Get the next integer key for an appended item.
     */
    protected next(items: Map<Key, unknown> = this.items): number {
        let next: number = 0;

        for (const key of items.keys()) {
            if (typeof key === 'number' && key >= next) {
                next = key + 1;
            }
        }

        return next;
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

    /**
     * Merge entry groups the way PHP does, renumbering integer keys and overwriting string ones.
     */
    protected merged(groups: [Key, unknown][][]): Map<Key, unknown> {
        const merged: Map<Key, unknown> = new Map<Key, unknown>();
        let index: number = 0;

        for (const group of groups) {
            for (const [key, value] of group) {
                if (typeof key === 'number') {
                    merged.set(index++, value);
                } else {
                    merged.set(key, value);
                }
            }
        }

        return merged;
    }

    /**
     * Merge or replace entries recursively, descending into nested items on both sides.
     */
    protected recursive(base: Map<Key, unknown>, additions: [Key, unknown][], combine: boolean): Map<Key, unknown> {
        const merged: Map<Key, unknown> = new Map<Key, unknown>(base);

        for (const [key, value] of additions) {
            if (combine && typeof key === 'number') {
                merged.set(this.next(merged), value);

                continue;
            }

            if (!merged.has(key)) {
                merged.set(key, value);

                continue;
            }

            const existing: unknown = merged.get(key);

            if (this.nested(existing) && this.nested(value)) {
                const nested: Map<Key, unknown> = this.recursive(new Map<Key, unknown>(this.parse(existing as ItemsInput<unknown>)), this.parse(value as ItemsInput<unknown>), combine);

                merged.set(key, this.shape(nested));
            } else if (combine) {
                // PHP's recursive merge keeps both sides of a duplicate string key by
                // collecting the scalar values into a single list rather than letting
                // the later value overwrite the earlier one.
                merged.set(key, [...this.spread(existing), ...this.spread(value)]);
            } else {
                merged.set(key, value);
            }
        }

        return merged;
    }

    /**
     * Render entries as an array for a list of keys and as a plain object otherwise.
     */
    protected shape(entries: Map<Key, unknown>): unknown {
        let index: number = 0;

        for (const key of entries.keys()) {
            if (key !== index++) {
                return Object.fromEntries(entries);
            }
        }

        return [...entries.values()];
    }

    /**
     * Sort the entries of the collection with the given comparator.
     */
    protected sorted(comparator: (a: [Key, V], b: [Key, V]) => number): Collection<V> {
        return new Collection<V>(new Map<Key, V>(this.entries().sort(comparator)));
    }

    /**
     * Shuffle the given values into a random order.
     */
    protected shuffled(values: V[]): V[] {
        const shuffled: V[] = [...values];

        for (let index: number = shuffled.length - 1; index > 0; index--) {
            const swap: number = Math.floor(Math.random() * (index + 1));

            [shuffled[index], shuffled[swap]] = [shuffled[swap] as V, shuffled[index] as V];
        }

        return shuffled;
    }

    /**
     * Skip items until, or for as long as, the given value or callback matches.
     */
    protected skipping(value: V | Callback<V, boolean>, matching: boolean): Collection<V> {
        const predicate: Callback<V, boolean> = this.equality(value, false);
        const entries: [Key, V][] = [];
        let skipping: boolean = true;

        for (const [key, item] of this.items) {
            if (skipping && this.truthy(predicate(item, key)) !== matching) {
                skipping = false;
            }

            if (!skipping) {
                entries.push([key, item]);
            }
        }

        return new Collection<V>(new Map<Key, V>(entries));
    }

    /**
     * Take items until, or for as long as, the given value or callback matches.
     */
    protected taking(value: V | Callback<V, boolean>, matching: boolean): Collection<V> {
        const predicate: Callback<V, boolean> = this.equality(value, false);
        const entries: [Key, V][] = [];

        for (const [key, item] of this.items) {
            if (this.truthy(predicate(item, key)) !== matching) {
                break;
            }

            entries.push([key, item]);
        }

        return new Collection<V>(new Map<Key, V>(entries));
    }
}
