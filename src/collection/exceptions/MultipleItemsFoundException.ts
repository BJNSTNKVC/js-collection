export class MultipleItemsFoundException extends Error {
    /**
     * The number of items that were found.
     */
    count: number;

    /**
     * Create a new exception for a lookup that matched more than one item.
     */
    constructor(count: number) {
        super(`${count} items were found.`);

        this.name = 'MultipleItemsFoundException';
        this.count = count;
    }
}
