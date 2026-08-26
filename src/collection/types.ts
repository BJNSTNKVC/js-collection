import type { Collection } from './Collection';

export type Key = string | number;

export type ItemsInput<V = unknown> = Collection<V> | Map<Key, V> | readonly V[] | Iterable<V> | Record<Key, V> | null | undefined;

export type Callback<V, R = unknown> = (value: V, key: Key) => R;
