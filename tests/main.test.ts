import { describe, expect, test } from 'vitest';
import { Collection } from '../src/main';

describe('Main', (): void => {
    test('exports Collection class', (): void => {
        expect(Collection).toBeDefined();
        expect(typeof Collection).toBe('function');
        expect(new Collection([1])).toBeInstanceOf(Collection);
    });

    test('exports individual modules', async (): Promise<void> => {
        const module: typeof import('../src/main') = await import('../src/main');

        expect(module.Collection).toBe(Collection);
    });
});
