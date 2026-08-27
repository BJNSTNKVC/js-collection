import type { Collection } from './Collection';

export type Key = string | number;

export type ItemsInput<V = unknown> = Collection<V> | Map<Key, V> | readonly V[] | Iterable<V> | Record<Key, V> | null | undefined;

export type Operator = '=' | '==' | '===' | '!=' | '<>' | '!==' | '<' | '>' | '<=' | '>=';

export type Primitive = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'function' | 'object' | 'array' | 'null' | 'undefined';

export type Constructor<T = unknown> = new (...args: never[]) => T;

export type Callback<V, R = unknown> = (value: V, key: Key) => R;

export type Comparator<T = unknown> = (a: T, b: T) => number;

export type Direction = 'asc' | 'desc';

export type Criteria<V> = Key | Callback<V> | [Key | Callback<V>, Direction][];
