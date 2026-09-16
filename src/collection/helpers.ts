import { Collection } from './Collection';
import type { ItemsInput } from './types';

/**
 * Create a collection from the given items.
 */
export function collect<T = unknown>(items?: ItemsInput<T>): Collection<T> {
    return new Collection<T>(items);
}
