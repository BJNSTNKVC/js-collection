export class ItemNotFoundException extends Error {
    /**
     * Create a new exception for a lookup that matched no items.
     */
    constructor(message: string = 'Item not found.') {
        super(message);

        this.name = 'ItemNotFoundException';
    }
}

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
