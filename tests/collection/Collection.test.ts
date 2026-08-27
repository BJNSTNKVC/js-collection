import { describe, expect, test } from 'vitest';
import { Collection, ItemNotFoundException, MultipleItemsFoundException, type Key } from '../../src/main';

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

describe('Collection.after', (): void => {
    test('returns the item following the matched value', (): void => {
        expect(new Collection<number>([1, 2, 3]).after(2)).toEqual(3);
    });

    test('returns undefined when the match is last or absent', (): void => {
        expect(new Collection<number>([1, 2, 3]).after(3)).toBeUndefined();
        expect(new Collection<number>([1, 2, 3]).after(9)).toBeUndefined();
    });

    test('accepts a callback and a strict comparison', (): void => {
        expect(new Collection<number>([1, 2, 3]).after((value: number): boolean => value > 1)).toEqual(3);
        expect(new Collection<unknown>([1, '2', 3]).after(2)).toEqual(3);
        expect(new Collection<unknown>([1, '2', 3]).after(2, true)).toBeUndefined();
    });
});

describe('Collection.all', (): void => {
    test('returns an array for a list and an object otherwise', (): void => {
        expect(new Collection<number>([1, 2]).all()).toEqual([1, 2]);
        expect(new Collection<number>({ a: 1 }).all()).toEqual({ a: 1 });
        expect(new Collection<number>(new Map<Key, number>([[1, 'a' as unknown as number]])).all()).toEqual({ 1: 'a' });
    });
});

describe('Collection.before', (): void => {
    test('returns the item preceding the matched value', (): void => {
        expect(new Collection<number>([1, 2, 3]).before(2)).toEqual(1);
    });

    test('returns undefined when the match is first or absent', (): void => {
        expect(new Collection<number>([1, 2, 3]).before(1)).toBeUndefined();
        expect(new Collection<number>([1, 2, 3]).before(9)).toBeUndefined();
    });

    test('accepts a callback and a strict comparison', (): void => {
        expect(new Collection<number>([1, 2, 3]).before((value: number): boolean => value > 2)).toEqual(2);
        expect(new Collection<unknown>([1, '2', 3]).before(2, true)).toBeUndefined();
    });
});

describe('Collection.chunk', (): void => {
    test('breaks the collection into chunks preserving keys', (): void => {
        const chunks: Collection<Collection<number>> = new Collection<number>([1, 2, 3, 4, 5]).chunk(2);

        expect(chunks.count()).toEqual(3);
        expect(chunks.get(0)?.all()).toEqual([1, 2]);
        expect(chunks.get(2)?.all()).toEqual({ 4: 5 });
    });

    test('returns an empty collection for a size below one', (): void => {
        expect(new Collection<number>([1, 2]).chunk(0).all()).toEqual([]);
    });
});

