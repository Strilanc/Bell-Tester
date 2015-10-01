/**
 * Yields items.
 *
 * This class is just a JSDoc hack to make WebStorm understand the implicit type, and should not be used.
 */
class Iterator {
    /**
     * @property {!function() : !{
     *     value: (T|undefined),
     *     done: !boolean
     *   }
     * }} next
     * @template T
     */
    constructor() {
        throw new Error("Just a doc class")
    }
}

/**
 * Can be iterated.
 *
 * This class is just a JSDoc hack to make WebStorm understand the implicit type, and should not be used.
 */
class Iterable {
    /**
     * @property {!function(): !Iterator.<T>} [Symbol.iterator]
     * @template T
     */
    constructor() {
        throw new Error("Just a doc class")
    }
}
