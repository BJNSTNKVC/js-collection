import { describe, expectTypeOf, test } from 'vitest';
import { Collection, type Callback, type Comparator, type Criteria, type Direction, type ItemsInput, type Key, type Operator, type Primitive } from '../../src/main';

describe('Key', (): void => {
    test('accepts strings and numbers', (): void => {
        expectTypeOf<'name'>().toMatchTypeOf<Key>();
        expectTypeOf<0>().toMatchTypeOf<Key>();
        expectTypeOf<symbol>().not.toMatchTypeOf<Key>();
    });
});

describe('ItemsInput', (): void => {
    test('accepts every supported constructor input', (): void => {
        expectTypeOf<number[]>().toMatchTypeOf<ItemsInput<number>>();
        expectTypeOf<Map<Key, number>>().toMatchTypeOf<ItemsInput<number>>();
        expectTypeOf<Collection<number>>().toMatchTypeOf<ItemsInput<number>>();
        expectTypeOf<Record<string, number>>().toMatchTypeOf<ItemsInput<number>>();
        expectTypeOf<Set<number>>().toMatchTypeOf<ItemsInput<number>>();
        expectTypeOf<Generator<number>>().toMatchTypeOf<ItemsInput<number>>();
        expectTypeOf<null>().toMatchTypeOf<ItemsInput<number>>();
        expectTypeOf<undefined>().toMatchTypeOf<ItemsInput<number>>();
    });
});

describe('Operator', (): void => {
    test('accepts the comparison operators and rejects anything else', (): void => {
        expectTypeOf<'='>().toMatchTypeOf<Operator>();
        expectTypeOf<'>='>().toMatchTypeOf<Operator>();
        expectTypeOf<'!=='>().toMatchTypeOf<Operator>();
        expectTypeOf<'like'>().not.toMatchTypeOf<Operator>();
    });
});

describe('Primitive', (): void => {
    test('accepts the type names ensure understands', (): void => {
        expectTypeOf<'string'>().toMatchTypeOf<Primitive>();
        expectTypeOf<'array'>().toMatchTypeOf<Primitive>();
        expectTypeOf<'null'>().toMatchTypeOf<Primitive>();
        expectTypeOf<'record'>().not.toMatchTypeOf<Primitive>();
    });
});

describe('Callback', (): void => {
    test('carries the item type and returns the given result type', (): void => {
        expectTypeOf<Callback<number, boolean>>().toEqualTypeOf<(value: number, key: Key) => boolean>();
        expectTypeOf<Callback<number>>().returns.toEqualTypeOf<unknown>();
    });
});

describe('Comparator', (): void => {
    test('compares two values of the same type', (): void => {
        expectTypeOf<Comparator<number>>().toEqualTypeOf<(a: number, b: number) => number>();
    });
});

describe('Direction', (): void => {
    test('accepts only the two sort directions', (): void => {
        expectTypeOf<'asc'>().toMatchTypeOf<Direction>();
        expectTypeOf<'desc'>().toMatchTypeOf<Direction>();
        expectTypeOf<'up'>().not.toMatchTypeOf<Direction>();
    });
});

describe('Criteria', (): void => {
    test('accepts a key, a callback, or a list of key-direction pairs', (): void => {
        interface Product {
            name: string;
        }

        expectTypeOf<'name'>().toMatchTypeOf<Criteria<Product>>();
        expectTypeOf<Callback<Product>>().toMatchTypeOf<Criteria<Product>>();
        expectTypeOf<[Key, Direction][]>().toMatchTypeOf<Criteria<Product>>();
    });
});
