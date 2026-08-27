import { describe, expect, test } from 'vitest';
import { ItemNotFoundException, MultipleItemsFoundException } from '../../src/main';

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

describe('MultipleItemsFoundException', (): void => {
    test('reports the number of items that were found', (): void => {
        const exception: MultipleItemsFoundException = new MultipleItemsFoundException(3);

        expect(exception).toBeInstanceOf(Error);
        expect(exception.name).toEqual('MultipleItemsFoundException');
        expect(exception.message).toEqual('3 items were found.');
        expect(exception.count).toEqual(3);
    });
});
