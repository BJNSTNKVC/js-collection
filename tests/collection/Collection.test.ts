import { describe, expect, test } from 'vitest';
import { Collection, type Key } from '../../src/main';

interface Product {
    name: string;
    price: number;
    category: string;
    stock: number | null;
}

const products: Product[] = [
    { name: 'Desk', price: 200, category: 'office', stock: 6 },
    { name: 'Chair', price: 100, category: 'office', stock: null },
    { name: 'Door', price: 100, category: 'home', stock: 2 },
];

describe('Collection.constructor', (): void => {
    test('accepts an array as a zero-based list', (): void => {
        expect(new Collection<number>([1, 2, 3]).all()).toEqual([1, 2, 3]);
    });

    test('accepts a plain object as keyed entries', (): void => {
        expect(new Collection<number>({ a: 1, b: 2 }).all()).toEqual({ a: 1, b: 2 });
    });

    test('folds canonical integer keys of an object into numbers', (): void => {
        expect(new Collection<string>({ 0: 'a', 1: 'b' }).all()).toEqual(['a', 'b']);
        expect(new Collection<string>({ '0.5': 'a' }).keys().all()).toEqual(['0.5']);
    });

    test('accepts a Map, preserving its keys and order', (): void => {
        const map: Map<Key, number> = new Map<Key, number>([['b', 2], ['a', 1]]);

        expect(new Collection<number>(map).all()).toEqual({ b: 2, a: 1 });
    });

    test('accepts another collection', (): void => {
        expect(new Collection<number>(new Collection<number>({ a: 1 })).all()).toEqual({ a: 1 });
    });

    test('accepts any other iterable as a list of values', (): void => {
        function* counting(): Generator<number> {
            yield 1;
            yield 2;
        }

        expect(new Collection<number>(new Set<number>([1, 2, 2, 3])).all()).toEqual([1, 2, 3]);
        expect(new Collection<number>(counting()).all()).toEqual([1, 2]);
    });

    test('accepts null and undefined as an empty collection', (): void => {
        expect(new Collection<number>(null).all()).toEqual([]);
        expect(new Collection<number>(undefined).all()).toEqual([]);
        expect(new Collection<number>().all()).toEqual([]);
    });
});

describe('Collection.empty', (): void => {
    test('creates an empty collection', (): void => {
        expect(Collection.empty<number>().all()).toEqual([]);
    });
});

describe('Collection.fromJson', (): void => {
    test('creates a collection by decoding a JSON string', (): void => {
        expect(Collection.fromJson('[1,2,3]').all()).toEqual([1, 2, 3]);
        expect(Collection.fromJson('{"a":1}').all()).toEqual({ a: 1 });
    });
});

describe('Collection.make', (): void => {
    test('creates a collection from the given items', (): void => {
        expect(Collection.make<number>([1, 2]).all()).toEqual([1, 2]);
        expect(Collection.make().all()).toEqual([]);
    });
});

describe('Collection.range', (): void => {
    test('creates an inclusive ascending range', (): void => {
        expect(Collection.range(1, 4).all()).toEqual([1, 2, 3, 4]);
        expect(Collection.range(2, 2).all()).toEqual([2]);
    });

    test('creates an inclusive descending range', (): void => {
        expect(Collection.range(3, 1).all()).toEqual([3, 2, 1]);
    });
});

describe('Collection.times', (): void => {
    test('creates a collection of numbers when no callback is given', (): void => {
        expect(Collection.times(3).all()).toEqual([1, 2, 3]);
    });

    test('maps each number through the callback', (): void => {
        expect(Collection.times(3, (number: number): number => number * 2).all()).toEqual([2, 4, 6]);
    });

    test('creates an empty collection for a count below one', (): void => {
        expect(Collection.times(0).all()).toEqual([]);
        expect(Collection.times(-2, (number: number): number => number).all()).toEqual([]);
    });
});

describe('Collection.unwrap', (): void => {
    test('returns the underlying items of a collection', (): void => {
        expect(Collection.unwrap(new Collection<number>([1, 2]))).toEqual([1, 2]);
    });

    test('returns any other value as given', (): void => {
        expect(Collection.unwrap('value')).toEqual('value');
    });
});

