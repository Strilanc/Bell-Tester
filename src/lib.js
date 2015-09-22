import Seq from "src/base/Seq.js"

/**
 * Accepts multiple functions, storing them until told to run them and reset.
 */
export class FunctionGroup {
    constructor() {
        this._funcs = [];
    }
    add(func) {
        this._funcs.push(func);
    }
    runAndClear() {
        let t = this._funcs;
        this._funcs = [];
        for (let f of t) {
            f();
        }
    }
}

/***
 * Returns a promise that will resolve with the given value after the given delay.
 * @param {T} value The promise's eventual result.
 * @param {number} delayMillis The amount of time, in milliseconds, before the promise completes.
 * @returns {!Promise.<T>}
 * @template T
 */
export function delayed(value, delayMillis) {
    return new Promise(resolve => setTimeout(() => resolve(value), delayMillis));
}

/**
 * Repeatedly uses the given promise generating function, forwarding the promises' results to the given value consumer,
 * until the given count is reached or one of the promises fails.
 *
 * The results may be re-ordered, if the promises complete out of order.
 *
 * @param {!function() : !Promise} promiseFactory Creates the promises whose results will be consumed.
 * @param {!function(*)} valueConsumer Consumed the results of the created promises.
 * @param {!function(*)} errorConsumer If any of the promises fails, its error is passed to this function and the stream
 * stops.
 * @param {number=} count The maximum number of promises to create (Infinity is an allowed value).
 * @param {number=} concurrency The maximum number of promises that can be in flight at the same time. Past this limit,
 * starting more promises must wait for previous promises to resolve.
 * @param {function(!function()))=} cancelTaker Call the methods passed to this function in order to prematurely
 * terminate the stream.
 */
export function streamGeneratedPromiseResults(
        promiseFactory,
        valueConsumer,
        errorConsumer,
        count=Infinity,
        concurrency=1,
        cancelTaker=undefined) {
    let cancelled = false;
    let startedCount = 0;
    let add = () => {
        if (cancelled) return;
        if (startedCount >= count) return;
        startedCount += 1;
        let p = promiseFactory();
        p.then(e => {
            if (cancelled) return;
            valueConsumer(e);
            add();
        }, ex => {
            cancelled = true;
            errorConsumer(ex);
        });
    };
    for (let i = 0; i < concurrency && i < count; i++) {
        add();
    }
    if (cancelTaker !== undefined) {
        cancelTaker(() => cancelled = true);
    }
}

/**
 * Stores the number of times various outcomes occurred in a series of CHSH game plays.
 *
 * Also contains utility methods for classifying outcomes.
 */
export class ChshGameOutcomeCounts {
    constructor() {
        this._counts = new Map();
    }

    static fromCountsByMap(map) {
        let result = new ChshGameOutcomeCounts();
        for (let i = 0; i < 16; i++) {
            if (map.has(i)) {
                result._counts.set(i, map.get(i));
            }
        }
        return result;
    }

    mergedWith(other) {
        let result = new ChshGameOutcomeCounts();
        for (let i = 0; i < 16; i++) {
            let t = (this._counts.has(i) ? this._counts.get(i) : 0) +
                (other._counts.has(i) ? other._counts.get(i) : 0);
            if (t > 0) {
                result._counts.set(i, t);
            }
        }
        return result;
    }

    countForCase(ref1, ref2, move1, move2) {
        let k = ChshGameOutcomeCounts.caseToKey(ref1, ref2, move1, move2);
        return this._counts.has(k) ? this._counts.get(k) : 0;
    }

    countWins() {
        let t = 0;
        for (let ref1 of [false, true]) {
            for (let ref2 of [false, true]) {
                for (let move1 of [false, true]) {
                    for (let move2 of [false, true]) {
                        if (ChshGameOutcomeCounts.caseToIsWin(ref1, ref2, move1, move2)) {
                            t += this.countForCase(ref1, ref2, move1, move2);
                        }
                    }
                }
            }
        }
        return t;
    }

    countPlays() {
        return Seq.range(16).map(i => this._counts.has(i) ? this._counts.get(i) : 0).sum();
    }

    static caseToKey(ref1, ref2, move1, move2) {
        return (ref1 ? 1 : 0) + (ref2 ? 2 : 0) + (move1 ? 4 : 0) + (move2 ? 8 : 0);
    }

    static caseToIsWin(refA, refB, moveA, moveB) {
        return (moveA !== moveB) === (refA && refB);
    }
}
