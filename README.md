# Collection

TypeScript equivalent of the [Laravel Collection](https://laravel.com/docs/12.x/collections): a fluent, convenient wrapper for working with arrays of data.

## Installation & setup

### NPM

You can install the package via npm:

```bash
npm install @bjnstnkvc/collection
```

and then import it into your project

```ts
import { Collection } from '@bjnstnkvc/collection';
```

## Usage

### Creating a Collection

A collection wraps any array-like input and exposes a fluent set of methods over it. The generic is what types the values flowing through the chain:

```ts
import { Collection } from '@bjnstnkvc/collection';

const collection: Collection<number> = new Collection<number>([1, 2, 3, 4]);

const result: Collection<number> = collection
    .filter((value: number): boolean => value % 2 === 0)
    .map((value: number): number => value * 10);

result.all(); // { 1: 20, 3: 40 }
result.values().all(); // [20, 40]
```

Nearly every method returns a new collection, leaving the original untouched. The exceptions are the methods that mutate by definition, covered under [Mutating a Collection](#mutating-a-collection).

#### Keys

Collections are keyed like PHP arrays rather than JavaScript arrays, which is what lets `filter`, `map` and friends preserve keys the way Laravel does. Keys are strings or numbers, canonical integer strings fold into numbers, and insertion order is preserved:

```ts
const collection: Collection<number> = new Collection<number>({ b: 2, a: 1 });

collection.keys().all(); // ['b', 'a']
collection.get('a');     // 1

new Collection<string>({ '1': 'a' }).keys().all(); // [1]
```

The `all` method returns an array when the keys form a zero-based sequence and a plain object otherwise, so a list stays a list and a keyed collection keeps its keys:

```ts
new Collection<number>([1, 2]).all();        // [1, 2]
new Collection<number>({ a: 1 }).all();      // { a: 1 }
new Collection<number>([1, 2]).reverse().all(); // { 1: 2, 0: 1 }
```

Call `values` before `all` whenever the keys are not interesting.

#### Accepted input

The constructor accepts arrays, plain objects, `Map` instances, other collections, and any other iterable, with `null` and `undefined` yielding an empty collection:

```ts
new Collection<number>([1, 2]);                           // a list
new Collection<number>({ a: 1 });                         // keyed entries
new Collection<number>(new Map([['a', 1]]));              // keyed entries
new Collection<number>(new Set([1, 2, 2]));               // a list of unique values
new Collection<number>(null);                             // empty
```

Since any iterable is consumed as a list of values, a `Set` or a generator becomes a zero-based collection, mirroring how `Array.from` treats them.

### Creating a Collection Statically

#### Collection.make()

The `make` method creates a collection from the given items, reading like Laravel's `collect` helper:

```ts
Collection.make([1, 2, 3]);
```

#### Collection.empty()

The `empty` method creates an empty collection:

```ts
Collection.empty<number>();
```

#### Collection.fromJson()

The `fromJson` method creates a collection by decoding the given JSON string:

```ts
Collection.fromJson('[1,2,3]'); // a list
Collection.fromJson('{"a":1}'); // keyed entries
```

#### Collection.range()

The `range` method creates a collection holding an inclusive range of numbers, counting down when the first bound is the higher one:

```ts
Collection.range(1, 4); // [1, 2, 3, 4]
Collection.range(3, 1); // [3, 2, 1]
```

#### Collection.times()

The `times` method creates a collection by invoking the callback once for each number from 1 to the given count. Without a callback, the numbers themselves are collected:

```ts
Collection.times(3, (number: number): number => number * 2); // [2, 4, 6]
Collection.times(3);                                          // [1, 2, 3]
```

A count below one yields an empty collection.

#### Collection.wrap()

The `wrap` method wraps the given value in a collection unless it is one already. Values that are not array-like become a single item:

```ts
Collection.wrap([1, 2]);   // [1, 2]
Collection.wrap('value');  // ['value']
Collection.wrap(null);     // empty
```

#### Collection.unwrap()

The `unwrap` method returns the underlying items of a collection, and any other value as given:

```ts
Collection.unwrap(new Collection([1, 2])); // [1, 2]
Collection.unwrap('value');                // 'value'
```

### Retrieving Items

#### all()

The `all` method returns the underlying items, as an array for a list and a plain object otherwise:

```ts
collection.all();
```

#### get()

The `get` method returns the item at the given key. An optional fallback, given as a value or a callback, is returned when the key is missing:

```ts
collection.get('name');
collection.get('missing', 'none');
collection.get('missing', (): string => 'none');
```

#### first()

The `first` method returns the first item, or the first item passing the given callback:

```ts
collection.first();
collection.first((value: number): boolean => value > 1);
collection.first((value: number): boolean => value > 9, 0);
```

#### firstOrFail()

The `firstOrFail` method returns the first item passing the given callback or key-value condition, throwing an `ItemNotFoundException` when nothing matches:

```ts
collection.firstOrFail();
collection.firstOrFail('category', 'office');
collection.firstOrFail('price', '>', 100);
```

#### firstWhere()

The `firstWhere` method returns the first item matching the given key-value condition:

```ts
collection.firstWhere('category', 'office');
collection.firstWhere('price', '>', 100);
```

#### last()

The `last` method returns the last item, or the last item passing the given callback:

```ts
collection.last();
collection.last((value: number): boolean => value < 3);
```

#### sole()

The `sole` method returns the only item matching the given callback or condition. It throws an `ItemNotFoundException` when nothing matches and a `MultipleItemsFoundException` when more than one item does:

```ts
collection.sole();
collection.sole('category', 'home');
collection.sole('price', '>', 150);
```

#### value()

The `value` method returns the value of the given key from the first item holding it:

```ts
collection.value('name');
collection.value('missing', 'none');
```

#### random()

The `random` method returns one random item, or a collection of the given number of random items. Requesting more items than are available throws a `RangeError`:

```ts
collection.random();
collection.random(2);
```

#### after() & before()

The `after` and `before` methods return the item adjacent to the first item matching the given value or callback, or `undefined` when there is none:

```ts
new Collection([1, 2, 3]).after(2);  // 3
new Collection([1, 2, 3]).before(2); // 1
```

Both accept a second argument enabling strict comparison.

#### search()

The `search` method returns the key of the first item matching the given value or callback, and `false` when nothing matches:

```ts
new Collection([1, 2, 3]).search(2);       // 1
new Collection([1, 2, 3]).search(9);       // false
new Collection(['2']).search(2, true);     // false
```

### Filtering Items

#### filter() & reject()

The `filter` method keeps the items passing the given callback, and `reject` keeps the ones failing it. Both preserve keys. Without a callback, `filter` keeps the truthy items and `reject` the falsy ones:

```ts
collection.filter((value: number): boolean => value > 1);
collection.reject((value: number): boolean => value > 1);
collection.filter();
```

#### where()

The `where` method filters by a key-value pair, or by a key, an operator and a value. The available operators are `=`, `==`, `===`, `!=`, `<>`, `!==`, `<`, `>`, `<=` and `>=`, and an unknown operator throws a `TypeError`:

```ts
collection.where('category', 'office');
collection.where('price', '>', 100);
```

Keys are read through dot notation, so nested values are reachable:

```ts
collection.where('customer.name', 'John');
```

#### whereStrict()

The `whereStrict` method filters by a strictly compared key-value pair:

```ts
collection.whereStrict('price', 100);
```

#### whereIn() & whereNotIn()

The `whereIn` method keeps the items whose value at the given key is present among the given values, and `whereNotIn` keeps the ones where it is absent:

```ts
collection.whereIn('price', [100, 200]);
collection.whereNotIn('price', [100]);
```

The `whereInStrict` and `whereNotInStrict` methods compare strictly.

#### whereBetween() & whereNotBetween()

The `whereBetween` method keeps the items whose value at the given key falls inside the inclusive range, and `whereNotBetween` keeps the ones falling outside it:

```ts
collection.whereBetween('price', [100, 150]);
collection.whereNotBetween('price', [100, 150]);
```

#### whereNull() & whereNotNull()

The `whereNull` method keeps the items whose value at the given key is `null` or `undefined`, and `whereNotNull` keeps the rest. Omitting the key tests the items themselves:

```ts
collection.whereNull('stock');
collection.whereNotNull('stock');
collection.whereNotNull();
```

#### whereInstanceOf()

The `whereInstanceOf` method keeps the items that are instances of the given class:

```ts
collection.whereInstanceOf(Product);
```

#### only() & except()

The `only` method returns the items with the given keys, and `except` returns all the others:

```ts
collection.only('a', 'c');
collection.except('a');
```

#### unique()

The `unique` method removes duplicate values, comparing loosely by default. A key or callback narrows what is compared:

```ts
collection.unique();
collection.unique('price');
collection.unique((product: Product): string => product.category);
```

The `uniqueStrict` method compares strictly.

#### duplicates()

The `duplicates` method returns the values appearing more than once, keyed by the later occurrence:

```ts
new Collection(['a', 'b', 'a']).duplicates().all(); // { 2: 'a' }
```

The `duplicatesStrict` method compares strictly.

### Testing Items

#### contains()

The `contains` method determines whether the collection holds the given value, an item passing the given callback, or an item matching a key-value condition:

```ts
collection.contains(2);
collection.contains((value: number): boolean => value > 1);
collection.contains('name', 'Desk');
collection.contains('price', '>', 100);
```

The `containsStrict` method compares strictly, and `some` is an alias of `contains`. The `doesntContain` and `doesntContainStrict` methods negate them.

#### containsOneItem()

The `containsOneItem` method determines whether exactly one item is held, or exactly one item passes the given callback:

```ts
collection.containsOneItem();
collection.containsOneItem((value: number): boolean => value > 2);
```

#### every()

The `every` method determines whether all items pass the given callback, hold a truthy value at the given key, or match the given condition. An empty collection passes:

```ts
collection.every((value: number): boolean => value > 0);
collection.every('name');
collection.every('price', '>=', 100);
```

#### has() & hasAny()

The `has` method determines whether all of the given keys are present, and `hasAny` whether any of them is:

```ts
collection.has('a', 'b');
collection.hasAny('a', 'z');
```

#### isEmpty() & isNotEmpty()

The `isEmpty` and `isNotEmpty` methods determine whether the collection holds anything:

```ts
collection.isEmpty();
collection.isNotEmpty();
```

#### ensure()

The `ensure` method throws a `TypeError` unless every item is of one of the given primitive types or class instances. The recognized type names are `string`, `number`, `bigint`, `boolean`, `symbol`, `function`, `object`, `array`, `null` and `undefined`:

```ts
collection.ensure('number');
collection.ensure(['number', 'string']);
collection.ensure(Product);
```

### Transforming Items

#### map()

The `map` method maps the items through the given callback, preserving keys:

```ts
collection.map((value: number, key: Key): number => value * 2);
```

#### mapWithKeys()

The `mapWithKeys` method keys the mapped values by the key the callback returns. The callback returns a `[key, value]` tuple, the way `Object.fromEntries` reads entries:

```ts
collection.mapWithKeys((product: Product): [Key, number] => [product.name, product.price]);
```

#### mapToGroups() & mapToDictionary()

The `mapToGroups` method groups the mapped values under the key the callback returns, and `mapToDictionary` does the same while collecting each group into a plain array:

```ts
collection.mapToGroups((product: Product): [Key, string] => [product.category, product.name]);
collection.mapToDictionary((product: Product): [Key, string] => [product.category, product.name]);
```

#### mapInto()

The `mapInto` method maps the items into instances of the given class, passing the value and its key to the constructor:

```ts
collection.mapInto(Product);
```

#### mapSpread()

The `mapSpread` method spreads each nested item into the callback arguments, with the key passed last:

```ts
new Collection([[1, 2], [3, 4]]).mapSpread((a: unknown, b: unknown): number => (a as number) + (b as number));
```

#### flatMap()

The `flatMap` method maps the items and collapses the result by one level:

```ts
collection.flatMap((value: number): number[] => [value, value * 10]);
```

#### select()

The `select` method reduces each item to the given keys, skipping the keys an item does not carry:

```ts
collection.select('name', 'price');
```

#### pluck()

The `pluck` method returns the values of the given key from every item, optionally keyed by another key. Dot notation and `*` wildcards are supported:

```ts
collection.pluck('name');
collection.pluck('price', 'name');
collection.pluck('customer.name');
collection.pluck('lines.*.sku');
```

#### keys(), values() & flip()

The `keys` method returns the keys of the collection, `values` returns the values under renumbered keys, and `flip` swaps the two. Flipping values that cannot be keys throws a `TypeError`:

```ts
collection.keys();
collection.values();
collection.flip();
```

#### keyBy()

The `keyBy` method keys the collection by the given key or callback:

```ts
collection.keyBy('name');
collection.keyBy((product: Product): string => product.category);
```

#### combine()

The `combine` method uses the current values as keys for the given values, throwing a `RangeError` when the counts differ:

```ts
new Collection(['name', 'age']).combine(['John', 30]); // { name: 'John', age: 30 }
```

#### collapse() & collapseWithKeys()

The `collapse` method collapses nested items into a single collection, renumbering integer keys, and `collapseWithKeys` preserves them instead. Items holding nothing nested are skipped:

```ts
new Collection([[1, 2], [3]]).collapse();           // [1, 2, 3]
new Collection([{ a: 1 }, { b: 2 }]).collapseWithKeys(); // { a: 1, b: 2 }
```

#### flatten()

The `flatten` method flattens nested items into values, dropping keys. An optional depth limits how far it descends:

```ts
new Collection([1, [2, [3]]]).flatten();  // [1, 2, 3]
new Collection([1, [2, [3]]]).flatten(1); // [1, 2, [3]]
```

#### dot() & undot()

The `dot` method flattens nested items into a single level, joining nested keys with dots, and `undot` expands them back. Nested sequences are rendered as arrays:

```ts
new Collection({ user: { name: 'John' } }).dot();   // { 'user.name': 'John' }
new Collection({ 'user.name': 'John' }).undot();    // { user: { name: 'John' } }
```

#### transform()

The `transform` method maps the items through the callback in place, and is one of the few methods that mutate the collection:

```ts
collection.transform((value: number): number => value * 2);
```

### Grouping & Chunking

#### groupBy()

The `groupBy` method groups the items by the given key or callback. A callback returning an array files the item under every returned key, and a second argument preserves the original keys:

```ts
collection.groupBy('category');
collection.groupBy((product: Product): string[] => [product.category, 'all']);
collection.groupBy('category', true);
```

#### chunk() & chunkWhile()

The `chunk` method breaks the collection into chunks of the given size, preserving keys, and `chunkWhile` chunks for as long as the callback holds. The callback receives the value, its key and the chunk built so far:

```ts
collection.chunk(2);
collection.chunkWhile((value: number, key: Key, chunk: Collection<number>): boolean => value === chunk.last());
```

#### split() & splitIn()

The `split` method splits the items into the given number of groups, distributing the remainder across the earlier ones, while `splitIn` fills each group before moving to the next:

```ts
new Collection([1, 2, 3, 4, 5]).split(3);   // [[1, 2], [3, 4], [5]]
new Collection([1, 2, 3, 4, 5]).splitIn(3); // [[1, 2], [3, 4], [5]]
```

#### sliding()

The `sliding` method returns a sliding window over the items, of the given size and advanced by the given step:

```ts
new Collection([1, 2, 3, 4]).sliding();     // [[1, 2], [2, 3], [3, 4]]
new Collection([1, 2, 3, 4, 5]).sliding(3, 2); // [[1, 2, 3], [3, 4, 5]]
```

#### partition()

The `partition` method splits the items into those passing the given truth test and those failing it, returning both as a collection of two collections:

```ts
const groups: Collection<Collection<number>> = collection.partition((value: number): boolean => value % 2 === 0);

groups.get(0); // the items that passed
groups.get(1); // the items that failed
```

#### countBy()

The `countBy` method counts the occurrences of each value, or of each result of the given key or callback:

```ts
new Collection([1, 2, 2]).countBy(); // { 1: 1, 2: 2 }
collection.countBy('category');
```

### Sorting Items

#### sort() & sortDesc()

The `sort` method sorts the items while preserving keys, either naturally or through the given comparator. The `sortDesc` method sorts in the opposite direction:

```ts
collection.sort();
collection.sort((a: number, b: number): number => a - b);
collection.sortDesc();
```

Natural ordering compares numbers and numeric strings numerically, sorts nullish values first, and falls back to string comparison.

#### sortBy() & sortByDesc()

The `sortBy` method sorts by the given key or callback, and `sortByDesc` does the same in descending order:

```ts
collection.sortBy('price');
collection.sortBy((product: Product): string => product.name);
collection.sortByDesc('price');
```

Passing a list of criteria sorts by each in turn, with a direction per criterion:

```ts
collection.sortBy([['category', 'asc'], ['price', 'desc']]);
```

#### sortKeys(), sortKeysDesc() & sortKeysUsing()

The `sortKeys` method sorts the items by their keys, `sortKeysDesc` reverses that order, and `sortKeysUsing` sorts through the given comparator:

```ts
collection.sortKeys();
collection.sortKeysDesc();
collection.sortKeysUsing((a: Key, b: Key): number => String(a).localeCompare(String(b)));
```

#### reverse() & shuffle()

The `reverse` method reverses the order of the items while preserving keys, and `shuffle` returns the values in a random order:

```ts
collection.reverse();
collection.shuffle();
```

### Slicing Items

#### slice()

The `slice` method returns a slice of the items, preserving keys. A negative offset counts from the end, and a negative length stops that many items short of it:

```ts
collection.slice(2);
collection.slice(1, 2);
collection.slice(-2);
```

#### take(), skip() & forPage()

The `take` method takes the given number of items, from the end for a negative limit, while `skip` drops them and `forPage` returns the items of a page:

```ts
collection.take(2);
collection.take(-2);
collection.skip(2);
collection.forPage(2, 3);
```

#### takeUntil(), takeWhile(), skipUntil() & skipWhile()

These methods take or skip items relative to the first item matching the given value or callback:

```ts
collection.takeUntil((value: number): boolean => value > 2);
collection.takeWhile((value: number): boolean => value < 3);
collection.skipUntil(3);
collection.skipWhile((value: number): boolean => value < 3);
```

#### nth()

The `nth` method returns every n-th item, starting at the given offset:

```ts
new Collection(['a', 'b', 'c', 'd', 'e']).nth(2);    // ['a', 'c', 'e']
new Collection(['a', 'b', 'c', 'd', 'e']).nth(2, 1); // ['b', 'd']
```

### Combining Collections

#### merge() & mergeRecursive()

The `merge` method merges the given items onto the collection, overwriting string keys and appending integer ones. The `mergeRecursive` method descends into nested items instead, collecting both sides of a duplicate scalar key into a list:

```ts
new Collection({ a: 1 }).merge({ a: 2, b: 3 });                     // { a: 2, b: 3 }
new Collection({ user: { name: 'John' } }).mergeRecursive({ user: { age: 30 } }); // { user: { name: 'John', age: 30 } }
new Collection({ id: 1 }).mergeRecursive({ id: 2 });                // { id: [1, 2] }
```

#### replace() & replaceRecursive()

The `replace` method replaces the items at the keys of the given items, and `replaceRecursive` descends into nested items:

```ts
new Collection(['a', 'b', 'c']).replace({ 1: 'x' }); // ['a', 'x', 'c']
new Collection({ tags: ['a', 'b'] }).replaceRecursive({ tags: ['x'] }); // { tags: ['x', 'b'] }
```

#### union()

The `union` method adds the items of the given input that are missing from the collection, letting the existing keys win:

```ts
new Collection({ a: 1 }).union({ a: 9, b: 2 }); // { a: 1, b: 2 }
```

#### concat()

The `concat` method appends the values of the given items onto the end of the collection:

```ts
new Collection([1]).concat([2, 3]); // [1, 2, 3]
```

#### zip()

The `zip` method zips the collection together with the given lists, index by index, padding shorter lists with `null`:

```ts
new Collection([1, 2]).zip(['a', 'b']); // [[1, 'a'], [2, 'b']]
```

#### crossJoin()

The `crossJoin` method returns every permutation of the values across the given lists:

```ts
new Collection([1, 2]).crossJoin(['a', 'b']); // [[1, 'a'], [1, 'b'], [2, 'a'], [2, 'b']]
```

#### pad() & multiply()

The `pad` method pads the collection to the given size with the given value, prepending for a negative size, and `multiply` repeats the values the given number of times:

```ts
new Collection([1, 2]).pad(4, 0);  // [1, 2, 0, 0]
new Collection([1, 2]).pad(-4, 0); // [0, 0, 1, 2]
new Collection([1, 2]).multiply(2); // [1, 2, 1, 2]
```

### Comparing Collections

#### diff(), diffAssoc() & diffKeys()

The `diff` method returns the items whose values are absent from the given items, `diffAssoc` compares keys and values together, and `diffKeys` compares keys alone:

```ts
new Collection([1, 2, 3]).diff([2]);              // { 0: 1, 2: 3 }
new Collection({ a: 1, b: 2 }).diffAssoc({ a: 1 }); // { b: 2 }
new Collection({ a: 1, b: 2 }).diffKeys({ a: 9 });  // { b: 2 }
```

The `diffUsing`, `diffAssocUsing` and `diffKeysUsing` methods take a comparator, which returns `0` when the two sides are considered equal.

#### intersect(), intersectAssoc() & intersectByKeys()

The `intersect` method returns the items whose values are present in the given items, `intersectAssoc` compares keys and values together, and `intersectByKeys` compares keys alone:

```ts
new Collection([1, 2, 3]).intersect([2, 3]);              // { 1: 2, 2: 3 }
new Collection({ a: 1, b: 2 }).intersectAssoc({ a: 1 });  // { a: 1 }
new Collection({ a: 1, b: 2 }).intersectByKeys({ a: 9 }); // { a: 1 }
```

The `intersectUsing` and `intersectAssocUsing` methods take a comparator.

### Aggregating Items

#### count()

The `count` method counts the items:

```ts
collection.count();
```

#### sum(), avg() & average()

The `sum` method sums the items or the retrieved values, treating nullish values as zero. The `avg` method averages them while skipping nullish values, returning `undefined` when nothing is left, and `average` is an alias of it:

```ts
collection.sum();
collection.sum('price');
collection.avg('price');
collection.avg((product: Product): number => product.price * 2);
```

#### min(), max(), median() & mode()

The `min` and `max` methods return the lowest and highest value, `median` returns the middle one, and `mode` returns the values occurring most often. All of them skip nullish values:

```ts
collection.min('price');
collection.max('price');
collection.median('price');
collection.mode('price'); // [100]
```

#### percentage()

The `percentage` method returns the percentage of items passing the given truth test, rounded to the given precision:

```ts
new Collection([1, 1, 2, 2, 2, 3]).percentage((value: number): boolean => value === 1); // 33.33
```

#### reduce() & reduceSpread()

The `reduce` method reduces the collection to a single value, carrying the result between iterations. The `reduceSpread` method carries an array of values instead:

```ts
collection.reduce((carry: number, value: number, key: Key): number => carry + value, 0);
collection.reduceSpread((carry: unknown[], value: number): unknown[] => [(carry[0] as number) + value], 0);
```

#### join() & implode()

The `join` method joins the values with the given glue, optionally using a different glue before the last one. The `implode` method joins the plucked values or callback results instead, choosing based on what the items hold:

```ts
new Collection(['a', 'b', 'c']).join(', ');          // 'a, b, c'
new Collection(['a', 'b', 'c']).join(', ', ' and '); // 'a, b and c'
collection.implode('name', ', ');
collection.implode((product: Product): string => product.name, ', ');
```

### Mutating a Collection

The methods below change the collection in place rather than returning a new one.

#### put(), push(), add() & prepend()

The `put` method sets the item at the given key, `push` appends the given values under the next integer keys, `add` appends a single item, and `prepend` puts an item at the front:

```ts
collection.put('name', 'John');
collection.push(1, 2);
collection.add(3);
collection.prepend(0);
collection.prepend(1, 'a');
```

#### pull(), pop(), shift() & forget()

The `pull` method removes and returns the item at the given key, `pop` and `shift` remove from either end, and `forget` removes the items with the given keys:

```ts
collection.pull('name');
collection.pull('missing', 'none');
collection.pop();
collection.pop(2);
collection.shift();
collection.forget('a', 'b');
```

#### getOrPut()

The `getOrPut` method returns the item at the given key, storing and returning the given value when the key is missing:

```ts
collection.getOrPut('name', 'John');
collection.getOrPut('name', (): string => 'John');
```

#### splice()

The `splice` method removes and returns a slice of the items, optionally replacing them. Keys are renumbered, since a splice works on values:

```ts
collection.splice(1);
collection.splice(1, 1);
collection.splice(1, 1, ['x']);
```

### Flow Control

#### each() & eachSpread()

The `each` method iterates over the items, stopping once the callback returns `false`. The `eachSpread` method spreads each nested item into the callback arguments:

```ts
collection.each((value: number, key: Key): void => console.log(key, value));
collection.each((value: number): boolean => value < 3);
collection.eachSpread((name: unknown, age: unknown): void => console.log(name, age));
```

#### when() & unless()

The `when` method calls the callback when the given condition is truthy, and `unless` when it is falsy. Both accept a fallback, and both return the collection when the condition does not hold and no fallback is given. A condition given as a callback receives the collection:

```ts
collection.when(true, (items: Collection<number>): number => items.count());
collection.when(false, (items: Collection<number>): number => items.count(), (): number => 0);
collection.unless(false, (items: Collection<number>): number => items.count());
collection.when((items: Collection<number>): boolean => items.isNotEmpty(), (items: Collection<number>): number => items.count());
```

The `whenEmpty`, `whenNotEmpty`, `unlessEmpty` and `unlessNotEmpty` methods test the collection itself.

#### pipe(), pipeInto() & pipeThrough()

The `pipe` method passes the collection to the callback and returns its result, `pipeInto` passes it into a new instance of the given class, and `pipeThrough` passes it through the given callbacks in order:

```ts
collection.pipe((items: Collection<number>): number => items.sum());
collection.pipeInto(Report);
collection.pipeThrough([
    (carry: unknown): unknown => (carry as Collection<number>).filter((value: number): boolean => value > 1),
    (carry: unknown): unknown => (carry as Collection<number>).sum(),
]);
```

#### tap()

The `tap` method passes the collection to the callback and returns the collection, letting you look at it mid-chain:

```ts
collection
    .filter((value: number): boolean => value > 1)
    .tap((items: Collection<number>): void => console.log(items.count()))
    .values();
```

#### collect()

The `collect` method creates a fresh collection holding the same entries:

```ts
collection.collect();
```

### Serialization

#### toArray()

The `toArray` method converts the collection and everything nested inside it into plain arrays and objects:

```ts
new Collection({ list: new Collection([1, 2]) }).toArray(); // { list: [1, 2] }
```

#### toJson() & toJSON()

The `toJson` method serializes the collection to a JSON string. Since `toJSON` is the native serialization hook, `JSON.stringify` works out of the box:

```ts
new Collection([1, 2]).toJson();      // '[1,2]'
JSON.stringify(new Collection([1, 2])); // '[1,2]'
```

### Iteration

A collection is iterable over its values, so it works with `for...of` loops and the spread operator:

```ts
for (const value of collection) {
    console.log(value);
}

const values: number[] = [...collection];
```

## Notes

Loose comparison, used by `contains`, `where`, `unique` and friends, follows the spirit of PHP's `==` rather than JavaScript's: `null` and `undefined` are interchangeable, numbers compare equal to numeric strings, booleans compare by truthiness, plain objects and arrays compare by their entries, and dates compare by their time. An object is never equal to a scalar. The `whereStrict`, `containsStrict` and `uniqueStrict` variants use `===` instead.

Truthiness, used by `filter`, `reject`, `every` and the callback-driven methods, follows JavaScript rather than PHP, so `'0'` and an empty array are truthy.

Keys given to methods like `get`, `only` and `forget` are normalized the way they are on construction, so `collection.get('1')` and `collection.get(1)` reach the same item.