describe('Collection.wrap', (): void => {
    test('rewraps a collection', (): void => {
        const collection: Collection<number> = new Collection<number>([1, 2]);

        expect(Collection.wrap(collection).all()).toEqual([1, 2]);
        expect(Collection.wrap(collection)).not.toBe(collection);
    });

    test('wraps null and undefined into an empty collection', (): void => {
        expect(Collection.wrap(null).all()).toEqual([]);
        expect(Collection.wrap(undefined).all()).toEqual([]);
    });

    test('wraps arrays, maps, and plain objects into their entries', (): void => {
        expect(Collection.wrap([1, 2]).all()).toEqual([1, 2]);
        expect(Collection.wrap(new Map<Key, number>([['a', 1]])).all()).toEqual({ a: 1 });
        expect(Collection.wrap({ a: 1 }).all()).toEqual({ a: 1 });
        expect(Collection.wrap(Object.create(null) as Record<string, unknown>).all()).toEqual([]);
    });

    test('wraps any other value as a single item', (): void => {
        const date: Date = new Date('2026-08-27T00:00:00.000Z');

        expect(Collection.wrap('value').all()).toEqual(['value']);
        expect(Collection.wrap(date).all()).toEqual([date]);
    });
});

describe('Collection.all', (): void => {
    test('returns an array for a list and an object otherwise', (): void => {
        expect(new Collection<number>([1, 2]).all()).toEqual([1, 2]);
        expect(new Collection<number>({ a: 1 }).all()).toEqual({ a: 1 });
        expect(new Collection<number>(new Map<Key, number>([[1, 'a' as unknown as number]])).all()).toEqual({ 1: 'a' });
    });
});

describe('Collection.collect', (): void => {
    test('creates a fresh collection with the same entries', (): void => {
        const collection: Collection<number> = new Collection<number>({ a: 1 });
        const collected: Collection<number> = collection.collect();

        expect(collected.all()).toEqual({ a: 1 });
        expect(collected).not.toBe(collection);
    });
});

describe('Collection.count', (): void => {
    test('counts the items', (): void => {
        expect(new Collection<number>([1, 2]).count()).toEqual(2);
        expect(new Collection<number>([]).count()).toEqual(0);
    });
});

describe('Collection.each', (): void => {
    test('iterates over every item with its key', (): void => {
        const seen: [Key, number][] = [];

        new Collection<number>({ a: 1, b: 2 }).each((value: number, key: Key): void => void seen.push([key, value]));

        expect(seen).toEqual([['a', 1], ['b', 2]]);
    });

    test('stops iterating once the callback returns false', (): void => {
        const seen: number[] = [];

        new Collection<number>([1, 2, 3]).each((value: number): unknown => {
            seen.push(value);

            return value === 1 ? false : undefined;
        });

        expect(seen).toEqual([1]);
    });
});

describe('Collection.eachSpread', (): void => {
    test('spreads each nested item into the callback arguments', (): void => {
        const seen: unknown[][] = [];

        new Collection<[string, number]>([['John', 30], ['Jane', 28]]).eachSpread((...args: unknown[]): void => void seen.push(args));

        expect(seen).toEqual([['John', 30, 0], ['Jane', 28, 1]]);
    });
});

describe('Collection.except', (): void => {
    test('returns all items except those with the given keys', (): void => {
        expect(new Collection<number>({ a: 1, b: 2, c: 3 }).except('a', 'c').all()).toEqual({ b: 2 });
        expect(new Collection<number>([1, 2, 3]).except('1').all()).toEqual({ 0: 1, 2: 3 });
    });
});

describe('Collection.filter', (): void => {
    test('keeps the items passing the callback, preserving keys', (): void => {
        expect(new Collection<number>([1, 2, 3]).filter((value: number): boolean => value > 1).all()).toEqual({ 1: 2, 2: 3 });
    });

    test('keeps the truthy items when no callback is given', (): void => {
        expect(new Collection<unknown>([1, null, 0, 'a', '']).filter().values().all()).toEqual([1, 'a']);
    });
});

describe('Collection.first', (): void => {
    test('returns the first item', (): void => {
        expect(new Collection<number>([1, 2]).first()).toEqual(1);
        expect(new Collection<number>([]).first()).toBeUndefined();
    });

    test('returns the first item passing the callback', (): void => {
        expect(new Collection<number>([1, 2, 3]).first((value: number): boolean => value > 1)).toEqual(2);
    });

    test('falls back when nothing matches', (): void => {
        expect(new Collection<number>([1]).first((value: number): boolean => value > 1, 0)).toEqual(0);
        expect(new Collection<number>([1]).first(undefined, 0)).toEqual(1);
        expect(new Collection<number>([]).first(undefined, (): number => 9)).toEqual(9);
    });
});

describe('Collection.forget', (): void => {
    test('removes the items with the given keys', (): void => {
        expect(new Collection<number>({ a: 1, b: 2, c: 3 }).forget('a', 'c').all()).toEqual({ b: 2 });
        expect(new Collection<number>([1, 2]).forget('0').all()).toEqual({ 1: 2 });
    });
});

