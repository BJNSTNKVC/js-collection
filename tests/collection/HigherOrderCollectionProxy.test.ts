import { describe, expect, expectTypeOf, test } from 'vitest';
import { Collection, HigherOrderCollectionProxy, type Callback } from '../../src/main';

class User {
    name: string;
    votes: number;
    active: boolean;
    tags: string[];
    vip: boolean = false;

    constructor(name: string, votes: number, active: boolean, tags: string[]) {
        this.name = name;
        this.votes = votes;
        this.active = active;
        this.tags = tags;
    }

    isActive(): boolean {
        return this.active;
    }

    score(multiplier: number): number {
        return this.votes * multiplier;
    }

    markAsVip(): void {
        this.vip = true;
    }
}

function users(): Collection<User> {
    return new Collection<User>([
        new User('Abigail', 20, false, ['c']),
        new User('Taylor', 10, true, ['a', 'b']),
        new User('Jess', 30, true, []),
    ]);
}

function names(collection: Collection<User>): unknown {
    return collection.map((user: User): string => user.name).all();
}

describe('Collection higher order messages', (): void => {
    test('read a property off every item', (): void => {
        expect(users().map.name.all()).toEqual(['Abigail', 'Taylor', 'Jess']);
        expect(users().sum.votes).toEqual(60);
    });

    test('call a method on every item, passing the arguments along', (): void => {
        expect(users().map.score(2).all()).toEqual([40, 20, 60]);
        expect(users().sum.score(3)).toEqual(180);
        expect(users().filter.isActive().keys().all()).toEqual([1, 2]);
    });

    test('keep the item bound when calling its method', (): void => {
        const collection: Collection<User> = users();

        expect(collection.each.markAsVip()).toBe(collection);
        expect(collection.every((user: User): boolean => user.vip)).toEqual(true);
    });

    test('proxy every documented method', (): void => {
        expect(users().average.votes).toEqual(20);
        expect(users().avg.votes).toEqual(20);
        expect(users().contains.active).toEqual(true);
        expect(users().every.active).toEqual(false);
        expect(users().every.votes).toEqual(true);
        expect(names(users().filter.active)).toEqual({ 1: 'Taylor', 2: 'Jess' });
        expect(users().first.active?.name).toEqual('Taylor');
        expect(users().flatMap.tags.all()).toEqual(['c', 'a', 'b']);
        expect(users().groupBy.active.map((group: Collection<User>): number => group.count()).all()).toEqual([1, 2]);
        expect(users().keyBy.name.keys().all()).toEqual(['Abigail', 'Taylor', 'Jess']);
        expect(users().max.votes).toEqual(30);
        expect(users().min.votes).toEqual(10);
        expect(users().partition.active.map((part: Collection<User>): number => part.count()).all()).toEqual([2, 1]);
        expect(names(users().reject.active)).toEqual(['Abigail']);
        expect(names(users().skipUntil.active)).toEqual({ 1: 'Taylor', 2: 'Jess' });
        expect(names(users().sortByDesc.votes.skipWhile.active)).toEqual(['Abigail', 'Taylor']);
        expect(users().some.active).toEqual(true);
        expect(names(users().sortBy.votes)).toEqual({ 1: 'Taylor', 0: 'Abigail', 2: 'Jess' });
        expect(names(users().sortByDesc.votes)).toEqual({ 2: 'Jess', 0: 'Abigail', 1: 'Taylor' });
        expect(names(users().takeUntil.active)).toEqual(['Abigail']);
        expect(names(users().sortByDesc.votes.takeWhile.active)).toEqual({ 2: 'Jess' });
        expect(names(users().unique.active)).toEqual(['Abigail', 'Taylor']);
    });

    test('leave the methods callable as before', (): void => {
        const map: Collection<User>['map'] = users().map;

        expect(typeof users().map).toEqual('function');
        expect(users().map((user: User): number => user.votes).all()).toEqual([20, 10, 30]);
        expect(map((user: User): string => user.name).all()).toEqual(['Abigail', 'Taylor', 'Jess']);
        expect(users().every('votes', '>', 5)).toEqual(true);
        expect(users().map[Symbol.hasInstance]).toBe(Function.prototype[Symbol.hasInstance]);
    });

    test('reach members of primitive items', (): void => {
        expect(new Collection<string>(['a', 'bb']).map.length.all()).toEqual([1, 2]);
        expect(new Collection<number>([1.25, 2.5]).map.toFixed(1).all()).toEqual(['1.3', '2.5']);
    });

    test('read nullish items as missing members', (): void => {
        const collection: Collection<User | null> = new Collection<User | null>([null, new User('Taylor', 10, true, [])]);

        expect(collection.map.name.all()).toEqual([undefined, 'Taylor']);
    });

    test('call item methods on an empty collection when the method returns a collection', (): void => {
        const nobody: Collection<User> = new Collection<User>();

        expect(nobody.sum.votes).toEqual(0);
        expect(nobody.each.markAsVip()).toBeInstanceOf(Collection);
        expect(nobody.filter.isActive().all()).toEqual([]);
    });

    test('behave like the result when an empty collection is read', (): void => {
        const read: Collection<string> = new Collection<User>().map.name;

        expect(read).toBeInstanceOf(Collection);
        expect(read.all()).toEqual([]);
        expect('all' in read).toEqual(true);
        expect(Object.keys(read)).toEqual(Object.keys(new Collection<string>()));
        expect(JSON.stringify(read)).toEqual('[]');
        expect(read.prepend('Taylor').all()).toEqual(['Taylor']);
    });

    test('cannot call item methods on an empty collection when the method returns a plain value', (): void => {
        expect((): boolean => new Collection<User>().every.isActive()).toThrow(TypeError);
    });

    test('throw when calling a member none of the items hold', (): void => {
        const collection: Collection<{ greet?: () => string }> = new Collection<{ greet?: () => string }>([{}]);

        const greet: unknown = collection.map.greet;

        expect((greet as Collection<unknown>).all()).toEqual([undefined]);
        expect((): unknown => (greet as () => unknown)()).toThrow(TypeError);
    });
});

