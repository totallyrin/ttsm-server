class Queue {
    items;
    maxSize;

    constructor(maxSize = 10) {
        this.items = [];
        this.maxSize = maxSize;
    }

    add(item) {
        this.items.push(item);
        if (this.items.length > this.maxSize) {
            this.items.shift();
        }
    }

    getItems() {
        return this.items;
    }
}

module.exports = Queue;