describe('Collection.chunkWhile', (): void => {
    test('chunks while the callback holds', (): void => {
        const chunks: Collection<Collection<number>> = new Collection<number>([1, 1, 2, 2, 3]).chunkWhile((value: number, _key: Key, chunk: Collection<number>): boolean => value === chunk.last());

        expect(chunks.map((chunk: Collection<number>): unknown => chunk.values().all()).all()).toEqual([[1, 1], [2, 2], [3]]);
    });

    test('returns an empty collection when there is nothing to chunk', (): void => {
        expect(new Collection<number>([]).chunkWhile((): boolean => true).all()).toEqual([]);
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

describe('Collection.contains', (): void => {
    test('matches a value loosely', (): void => {
        expect(new Collection<unknown>([1, 2]).contains('2')).toEqual(true);
        expect(new Collection<unknown>([1, 2]).contains(3)).toEqual(false);
    });

    test('matches a callback', (): void => {
        expect(new Collection<number>([1, 2]).contains((value: number): boolean => value > 1)).toEqual(true);
    });

    test('matches a key-value pair and a key-operator-value condition', (): void => {
        const collection: Collection<Product> = new Collection<Product>(products);

        expect(collection.contains('name', 'Desk')).toEqual(true);
        expect(collection.contains('name', 'Sofa')).toEqual(false);
        expect(collection.contains('price', '>', 150)).toEqual(true);
        expect(collection.contains('price', '>', 500)).toEqual(false);
    });
});

describe('Collection.containsOneItem', (): void => {
    test('determines whether exactly one item is held', (): void => {
        expect(new Collection<number>([1]).containsOneItem()).toEqual(true);
        expect(new Collection<number>([1, 2]).containsOneItem()).toEqual(false);
        expect(new Collection<number>([]).containsOneItem()).toEqual(false);
    });

    test('determines whether exactly one item passes the callback', (): void => {
        expect(new Collection<number>([1, 2, 3]).containsOneItem((value: number): boolean => value > 2)).toEqual(true);
        expect(new Collection<number>([1, 2, 3]).containsOneItem((value: number): boolean => value > 1)).toEqual(false);
    });
});

describe('Collection.containsStrict', (): void => {
    test('matches a value strictly', (): void => {
        expect(new Collection<unknown>([1, 2]).containsStrict(2)).toEqual(true);
        expect(new Collection<unknown>([1, '2']).containsStrict(2)).toEqual(false);
    });

    test('matches a key-value pair strictly', (): void => {
        const collection: Collection<Product> = new Collection<Product>(products);

        expect(collection.containsStrict('price', 200)).toEqual(true);
        expect(collection.containsStrict('price', '200')).toEqual(false);
    });

    test('matches a callback', (): void => {
        expect(new Collection<number>([1, 2]).containsStrict((value: number): boolean => value === 2)).toEqual(true);
    });
});

describe('Collection.count', (): void => {
    test('counts the items', (): void => {
        expect(new Collection<number>([1, 2]).count()).toEqual(2);
        expect(new Collection<number>([]).count()).toEqual(0);
    });
});

describe('Collection.doesntContain', (): void => {
    test('negates every arity of contains', (): void => {
        const collection: Collection<Product> = new Collection<Product>(products);

        expect(new Collection<number>([1, 2]).doesntContain(3)).toEqual(true);
        expect(collection.doesntContain('name', 'Sofa')).toEqual(true);
        expect(collection.doesntContain('price', '>', 500)).toEqual(true);
        expect(collection.doesntContain('price', '>', 150)).toEqual(false);
    });
});

describe('Collection.doesntContainStrict', (): void => {
    test('negates every arity of containsStrict', (): void => {
        expect(new Collection<unknown>([1, '2']).doesntContainStrict(2)).toEqual(true);
        expect(new Collection<Product>(products).doesntContainStrict('price', '200')).toEqual(true);
        expect(new Collection<Product>(products).doesntContainStrict('price', 200)).toEqual(false);
    });
});

describe('Collection.duplicates', (): void => {
    test('returns the repeated values keyed by their later occurrence', (): void => {
        expect(new Collection<string>(['a', 'b', 'a', 'b', 'c']).duplicates().all()).toEqual({ 2: 'a', 3: 'b' });
    });

    test('compares the retrieved values loosely by default', (): void => {
        expect(new Collection<unknown>([1, '1']).duplicates().all()).toEqual({ 1: '1' });
        expect(new Collection<Product>(products).duplicates('price').all()).toEqual({ 2: 100 });
    });
});

describe('Collection.duplicatesStrict', (): void => {
    test('compares the retrieved values strictly', (): void => {
        expect(new Collection<unknown>([1, '1', 1]).duplicatesStrict().all()).toEqual({ 2: 1 });
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

describe('Collection.ensure', (): void => {
    class Person {
    }

    test('passes when every item matches a primitive type', (): void => {
        const collection: Collection<number> = new Collection<number>([1, 2]);

        expect(collection.ensure('number')).toBe(collection);
        expect(new Collection<unknown>([1, 'a']).ensure(['number', 'string'])).toBeInstanceOf(Collection);
        expect(new Collection<unknown>([null, [1]]).ensure(['null', 'array'])).toBeInstanceOf(Collection);
    });

    test('passes when every item is an instance of the given class', (): void => {
        expect(new Collection<Person>([new Person()]).ensure(Person)).toBeInstanceOf(Collection);
    });

    test('throws on the first item of another type', (): void => {
        expect((): unknown => new Collection<unknown>([1, 'a']).ensure('number')).toThrow('Collection should only include [number] items, but [string] found at key [1].');
        expect((): unknown => new Collection<unknown>([{}]).ensure(Person)).toThrow(TypeError);
    });
});

describe('Collection.every', (): void => {
    test('determines whether every item passes the callback', (): void => {
        expect(new Collection<number>([2, 4]).every((value: number): boolean => value % 2 === 0)).toEqual(true);
        expect(new Collection<number>([2, 3]).every((value: number): boolean => value % 2 === 0)).toEqual(false);
        expect(new Collection<number>([]).every((value: number): boolean => value > 0)).toEqual(true);
    });

    test('determines whether every item holds a truthy value at the key', (): void => {
        expect(new Collection<Product>(products).every('name')).toEqual(true);
        expect(new Collection<Product>(products).every('stock')).toEqual(false);
    });

    test('determines whether every item matches the condition', (): void => {
        expect(new Collection<Product>(products).every('price', '>=', 100)).toEqual(true);
        expect(new Collection<Product>(products).every('category', 'office')).toEqual(false);
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

describe('Collection.firstOrFail', (): void => {
    test('returns the first item, optionally matching a callback or condition', (): void => {
        const collection: Collection<Product> = new Collection<Product>(products);

        expect(collection.firstOrFail().name).toEqual('Desk');
        expect(collection.firstOrFail((product: Product): boolean => product.price === 100).name).toEqual('Chair');
        expect(collection.firstOrFail('category', 'home').name).toEqual('Door');
        expect(collection.firstOrFail('price', '<', 150).name).toEqual('Chair');
    });

    test('throws when nothing matches', (): void => {
        expect((): unknown => new Collection<number>([]).firstOrFail()).toThrow(ItemNotFoundException);
        expect((): unknown => new Collection<Product>(products).firstOrFail('name', 'Sofa')).toThrow('Item not found.');
    });
});

describe('Collection.firstWhere', (): void => {
    test('returns the first item matching the condition', (): void => {
        const collection: Collection<Product> = new Collection<Product>(products);

        expect(collection.firstWhere('category', 'home')?.name).toEqual('Door');
        expect(collection.firstWhere('price', '>', 150)?.name).toEqual('Desk');
        expect(collection.firstWhere('name', 'Sofa')).toBeUndefined();
    });
});

describe('Collection.flip', (): void => {
    test('swaps keys with values', (): void => {
        expect(new Collection<string>({ name: 'John' }).flip().all()).toEqual({ John: 'name' });
        expect(new Collection<string>(['a', 'b']).flip().all()).toEqual({ a: 0, b: 1 });
    });

    test('throws for values that cannot be keys', (): void => {
        expect((): unknown => new Collection<unknown>([{}]).flip()).toThrow('Collection values must be strings or numbers to flip, [object] found at key [0].');
    });
});

describe('Collection.forget', (): void => {
    test('removes the items with the given keys', (): void => {
        expect(new Collection<number>({ a: 1, b: 2, c: 3 }).forget('a', 'c').all()).toEqual({ b: 2 });
        expect(new Collection<number>([1, 2]).forget('0').all()).toEqual({ 1: 2 });
    });
});

describe('Collection.forPage', (): void => {
    test('returns the items of the given page', (): void => {
        const collection: Collection<number> = new Collection<number>([1, 2, 3, 4, 5]);

        expect(collection.forPage(1, 2).values().all()).toEqual([1, 2]);
        expect(collection.forPage(3, 2).values().all()).toEqual([5]);
        expect(collection.forPage(0, 2).values().all()).toEqual([1, 2]);
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

describe('Collection.nth', (): void => {
    test('returns every n-th item', (): void => {
        expect(new Collection<string>(['a', 'b', 'c', 'd', 'e', 'f']).nth(4).all()).toEqual(['a', 'e']);
    });

    test('starts at the given offset', (): void => {
        expect(new Collection<string>(['a', 'b', 'c', 'd', 'e', 'f']).nth(4, 1).all()).toEqual(['b', 'f']);
    });
});

describe('Collection.only', (): void => {
    test('returns only the items with the given keys', (): void => {
        expect(new Collection<number>({ a: 1, b: 2, c: 3 }).only('a', 'c').all()).toEqual({ a: 1, c: 3 });
        expect(new Collection<number>([1, 2, 3]).only('0', 1).all()).toEqual([1, 2]);
    });
});

describe('Collection.partition', (): void => {
    test('splits the items by a callback', (): void => {
        const groups: Collection<Collection<number>> = new Collection<number>([1, 2, 3, 4]).partition((value: number): boolean => value % 2 === 0);

        expect(groups.get(0)?.values().all()).toEqual([2, 4]);
        expect(groups.get(1)?.values().all()).toEqual([1, 3]);
    });

    test('splits the items by a truthy key', (): void => {
        const groups: Collection<Collection<Product>> = new Collection<Product>(products).partition('stock');

        expect(groups.get(0)?.pluck('name').all()).toEqual(['Desk', 'Door']);
        expect(groups.get(1)?.pluck('name').all()).toEqual(['Chair']);
    });

    test('splits the items by a condition', (): void => {
        const groups: Collection<Collection<Product>> = new Collection<Product>(products).partition('price', '>', 150);

        expect(groups.get(0)?.pluck('name').all()).toEqual(['Desk']);
        expect(groups.get(1)?.count()).toEqual(2);
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

describe('Collection.random', (): void => {
    test('returns one random item', (): void => {
        expect([1, 2, 3]).toContain(new Collection<number>([1, 2, 3]).random());
        expect(new Collection<number>([]).random()).toBeUndefined();
    });

    test('returns the given number of random items', (): void => {
        const random: Collection<number> = new Collection<number>([1, 2, 3]).random(2);

        expect(random.count()).toEqual(2);
        expect(random.every((value: number): boolean => [1, 2, 3].includes(value))).toEqual(true);
        expect(new Collection<number>([1, 2, 3]).random(3).sort().values().all()).toEqual([1, 2, 3]);
    });

    test('throws when more items are requested than are available', (): void => {
        expect((): unknown => new Collection<number>([1]).random(2)).toThrow('You requested 2 items, but there are only 1 items available.');
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

describe('Collection.reverse', (): void => {
    test('reverses the items preserving keys', (): void => {
        expect(new Collection<number>([1, 2, 3]).reverse().all()).toEqual({ 2: 3, 1: 2, 0: 1 });
        expect(new Collection<number>({ a: 1, b: 2 }).reverse().all()).toEqual({ b: 2, a: 1 });
    });
});

describe('Collection.search', (): void => {
    test('returns the key of the first match', (): void => {
        expect(new Collection<number>([1, 2, 3]).search(2)).toEqual(1);
        expect(new Collection<number>({ a: 1 }).search(1)).toEqual('a');
    });

    test('returns false when nothing matches', (): void => {
        expect(new Collection<number>([1]).search(9)).toEqual(false);
    });

    test('accepts a callback and a strict comparison', (): void => {
        expect(new Collection<number>([1, 2, 3]).search((value: number): boolean => value > 1)).toEqual(1);
        expect(new Collection<unknown>(['2']).search(2)).toEqual(0);
        expect(new Collection<unknown>(['2']).search(2, true)).toEqual(false);
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

describe('Collection.shuffle', (): void => {
    test('returns the same values in some order', (): void => {
        expect(new Collection<number>([1, 2, 3, 4]).shuffle().sort().values().all()).toEqual([1, 2, 3, 4]);
        expect(new Collection<number>([]).shuffle().all()).toEqual([]);
    });
});

describe('Collection.skip', (): void => {
    test('skips the given number of items', (): void => {
        expect(new Collection<number>([1, 2, 3]).skip(2).values().all()).toEqual([3]);
    });
});

describe('Collection.skipUntil', (): void => {
    test('skips items until the value matches', (): void => {
        expect(new Collection<number>([1, 2, 3, 1]).skipUntil(3).values().all()).toEqual([3, 1]);
    });

    test('skips items until the callback matches', (): void => {
        expect(new Collection<number>([1, 2, 3]).skipUntil((value: number): boolean => value > 1).values().all()).toEqual([2, 3]);
        expect(new Collection<number>([1, 2]).skipUntil(9).all()).toEqual([]);
    });
});

describe('Collection.skipWhile', (): void => {
    test('skips items while the callback matches', (): void => {
        expect(new Collection<number>([1, 2, 3, 1]).skipWhile((value: number): boolean => value < 3).values().all()).toEqual([3, 1]);
        expect(new Collection<number>([1, 1]).skipWhile(1).all()).toEqual([]);
    });
});

describe('Collection.slice', (): void => {
    test('slices from the given offset preserving keys', (): void => {
        expect(new Collection<number>([1, 2, 3, 4]).slice(2).all()).toEqual({ 2: 3, 3: 4 });
        expect(new Collection<number>([1, 2, 3, 4]).slice(-2).values().all()).toEqual([3, 4]);
        expect(new Collection<number>([1, 2]).slice(-9).values().all()).toEqual([1, 2]);
    });

    test('slices the given length', (): void => {
        expect(new Collection<number>([1, 2, 3, 4]).slice(1, 2).values().all()).toEqual([2, 3]);
        expect(new Collection<number>([1, 2, 3, 4]).slice(1, -1).values().all()).toEqual([2, 3]);
        expect(new Collection<number>([1, 2, 3, 4]).slice(2, -3).values().all()).toEqual([]);
    });
});

describe('Collection.sliding', (): void => {
    test('returns a sliding window over the items', (): void => {
        expect(new Collection<number>([1, 2, 3, 4]).sliding().map((window: Collection<number>): unknown => window.values().all()).all()).toEqual([[1, 2], [2, 3], [3, 4]]);
    });

    test('advances the window by the given step', (): void => {
        expect(new Collection<number>([1, 2, 3, 4, 5]).sliding(3, 2).map((window: Collection<number>): unknown => window.values().all()).all()).toEqual([[1, 2, 3], [3, 4, 5]]);
    });

    test('returns an empty collection when the window does not fit', (): void => {
        expect(new Collection<number>([1]).sliding(3).all()).toEqual([]);
    });
});

describe('Collection.sole', (): void => {
    test('returns the sole item', (): void => {
        expect(new Collection<number>([1]).sole()).toEqual(1);
    });

    test('returns the sole item matching a callback or condition', (): void => {
        const collection: Collection<Product> = new Collection<Product>(products);

        expect(collection.sole((product: Product): boolean => product.price === 200).name).toEqual('Desk');
        expect(collection.sole('category', 'home').name).toEqual('Door');
        expect(collection.sole('price', '>', 150).name).toEqual('Desk');
    });

    test('throws when nothing matches', (): void => {
        expect((): unknown => new Collection<number>([]).sole()).toThrow(ItemNotFoundException);
        expect((): unknown => new Collection<Product>(products).sole('name', 'Sofa')).toThrow(ItemNotFoundException);
    });

    test('throws when more than one item matches', (): void => {
        expect((): unknown => new Collection<Product>(products).sole('price', 100)).toThrow(MultipleItemsFoundException);
        expect((): unknown => new Collection<number>([1, 2]).sole()).toThrow('2 items were found.');
    });
});

describe('Collection.some', (): void => {
    test('mirrors every arity of contains', (): void => {
        const collection: Collection<Product> = new Collection<Product>(products);

        expect(new Collection<number>([1, 2]).some(2)).toEqual(true);
        expect(collection.some('name', 'Desk')).toEqual(true);
        expect(collection.some('price', '>', 150)).toEqual(true);
        expect(collection.some('price', '>', 500)).toEqual(false);
    });
});

describe('Collection.sort', (): void => {
    test('sorts the items preserving keys', (): void => {
        expect(new Collection<number>([3, 1, 2]).sort().all()).toEqual({ 1: 1, 2: 2, 0: 3 });
        expect(new Collection<number>([3, 1, 2]).sort().values().all()).toEqual([1, 2, 3]);
    });

    test('sorts strings and mixed numerics naturally', (): void => {
        expect(new Collection<string>(['b', 'a', 'c']).sort().values().all()).toEqual(['a', 'b', 'c']);
        expect(new Collection<unknown>(['10', 9, '8']).sort().values().all()).toEqual(['8', 9, '10']);
    });

    test('accepts a comparator', (): void => {
        expect(new Collection<number>([1, 2, 3]).sort((a: number, b: number): number => b - a).values().all()).toEqual([3, 2, 1]);
    });

    test('sorts nullish values first and equal values stably', (): void => {
        expect(new Collection<unknown>([1, null, undefined]).sort().values().all()).toEqual([null, undefined, 1]);
        expect(new Collection<unknown>([null, 1, null]).sort().values().all()).toEqual([null, null, 1]);
    });
});

describe('Collection.sortBy', (): void => {
    test('sorts by the retrieved value', (): void => {
        expect(new Collection<Product>(products).sortBy('price').pluck('name').all()).toEqual(['Chair', 'Door', 'Desk']);
        expect(new Collection<Product>(products).sortBy((product: Product): string => product.name).pluck('name').all()).toEqual(['Chair', 'Desk', 'Door']);
    });

    test('sorts descending when asked to', (): void => {
        expect(new Collection<Product>(products).sortBy('price', true).pluck('name').all()).toEqual(['Desk', 'Chair', 'Door']);
    });

    test('sorts by a list of criteria', (): void => {
        const sorted: Collection<Product> = new Collection<Product>(products).sortBy([['category', 'asc'], ['price', 'desc']]);

        expect(sorted.pluck('name').all()).toEqual(['Door', 'Desk', 'Chair']);
    });

    test('falls through to the next criterion only when the previous ties', (): void => {
        const sorted: Collection<Product> = new Collection<Product>(products).sortBy([['price', 'asc'], ['name', 'asc']]);

        expect(sorted.pluck('name').all()).toEqual(['Chair', 'Door', 'Desk']);
    });

    test('leaves items tying on every criterion in place', (): void => {
        const tied: Collection<Product> = new Collection<Product>([products[1] as Product, products[1] as Product]);

        expect(tied.sortBy([['price', 'asc'], ['name', 'asc']]).pluck('name').all()).toEqual(['Chair', 'Chair']);
    });
});

describe('Collection.sortByDesc', (): void => {
    test('sorts by the retrieved value in descending order', (): void => {
        expect(new Collection<Product>(products).sortByDesc('price').pluck('name').all()).toEqual(['Desk', 'Chair', 'Door']);
    });
});

describe('Collection.sortDesc', (): void => {
    test('sorts the items in descending order', (): void => {
        expect(new Collection<number>([1, 3, 2]).sortDesc().values().all()).toEqual([3, 2, 1]);
    });
});

describe('Collection.sortKeys', (): void => {
    test('sorts the items by their keys', (): void => {
        expect(new Collection<number>({ b: 2, a: 1 }).sortKeys().all()).toEqual({ a: 1, b: 2 });
        expect(new Collection<number>({ b: 2, a: 1 }).sortKeys(true).all()).toEqual({ b: 2, a: 1 });
    });
});

describe('Collection.sortKeysDesc', (): void => {
    test('sorts the items by their keys in descending order', (): void => {
        expect(new Collection<number>({ a: 1, c: 3, b: 2 }).sortKeysDesc().keys().all()).toEqual(['c', 'b', 'a']);
    });
});

describe('Collection.sortKeysUsing', (): void => {
    test('sorts the items by their keys with the given comparator', (): void => {
        const collection: Collection<number> = new Collection<number>({ B: 2, a: 1 });

        expect(collection.sortKeysUsing((a: Key, b: Key): number => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })).keys().all()).toEqual(['a', 'B']);
    });
});

describe('Collection.split', (): void => {
    test('splits the items into the given number of groups', (): void => {
        expect(new Collection<number>([1, 2, 3, 4, 5]).split(3).map((group: Collection<number>): unknown => group.values().all()).all()).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('drops groups that would be empty', (): void => {
        expect(new Collection<number>([1]).split(3).count()).toEqual(1);
        expect(new Collection<number>([]).split(3).all()).toEqual([]);
    });
});

describe('Collection.splitIn', (): void => {
    test('fills each group before moving to the next', (): void => {
        expect(new Collection<number>([1, 2, 3, 4, 5]).splitIn(3).map((group: Collection<number>): unknown => group.values().all()).all()).toEqual([[1, 2], [3, 4], [5]]);
        expect(new Collection<number>([1, 2, 3, 4, 5, 6]).splitIn(2).map((group: Collection<number>): unknown => group.values().all()).all()).toEqual([[1, 2, 3], [4, 5, 6]]);
    });
});

describe('Collection.take', (): void => {
    test('takes from the front for a positive limit', (): void => {
        expect(new Collection<number>([1, 2, 3]).take(2).values().all()).toEqual([1, 2]);
    });

    test('takes from the end for a negative limit', (): void => {
        expect(new Collection<number>([1, 2, 3]).take(-2).values().all()).toEqual([2, 3]);
    });
});

describe('Collection.takeUntil', (): void => {
    test('takes items until the value matches', (): void => {
        expect(new Collection<number>([1, 2, 3]).takeUntil(3).values().all()).toEqual([1, 2]);
    });

    test('takes items until the callback matches', (): void => {
        expect(new Collection<number>([1, 2, 3]).takeUntil((value: number): boolean => value > 2).values().all()).toEqual([1, 2]);
        expect(new Collection<number>([1, 2]).takeUntil(9).values().all()).toEqual([1, 2]);
    });
});

describe('Collection.takeWhile', (): void => {
    test('takes items while the callback matches', (): void => {
        expect(new Collection<number>([1, 2, 3]).takeWhile((value: number): boolean => value < 3).values().all()).toEqual([1, 2]);
        expect(new Collection<number>([1, 2]).takeWhile(9).all()).toEqual([]);
    });
});

describe('Collection.transform', (): void => {
    test('maps the items in place', (): void => {
        const collection: Collection<number> = new Collection<number>({ a: 1, b: 2 });

        expect(collection.transform((value: number): number => value * 2)).toBe(collection);
        expect(collection.all()).toEqual({ a: 2, b: 4 });
    });
});

describe('Collection.unique', (): void => {
    test('removes duplicate values loosely', (): void => {
        expect(new Collection<unknown>([1, '1', 2]).unique().values().all()).toEqual([1, 2]);
        expect(new Collection<number>([1, 2, 1]).unique().all()).toEqual([1, 2]);
    });

    test('removes duplicates by the retrieved value', (): void => {
        expect(new Collection<Product>(products).unique('price').pluck('name').all()).toEqual(['Desk', 'Chair']);
        expect(new Collection<Product>(products).unique((product: Product): string => product.category).pluck('name').all()).toEqual(['Desk', 'Door']);
    });
});

describe('Collection.uniqueStrict', (): void => {
    test('removes duplicate values strictly', (): void => {
        expect(new Collection<unknown>([1, '1', 1]).uniqueStrict().values().all()).toEqual([1, '1']);
    });
});

describe('Collection.value', (): void => {
    test('returns the value of the key from the first item holding it', (): void => {
        expect(new Collection<Product>(products).value('name')).toEqual('Desk');
        expect(new Collection<Product>(products).value('stock')).toEqual(6);
    });

    test('falls back when no item holds the key', (): void => {
        expect(new Collection<Product>(products).value('missing')).toBeUndefined();
        expect(new Collection<Product>(products).value('missing', 'none')).toEqual('none');
        expect(new Collection<Product>([]).value('name', (): string => 'none')).toEqual('none');
    });
});

describe('Collection.values', (): void => {
    test('renumbers the keys', (): void => {
        expect(new Collection<number>({ a: 1, b: 2 }).values().all()).toEqual([1, 2]);
    });
});

describe('Collection.where', (): void => {
    test('filters by a key-value pair', (): void => {
        expect(new Collection<Product>(products).where('category', 'office').pluck('name').all()).toEqual(['Desk', 'Chair']);
    });

    test('filters by every supported operator', (): void => {
        const collection: Collection<Product> = new Collection<Product>(products);

        expect(collection.where('price', '=', 100).count()).toEqual(2);
        expect(collection.where('price', '==', '100').count()).toEqual(2);
        expect(collection.where('price', '===', 100).count()).toEqual(2);
        expect(collection.where('price', '===', '100').count()).toEqual(0);
        expect(collection.where('price', '!=', 100).count()).toEqual(1);
        expect(collection.where('price', '<>', 100).count()).toEqual(1);
        expect(collection.where('price', '!==', '100').count()).toEqual(3);
        expect(collection.where('price', '<', 200).count()).toEqual(2);
        expect(collection.where('price', '>', 100).count()).toEqual(1);
        expect(collection.where('price', '<=', 100).count()).toEqual(2);
        expect(collection.where('price', '>=', 200).count()).toEqual(1);
    });

    test('throws on an unknown operator', (): void => {
        expect((): unknown => new Collection<Product>(products).where('price', 'like', 100).count()).toThrow('Unknown operator [like].');
    });

    test('reads through dot notation', (): void => {
        const orders: Collection<unknown> = new Collection<unknown>([{ customer: { name: 'John' } }, { customer: { name: 'Jane' } }]);

        expect(orders.where('customer.name', 'Jane').count()).toEqual(1);
    });
});

describe('Collection.whereBetween', (): void => {
    test('keeps the items inside the range', (): void => {
        expect(new Collection<Product>(products).whereBetween('price', [100, 150]).pluck('name').all()).toEqual(['Chair', 'Door']);
    });
});

describe('Collection.whereIn', (): void => {
    test('keeps the items whose value is among the given values', (): void => {
        expect(new Collection<Product>(products).whereIn('price', [100]).count()).toEqual(2);
        expect(new Collection<Product>(products).whereIn('price', ['100']).count()).toEqual(2);
    });
});

describe('Collection.whereInStrict', (): void => {
    test('compares the values strictly', (): void => {
        expect(new Collection<Product>(products).whereInStrict('price', ['100']).count()).toEqual(0);
        expect(new Collection<Product>(products).whereInStrict('price', [100]).count()).toEqual(2);
    });
});

describe('Collection.whereInstanceOf', (): void => {
    test('keeps the items that are instances of the given class', (): void => {
        class Person {
        }

        const collection: Collection<unknown> = new Collection<unknown>([new Person(), 'value', new Date()]);

        expect(collection.whereInstanceOf(Person).count()).toEqual(1);
    });
});

describe('Collection.whereNotBetween', (): void => {
    test('keeps the items outside the range', (): void => {
        expect(new Collection<Product>(products).whereNotBetween('price', [100, 150]).pluck('name').all()).toEqual(['Desk']);
    });
});

describe('Collection.whereNotIn', (): void => {
    test('keeps the items whose value is absent from the given values', (): void => {
        expect(new Collection<Product>(products).whereNotIn('price', [100]).pluck('name').all()).toEqual(['Desk']);
    });
});

describe('Collection.whereNotInStrict', (): void => {
    test('compares the values strictly', (): void => {
        expect(new Collection<Product>(products).whereNotInStrict('price', ['100']).count()).toEqual(3);
    });
});

describe('Collection.whereNotNull', (): void => {
    test('keeps the items whose value is not nullish', (): void => {
        expect(new Collection<Product>(products).whereNotNull('stock').pluck('name').all()).toEqual(['Desk', 'Door']);
        expect(new Collection<unknown>([1, null, undefined]).whereNotNull().values().all()).toEqual([1]);
    });
});

describe('Collection.whereNull', (): void => {
    test('keeps the items whose value is nullish', (): void => {
        expect(new Collection<Product>(products).whereNull('stock').pluck('name').all()).toEqual(['Chair']);
        expect(new Collection<unknown>([1, null]).whereNull().values().all()).toEqual([null]);
    });
});

describe('Collection.whereStrict', (): void => {
    test('filters by a strictly compared key-value pair', (): void => {
        expect(new Collection<Product>(products).whereStrict('price', 100).count()).toEqual(2);
        expect(new Collection<Product>(products).whereStrict('price', '100').count()).toEqual(0);
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

describe('Collection comparison semantics', (): void => {
    test('compares nullish values as interchangeable', (): void => {
        expect(new Collection<unknown>([null]).contains(undefined)).toEqual(true);
        expect(new Collection<unknown>([null]).contains(0)).toEqual(false);
        expect(new Collection<unknown>([0]).contains(null)).toEqual(false);
    });

    test('compares plain objects and arrays structurally', (): void => {
        expect(new Collection<unknown>([{ a: 1 }]).contains({ a: 1 })).toEqual(true);
        expect(new Collection<unknown>([{ a: 1 }]).contains({ a: 2 })).toEqual(false);
        expect(new Collection<unknown>([{ a: 1 }]).contains({ b: 1 })).toEqual(false);
        expect(new Collection<unknown>([{ a: 1 }]).contains({ a: 1, b: 2 })).toEqual(false);
        expect(new Collection<unknown>([[1, 2]]).contains([1, 2])).toEqual(true);
    });

    test('compares dates by their time', (): void => {
        const date: Date = new Date('2026-08-27T00:00:00.000Z');

        expect(new Collection<unknown>([date]).contains(new Date(date.getTime()))).toEqual(true);
        expect(new Collection<unknown>([date]).contains(new Date(0))).toEqual(false);
        expect(new Collection<unknown>([date]).contains({ a: 1 })).toEqual(false);
    });

    test('never compares an object equal to a scalar', (): void => {
        expect(new Collection<unknown>([{ a: 1 }]).contains(1)).toEqual(false);
        expect(new Collection<unknown>([1]).contains({ a: 1 })).toEqual(false);
    });

    test('compares numbers and numeric strings numerically', (): void => {
        expect(new Collection<unknown>(['1']).contains(1)).toEqual(true);
        expect(new Collection<unknown>(['abc']).contains(0)).toEqual(false);
        expect(new Collection<unknown>(['']).contains(0)).toEqual(false);
        expect(new Collection<unknown>([Number.NaN]).contains(Number.NaN)).toEqual(true);
        expect(new Collection<unknown>([Number.NaN]).contains(0)).toEqual(false);
    });

    test('compares booleans by truthiness', (): void => {
        expect(new Collection<unknown>([true]).contains(1)).toEqual(true);
        expect(new Collection<unknown>([true]).contains('a')).toEqual(true);
        expect(new Collection<unknown>([false]).contains(0)).toEqual(true);
        expect(new Collection<unknown>([true]).contains(false)).toEqual(false);
    });

    test('orders values numerically, then by nullishness, then as strings', (): void => {
        expect(new Collection<unknown>(['b', 'a']).sortBy((value: unknown): unknown => value).values().all()).toEqual(['a', 'b']);
        expect(new Collection<unknown>(['a', 'a']).sortBy((value: unknown): unknown => value).values().all()).toEqual(['a', 'a']);
        expect(new Collection<unknown>([{}, null]).sortBy((value: unknown): unknown => value).values().all()).toEqual([null, {}]);
    });
});

describe('Collection dot-notation reads', (): void => {
    test('reads through nested collections and maps', (): void => {
        const collection: Collection<unknown> = new Collection<unknown>([
            { inner: new Collection<number>({ a: 1 }) },
            { inner: new Map<Key, number>([['a', 2]]) },
        ]);

        expect(collection.pluck('inner.a').all()).toEqual([1, 2]);
    });

    test('reads an integer key', (): void => {
        expect(new Collection<unknown>([['a', 'b']]).pluck(1).all()).toEqual(['b']);
    });

    test('falls back on a missing or unreachable path', (): void => {
        const collection: Collection<unknown> = new Collection<unknown>([{ a: null }]);

        expect(collection.pluck('a.b').all()).toEqual([undefined]);
        expect(collection.pluck('missing.deep').all()).toEqual([undefined]);
        expect(collection.where('a.*', 1).count()).toEqual(0);
    });

    test('collects every value behind a wildcard', (): void => {
        const collection: Collection<unknown> = new Collection<unknown>([{ roles: [{ name: 'admin' }] }]);

        expect(collection.pluck('roles.*').all()).toEqual([[{ name: 'admin' }]]);
    });
});
