import { describe, expect, test } from 'vitest';
import { Collection, collect, ItemNotFoundException, MultipleItemsFoundException } from '../src/main';

describe('Main', (): void => {
    test('exports Collection class', (): void => {
        expect(Collection).toBeDefined();
        expect(typeof Collection).toBe('function');
        expect(new Collection([1])).toBeInstanceOf(Collection);
    });

    test('exports the lookup exceptions', (): void => {
        expect(typeof ItemNotFoundException).toBe('function');
        expect(typeof MultipleItemsFoundException).toBe('function');
    });

    test('exports the collect helper', (): void => {
        expect(typeof collect).toBe('function');
        expect(collect([1])).toBeInstanceOf(Collection);
    });

    test('exports individual modules', async (): Promise<void> => {
        const module: typeof import('../src/main') = await import('../src/main');

        expect(module.Collection).toBe(Collection);
        expect(module.collect).toBe(collect);
        expect(module.ItemNotFoundException).toBe(ItemNotFoundException);
        expect(module.MultipleItemsFoundException).toBe(MultipleItemsFoundException);
    });
});
