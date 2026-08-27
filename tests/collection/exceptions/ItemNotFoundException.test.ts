import { describe, expect, test } from 'vitest';
import { ItemNotFoundException } from '../../../src/main';

describe('ItemNotFoundException', (): void => {
    test('carries a default message', (): void => {
        const exception: ItemNotFoundException = new ItemNotFoundException();

        expect(exception).toBeInstanceOf(Error);
        expect(exception.name).toEqual('ItemNotFoundException');
        expect(exception.message).toEqual('Item not found.');
    });

    test('accepts a custom message', (): void => {
        expect(new ItemNotFoundException('No product found.').message).toEqual('No product found.');
    });
});
