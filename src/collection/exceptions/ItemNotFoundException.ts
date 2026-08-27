export class ItemNotFoundException extends Error {
    /**
     * Create a new exception for a lookup that matched no items.
     */
    constructor(message: string = 'Item not found.') {
        super(message);

        this.name = 'ItemNotFoundException';
    }
}
