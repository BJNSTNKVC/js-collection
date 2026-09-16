import { describe, expect, expectTypeOf, test } from 'vitest';
import { Collection, collect, type Key } from '../../src/main';

describe('collect', (): void => {
    test('creates a collection from the given items', (): void => {
        const collection: Collection<number> = collect<number>([1, 2, 3]);

        expect(collection).toBeInstanceOf(Collection);
        expect(collection.all()).toEqual([1, 2, 3]);
    });

    test('creates an empty collection without items', (): void => {
        expect(collect().all()).toEqual([]);
        expect(collect(null).all()).toEqual([]);
        expect(collect(undefined).all()).toEqual([]);
    });

    test('accepts every supported input', (): void => {
        expect(collect<number>({ a: 1 }).all()).toEqual({ a: 1 });
        expect(collect<number>(new Map<Key, number>([['b', 2]])).all()).toEqual({ b: 2 });
        expect(collect<number>(new Set<number>([1, 1, 2])).all()).toEqual([1, 2]);
        expect(collect<number>(new Collection<number>({ a: 1 })).all()).toEqual({ a: 1 });
    });

    test('creates a fresh collection when given one', (): void => {
        const collection: Collection<number> = new Collection<number>([1]);

        expect(collect<number>(collection)).not.toBe(collection);
    });

    test('infers the item type from the given items', (): void => {
        expectTypeOf(collect([1, 2])).toEqualTypeOf<Collection<number>>();
        expectTypeOf(collect()).toEqualTypeOf<Collection<unknown>>();
    });
});
