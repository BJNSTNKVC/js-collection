import { describe, expect, test } from 'vitest';
import { Collection, type Key } from '../../src/main';

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

describe('Collection.count', (): void => {
    test('counts the items', (): void => {
        expect(new Collection<number>([1, 2]).count()).toEqual(2);
        expect(new Collection<number>([]).count()).toEqual(0);
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

describe('Collection.map', (): void => {
    test('maps the items preserving keys', (): void => {
        expect(new Collection<number>({ a: 1, b: 2 }).map((value: number): number => value * 2).all()).toEqual({ a: 2, b: 4 });
    });

    test('passes the key to the callback', (): void => {
        expect(new Collection<number>({ a: 1 }).map((value: number, key: Key): string => `${String(key)}${value}`).all()).toEqual({ a: 'a1' });
    });
});

describe('Collection.put', (): void => {
    test('sets the item at the given key', (): void => {
        expect(new Collection<number>({ a: 1 }).put('b', 2).all()).toEqual({ a: 1, b: 2 });
        expect(new Collection<number>({ a: 1 }).put('a', 9).all()).toEqual({ a: 9 });
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
