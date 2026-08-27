import { describe, expect, test } from 'vitest';
import { ItemNotFoundException, MultipleItemsFoundException } from '../../../src/collection/exceptions';

describe('Exceptions', (): void => {
    test('exports every exception class', (): void => {
        expect(typeof ItemNotFoundException).toBe('function');
        expect(typeof MultipleItemsFoundException).toBe('function');
    });

    test('exports individual modules', async (): Promise<void> => {
        const module: typeof import('../../../src/collection/exceptions') = await import('../../../src/collection/exceptions');

        expect(module.ItemNotFoundException).toBe(ItemNotFoundException);
        expect(module.MultipleItemsFoundException).toBe(MultipleItemsFoundException);
    });
});
