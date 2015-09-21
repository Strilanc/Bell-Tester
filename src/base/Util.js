/**
 * Miscellaneous utility methods.
 */
export default class Util {
    /**
     * Checks a precondition, throwing an exception containing the given message in the case of failure.
     * @param {!boolean|*} expression
     * @param {=string} message
     * @param {=Array} args
     */
    static need(expression, message, args) {
        if (expression !== true) {
            let argDesc = args === undefined ?
                "(not provided)" :
                `[${ Array.prototype.slice.call(args).join(", ") }]` ;
            let msgDesc = message === undefined ? "(not provided)" : message;
            var msg = "Precondition failed" +
                "\n\nMessage: " + msgDesc +
                "\n\nArgs: " + argDesc;
            throw new Error(msg);
        }
    }

    /**
    * Forced cast from nullable to non-nullable, throwing an exception on failure.
    * @param {?T} v
    * @returns {!T}
    * @template T
    */
    static notNull(v) {
        Util.need(v !== null, "notNull");
        //noinspection JSValidateTypes
        return v;
    }

    /**
     * Determines if there is an integer p such that 2^p equals the given integer.
     * @param {!int} i
     * @returns {!boolean}
     */
    static isPowerOf2(i) {
        return i > 0 && ((i - 1) & i) === 0;
    };

    /**
     * Returns the number of bits needed to uniquely encode all integers up to and including the given value.
     * A discrete off-by-one version of log_2(n).
     * @param {!int} n
     * @returns {!int}
     */
    static bitSize(n) {
        Util.need(n >= 0, "bitSize: n >= 0");
        if (n === 0) {
            return 0;
        }
        return Math.floor(Math.log2(n) + 0.000001) + 1;
    };

    /**
     * Returns the smallest power of 2 that is equal to or larger than the given integer.
     * @param {!int} i
     * @returns {!int}
     */
    static ceilingPowerOf2(i) {
        if (i <= 1) {
            return 1;
        }
        return 1 << Util.bitSize(i - 1);
    };

    /**
     * Determines how multiply-even a number is; how many times you can divide it by 2 before getting an odd result.
     * Odd numbers have 0 power-of-two-ness, multiples of 2 that aren't multiples of 4 have 1 power-of-two-ness,
     * multiples of 4 that aren't multiples of 8 have 3 power-of-two-ness, and so forth.
     *
     * Note that zero has infinite power-of-two-ness.
     *
     * @param {!int} i
     * @returns {!int}
     */
    static powerOfTwoness(i) {
        if (i === 0) {
            return Math.POSITIVE_INFINITY;
        }
        if (i < 0) {
            return Util.powerOfTwoness(-i);
        }
        var lowMask = i ^ (i - 1);
        var lowBit = i & lowMask;
        return Math.round(Math.log2(lowBit));
    };

    /**
     * Converts from Map.<K, V[]> to Map.<V, K[]> in the "obvious" way, by having each value map to the group of keys that
     * mapped to a group containing said value in the original map.
     * @param {!Map.<K, !(V[])>} groupMap
     * @param {!boolean=} includeGroupsForOriginalKeysEvenIfEmpty
     * @returns {!Map.<V, !(K[])>}
     * @template K, V
     */
    static reverseGroupMap(groupMap, includeGroupsForOriginalKeysEvenIfEmpty = false) {
        let result = new Map();

        if (includeGroupsForOriginalKeysEvenIfEmpty) {
            for (let e of groupMap.keys()) {
                result.set(e, []);
            }
        }

        for (let [k, g] of groupMap) {
            //noinspection JSUnusedAssignment
            for (let e of g) {
                if (!result.has(e)) {
                    result.set(e, []);
                }
                //noinspection JSUnusedAssignment
                result.get(e).push(k);
            }
        }

        return result;
    };

    /**
     * Performs a binary search, looking for the first index to return false under the constraint that the given
     * function returns true for all arguments less than some index and false afterwards.
     *
     * @param {!int} max Determines the range to search over. Valid inputs to the query function are non-negative
     * integers up to this maximum than this count.
     * @param {!function(!int) : !boolean} argIsBeforeTransitionFunc Determines if the transition happens before or
     * after the given index.
     * @returns {!int}
     */
    static binarySearchForTransitionFromTrueToFalse(max, argIsBeforeTransitionFunc) {
        let min = 0;
        while (max > min) {
            let med = min + Math.floor((max - min) / 2);
            if (argIsBeforeTransitionFunc(med)) {
                min = med + 1;
            } else {
                max = med;
            }
        }
        return min;
    }

    /**
     * Returns a promise for the result of using a web worker to eval the given string as code.
     *
     * Note that this is NOT intended to be used as a secure sandbox for safely running potentially malicious code.
     *
     * @param {!string} codeText The string passed to 'eval' in the web worker.
     * @param {!number} timeout The maximum number of milliseconds the web worker is allowed to run before being terminated. Pass
     * 'Infinity' if you don't want a timeout.
     * @param {!(!Array).<!function>} cancelList An array to which a function to kill the web-worker will be added.
     */
    static asyncEval(codeText, timeout=Infinity, cancelList=[]) {
        return new Promise((resolve, reject) => {
            let workerCode = `postMessage(eval(${JSON.stringify(codeText)}));`;
            let blob = new Blob([workerCode], {type: 'text/javascript'});
            let blobUrl = URL.createObjectURL(blob);
            let worker = new Worker(blobUrl);

            // We want to eagerly cleanup the timeout timer if the worker finishes early.
            // But we can't start the timer until after we start the worker.
            // So this resolver and promise are for working with the eventual id of the timer.
            let timeoutIDResolver = undefined;
            let timeoutIDPromise = new Promise(res => timeoutIDResolver = res);
            let cleanup = () => {
                worker.terminate();
                timeoutIDPromise.then(clearTimeout);
            };
            worker.addEventListener('message', cleanup);
            worker.addEventListener('error', cleanup);

            // Link the result into the returned promise, and start the worker.
            worker.addEventListener('message', e => resolve(e.data));
            worker.addEventListener('error', e => {
                e.preventDefault();
                reject(e.message);
            });
            worker.postMessage('start');

            // Start the timeout.
            if (timeout !== Infinity) {
                timeoutIDResolver(setTimeout(() => {
                    reject('Timeout');
                    worker.terminate();
                }, timeout));
            }

            cancelList.push(() => {
                reject('Cancelled');
                cleanup();
            });
        });
    }
}

/**
 * Determines if the two given values are exactly the same, as determined by the `===` operator.
 * @param {*} e1
 * @param {*} e2
 * @return {!boolean}
 */
Util.STRICT_EQUALITY = (e1, e2) => e1 === e2;

/**
 * Uses the `isEqualTo` property of the first argument to determine equality with the second argument. Handles the case
 * where both are null, returning true instead of throwing.
 *
 * @param {?T|*} e1
 * @param {?T|*} e2
 * @returns {!boolean}
 * @template T
 */
Util.CUSTOM_IS_EQUAL_TO_EQUALITY = (e1, e2) => e1 === null ? e2 === null: e1.isEqualTo(e2);
