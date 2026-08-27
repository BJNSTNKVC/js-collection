import { describe, expect, test } from 'vitest';
import { MultipleItemsFoundException } from '../../../src/main';

describe('MultipleItemsFoundException', (): void => {
    test('reports the number of items that were found', (): void => {
        const exception: MultipleItemsFoundException = new MultipleItemsFoundException(3);

        expect(exception).toBeInstanceOf(Error);
        expect(exception.name).toEqual('MultipleItemsFoundException');
        expect(exception.message).toEqual('3 items were found.');
        expect(exception.count).toEqual(3);
    });
});