describe('Collection.get', (): void => {
    test('returns the item at the given key', (): void => {
        expect(new Collection<number>({ a: 1 }).get('a')).toEqual(1);
        expect(new Collection<number>([1, 2]).get('1')).toEqual(2);
        expect(new Collection<number>({ a: 1 }).get('b')).toBeUndefined();
    });

    test('falls back when the key is missing', (): void => {
        expect(new Collection<number>({ a: 1 }).get('b', 0)).toEqual(0);
        expect(new Collection<number>({ a: 1 }).get('b', (): number => 9)).toEqual(9);
    });
});

describe('Collection.has', (): void => {
    test('determines whether every given key is present', (): void => {
        const collection: Collection<number> = new Collection<number>({ a: 1, b: 2 });

        expect(collection.has('a', 'b')).toEqual(true);
        expect(collection.has('a', 'c')).toEqual(false);
    });
});

describe('Collection.hasAny', (): void => {
    test('determines whether any given key is present', (): void => {
        const collection: Collection<number> = new Collection<number>({ a: 1 });

        expect(collection.hasAny('a', 'c')).toEqual(true);
        expect(collection.hasAny('b', 'c')).toEqual(false);
    });
});

describe('Collection.isEmpty', (): void => {
    test('determines whether the collection is empty', (): void => {
        expect(new Collection<number>([]).isEmpty()).toEqual(true);
        expect(new Collection<number>([1]).isEmpty()).toEqual(false);
    });
});

describe('Collection.isNotEmpty', (): void => {
    test('determines whether the collection is not empty', (): void => {
        expect(new Collection<number>([1]).isNotEmpty()).toEqual(true);
        expect(new Collection<number>([]).isNotEmpty()).toEqual(false);
    });
});

describe('Collection.keys', (): void => {
    test('returns the keys of the collection', (): void => {
        expect(new Collection<number>({ a: 1, b: 2 }).keys().all()).toEqual(['a', 'b']);
        expect(new Collection<number>([1, 2]).keys().all()).toEqual([0, 1]);
    });
});

describe('Collection.last', (): void => {
    test('returns the last item', (): void => {
        expect(new Collection<number>([1, 2]).last()).toEqual(2);
        expect(new Collection<number>([]).last()).toBeUndefined();
    });

    test('returns the last item passing the callback', (): void => {
        expect(new Collection<number>([1, 2, 3]).last((value: number): boolean => value < 3)).toEqual(2);
    });

    test('falls back when nothing matches', (): void => {
        expect(new Collection<number>([1]).last((value: number): boolean => value > 1, 0)).toEqual(0);
        expect(new Collection<number>([]).last(undefined, (): number => 9)).toEqual(9);
    });
});

describe('Collection.map', (): void => {
    test('maps the items preserving keys', (): void => {
        expect(new Collection<number>({ a: 1, b: 2 }).map((value: number): number => value * 2).all()).toEqual({ a: 2, b: 4 });
    });

    test('passes the key to the callback', (): void => {
        expect(new Collection<number>({ a: 1 }).map((value: number, key: Key): string => `${String(key)}${value}`).all()).toEqual({ a: 'a1' });
    });
});

describe('Collection.mapInto', (): void => {
    class Wrapper {
        /**
         * The value the wrapper was built from.
         */
        value: unknown;

        /**
         * The key the value was held under.
         */
        key: Key;

        /**
         * Create a new wrapper around the given entry.
         */
        constructor(value: unknown, key: Key) {
            this.value = value;
            this.key = key;
        }
    }

    test('maps the items into instances of the given class', (): void => {
        const mapped: Collection<Wrapper> = new Collection<number>({ a: 1 }).mapInto(Wrapper);

        expect(mapped.get('a')).toBeInstanceOf(Wrapper);
        expect(mapped.get('a')?.value).toEqual(1);
        expect(mapped.get('a')?.key).toEqual('a');
    });
});

describe('Collection.mapSpread', (): void => {
    test('spreads each nested item into the callback arguments', (): void => {
        expect(new Collection<[number, number]>([[1, 2], [3, 4]]).mapSpread((a: unknown, b: unknown): number => (a as number) + (b as number)).all()).toEqual([3, 7]);
    });

    test('passes an item holding nothing nested straight through', (): void => {
        expect(new Collection<number>([1]).mapSpread((a: unknown): unknown => a).all()).toEqual([1]);
    });
});

describe('Collection.mapToDictionary', (): void => {
    test('groups the mapped values of each returned key into an array', (): void => {
        expect(new Collection<Product>(products).mapToDictionary((product: Product): [Key, string] => [product.category, product.name]).all()).toEqual({
            office: ['Desk', 'Chair'],
            home  : ['Door'],
        });
    });
});

describe('Collection.mapToGroups', (): void => {
    test('groups the mapped values of each returned key into a collection', (): void => {
        const groups: Collection<Collection<string>> = new Collection<Product>(products).mapToGroups((product: Product): [Key, string] => [product.category, product.name]);

        expect(groups.get('office')?.all()).toEqual(['Desk', 'Chair']);
    });
});