describe('HigherOrderCollectionProxy', (): void => {
    test('sends a message through an instance of its own', (): void => {
        const collection: Collection<User> = users();
        const proxy: HigherOrderCollectionProxy = new HigherOrderCollectionProxy(collection, function (this: Collection<User>, callback: unknown): unknown {
            return this.map(callback as Callback<User, unknown>);
        });

        expect((proxy.get('name') as Collection<string>).all()).toEqual(['Abigail', 'Taylor', 'Jess']);
        expect((proxy.get('score') as (multiplier: number) => Collection<number>)(2).all()).toEqual([40, 20, 60]);
    });
});

describe('Collection.proxy', (): void => {
    class Users extends Collection<User> {}

    test('adds higher order messages to another method', (): void => {
        Users.proxy('median');

        const median: unknown = new Users(users()).median;

        expect((median as { votes: number }).votes).toEqual(20);
        expect((median as (key: string) => number)('votes')).toEqual(20);
    });

    test('leaves an already proxied method alone', (): void => {
        Users.proxy('map');

        expect(new Users(users()).map.name.all()).toEqual(['Abigail', 'Taylor', 'Jess']);
    });

    test('throws for a method the collection does not have', (): void => {
        expect((): void => Users.proxy('missing')).toThrow(new TypeError('Method [missing] does not exist on this collection instance.'));
    });
});

describe('HigherOrderCollectionProxy types', (): void => {
    test('type properties by the result of the proxied method', (): void => {
        const collection: Collection<User> = users();

        expectTypeOf(collection.map.name).toEqualTypeOf<Collection<string>>();
        expectTypeOf(collection.sum.votes).toEqualTypeOf<number>();
        expectTypeOf(collection.filter.active).toEqualTypeOf<Collection<User>>();
        expectTypeOf(collection.first.active).toEqualTypeOf<User | undefined>();
        expectTypeOf(collection.groupBy.active).toEqualTypeOf<Collection<Collection<User>>>();
    });

    test('type item methods as calls taking their arguments', (): void => {
        const collection: Collection<User> = users();

        expectTypeOf(collection.map.score).parameters.toEqualTypeOf<[number]>();
        expectTypeOf(collection.map.score(2)).toEqualTypeOf<Collection<number>>();
        expectTypeOf(collection.each.markAsVip()).toEqualTypeOf<Collection<User>>();
        expectTypeOf(collection.every.isActive()).toEqualTypeOf<boolean>();
    });

    test('keep the methods typed as before', (): void => {
        const collection: Collection<User> = users();

        expectTypeOf(collection.map((user: User): number => user.votes)).toEqualTypeOf<Collection<number>>();
        expectTypeOf(collection.each((): void => undefined)).toEqualTypeOf<Collection<User>>();
        expectTypeOf(collection.first()).toEqualTypeOf<User | undefined>();
    });
});