describe('Collection.mapWithKeys', (): void => {
    test('keys the mapped values by the returned key', (): void => {
        expect(new Collection<Product>(products).mapWithKeys((product: Product): [Key, number] => [product.name, product.price]).all()).toEqual({
            Desk : 200,
            Chair: 100,
            Door : 100,
        });
    });

    test('folds canonical integer keys into numbers', (): void => {
        expect(new Collection<number>([1, 2]).mapWithKeys((value: number): [Key, number] => [`${value}`, value]).all()).toEqual({ 1: 1, 2: 2 });
    });
});

describe('Collection.only', (): void => {
    test('returns only the items with the given keys', (): void => {
        expect(new Collection<number>({ a: 1, b: 2, c: 3 }).only('a', 'c').all()).toEqual({ a: 1, c: 3 });
        expect(new Collection<number>([1, 2, 3]).only('0', 1).all()).toEqual([1, 2]);
    });
});

describe('Collection.pluck', (): void => {
    test('returns the values of the given key', (): void => {
        expect(new Collection<Product>(products).pluck('name').all()).toEqual(['Desk', 'Chair', 'Door']);
    });

    test('keys the plucked values by another key', (): void => {
        expect(new Collection<Product>(products).pluck('price', 'name').all()).toEqual({ Desk: 200, Chair: 100, Door: 100 });
    });

    test('reads through dot notation and wildcards', (): void => {
        const orders: Collection<unknown> = new Collection<unknown>([{ customer: { name: 'John' }, lines: [{ sku: 'a' }, { sku: 'b' }] }]);

        expect(orders.pluck('customer.name').all()).toEqual(['John']);
        expect(orders.pluck('lines.*.sku').all()).toEqual([['a', 'b']]);
    });
});

describe('Collection.put', (): void => {
    test('sets the item at the given key', (): void => {
        expect(new Collection<number>({ a: 1 }).put('b', 2).all()).toEqual({ a: 1, b: 2 });
        expect(new Collection<number>({ a: 1 }).put('a', 9).all()).toEqual({ a: 9 });
    });
});

describe('Collection.reduce', (): void => {
    test('reduces the collection to a single value', (): void => {
        expect(new Collection<number>([1, 2, 3]).reduce((carry: number, value: number): number => carry + value, 0)).toEqual(6);
    });

    test('passes the key to the callback', (): void => {
        expect(new Collection<number>({ a: 1 }).reduce((carry: string, value: number, key: Key): string => `${carry}${String(key)}${value}`, '')).toEqual('a1');
    });
});

describe('Collection.reduceSpread', (): void => {
    test('reduces the collection to multiple values', (): void => {
        expect(new Collection<number>([1, 2, 3]).reduceSpread((carry: unknown[], value: number): unknown[] => [(carry[0] as number) + value, (carry[1] as number) * value], 0, 1)).toEqual([6, 6]);
    });
});

describe('Collection.reject', (): void => {
    test('drops the items passing the callback', (): void => {
        expect(new Collection<number>([1, 2, 3]).reject((value: number): boolean => value > 1).all()).toEqual([1]);
    });

    test('drops the truthy items when no callback is given', (): void => {
        expect(new Collection<unknown>([1, null, 0, 'a']).reject().values().all()).toEqual([null, 0]);
    });
});

describe('Collection.select', (): void => {
    test('reduces each item to the given keys', (): void => {
        expect(new Collection<Product>(products).select('name', 'price').all()).toEqual([
            { name: 'Desk', price: 200 },
            { name: 'Chair', price: 100 },
            { name: 'Door', price: 100 },
        ]);
    });

    test('skips the keys an item does not carry', (): void => {
        expect(new Collection<unknown>([{ name: 'Desk' }]).select('name', 'missing').all()).toEqual([{ name: 'Desk' }]);
    });
});

describe('Collection.transform', (): void => {
    test('maps the items in place', (): void => {
        const collection: Collection<number> = new Collection<number>({ a: 1, b: 2 });

        expect(collection.transform((value: number): number => value * 2)).toBe(collection);
        expect(collection.all()).toEqual({ a: 2, b: 4 });
    });
});

describe('Collection.values', (): void => {
    test('renumbers the keys', (): void => {
        expect(new Collection<number>({ a: 1, b: 2 }).values().all()).toEqual([1, 2]);
    });
});

describe('Collection[Symbol.iterator]', (): void => {
    test('iterates over the values', (): void => {
        expect([...new Collection<number>({ a: 1, b: 2 })]).toEqual([1, 2]);
    });

    test('works with for-of loops', (): void => {
        const seen: number[] = [];

        for (const value of new Collection<number>([1, 2])) {
            seen.push(value);
        }

        expect(seen).toEqual([1, 2]);
    });
});
