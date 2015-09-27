import Seq from "src/base/Seq.js"

/**
 * Returns a promise for the result of using a web worker to eval the given string as code.
 *
 * Note that this is NOT intended to be used as a secure sandbox for safely running potentially malicious code.
 *
 * @param {!string} codeText The string passed to 'eval' in the web worker.
 * @param {!number=} timeout The maximum number of milliseconds the web worker is allowed to run before being terminated. Pass
 * 'Infinity' if you don't want a timeout.
 * @param {!function(!function(void):void):void=} cancelTaker A function that accepts cancellers for the async eval;
 * running the functions passed to the cancelTaker function will cancel the asyncEval.
 */
export function asyncEval(codeText, timeout=Infinity, cancelTaker=undefined) {
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

        if (cancelTaker !== undefined) {
            cancelTaker(() => {
                reject('Cancelled');
                cleanup();
            });
        }
    });
}

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
 * @param {boolean} rejectInsteadOfResolving Cause the promise to reject with the given value, instead of resolving.
 * @returns {!Promise.<T>}
 * @template T
 */
export function delayed(value, delayMillis, rejectInsteadOfResolving=false) {
    return new Promise((resolve, reject) =>
        setTimeout(() => (rejectInsteadOfResolving ? reject : resolve)(value), delayMillis));
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

    isEqualTo(other) {
        if (!(other instanceof ChshGameOutcomeCounts)) {
            return false;
        }
        for (let i = 0; i < 16; i++) {
            if (this._counts.get(i) !== other._counts.get(i)) {
                return false;
            }
        }
        return true;
    }
}

/**
 * Uses isolated web workers to run a CHSH game with custom evaluated player code the given number of times.
 *
 * @param {!string} code1 Code defining player 1's strategy. The code should set 'move' to true or false, based on the
 * value of the boolean 'refChoice' and the array 'sharedBits'.
 * @param {!string} code2 Code defining player 2's strategy. The code should set 'move' to true or false, based on the
 * value of the boolean 'refChoice' and the array 'sharedBits'.
 * @param {int=} count The number of times to play the game.
 * evaluation and cleanup related resources (e.g. terminate the web workers).
 * @param {number=} timeoutMillis The amount of time to wait for the web workers to complete, before terminating them.
 * @param {int=} sharedBitCount The number of shared bits available to each player (i.e. the length of sharedBits).
 * @param {!function(!function())=} cancelTaker Run the functions given to this function to cancel the asynchronous
 * @returns {Promise.<ChshGameOutcomeCounts>}
 */
export function asyncEvalChshGameRuns(
        code1,
        code2,
        count=1,
        timeoutMillis=Infinity,
        sharedBitCount=16,
        cancelTaker=undefined) {
    if (!(sharedBitCount > 0 && sharedBitCount < 53)) throw RangeError("sharedBitCount");

    let worldsWorstSandbox = code => `(function() { eval(${JSON.stringify(code)}); }());`;

    // Note: not guaranteed protection. The web worker could have access to the same entropy or to reflection.
    let dontTouchMyStuffSuffix = Seq.range(10).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    let pk = `__i_${dontTouchMyStuffSuffix}`;
    let pb = `__shared_${dontTouchMyStuffSuffix}`;
    let pm = `__moves_${dontTouchMyStuffSuffix}`;

    let allSharedBitsArrayText = JSON.stringify(Seq.range(count).
        map(() => Math.floor(Math.random() * (1 << sharedBitCount))).
        toArray());

    let wrapCode = (code, refCoinMask) => `
        var ${pb} = ${allSharedBitsArrayText};
        var ${pm} = [];
        for (var ${pk} = 0; ${pk} < ${count}; ${pk}++) {
            var sharedBits = [];
            var i;
            for (i = 0; i < ${sharedBitCount}; i++) {
                sharedBits.push((${pb}[${pk}] & (1 << i)) !== 0);
            }
            i = undefined;

            // By cycling through the cases, instead of choosing randomly, we get much more even coverage.
            // In particular, when the strategy is deterministic this guarantees we get the exact expected value.
            // (As long as the number of plays is a multiple of 4.)
            var refChoice = (${pk} & ${refCoinMask}) !== 0;

            // Be forgiving.
            var refchoice = refChoice;
            var ref_choice = refChoice;
            var sharedbits = sharedBits;
            var shared_bits = sharedBits;
            var True = true;
            var False = false;

            var move = undefined;
            ${worldsWorstSandbox(code)}

            // Loose equality is on purpose, so people entering 'x ^ y' don't get an error.
            if (!(move == true) && !(move == false)) {
                throw new Error("'move' variable ended up " + move + " instead of true or false");
            }
            ${pm}.push(move == true);
        };
        ${pm};
        `;

    let wrapCode1 = wrapCode(code1, 1);
    let wrapCode2 = wrapCode(code2, 2);
    let results1 = asyncEval(wrapCode1, timeoutMillis, cancelTaker);
    let results2 = asyncEval(wrapCode2, timeoutMillis, cancelTaker);
    return Promise.all([results1, results2]).then(moves => {
        if (!Array.isArray(moves[0]) ||
            !Array.isArray(moves[1]) ||
            moves[0].length !== count ||
            moves[1].length !== count) {
            throw new RangeError("Corrupted moves.")
        }
        return ChshGameOutcomeCounts.fromCountsByMap(Seq.range(count).map(i => {
            let refCoin1 = (i & 1) !== 0;
            let refCoin2 = (i & 2) !== 0;
            let move1 = moves[0][i] === true;
            let move2 = moves[1][i] === true;
            return ChshGameOutcomeCounts.caseToKey(refCoin1, refCoin2, move1, move2);
        }).countBy(e => e));
    });
}

/**
 * Returns a wrapped version of the given progress reporting function that takes promises instead of raw values and
 * ensures that progress on earlier promises is ignored once more recent promise results are available.
 *
 * @param {!function(T, boolean)} progressReporter
 * @returns !function(!Promise.<T>)
 * @template T
 */
export function asyncifyProgressReporter(progressReporter) {
    let latestCompletedId = 0;
    let nextId = 1; // 16 bit cyclic counter.
    return promise => {
        let id = nextId;
        nextId = (nextId + 1) & 0xFFFF;
        promise.then(e => {
            // Never switch to an older result from a more recent one.
            let isLate = ((latestCompletedId - id) & 0xFFFF) < 0x8FFF;
            if (isLate) return;
            latestCompletedId = id;
            progressReporter(e, true);
        }, ex => {
            // Never switch to showing an error that's already stale.
            let isNotLatestSet = ((id + 1) & 0xFFFF) !== nextId;
            if (isNotLatestSet) return;
            latestCompletedId = id;
            progressReporter(ex, false);
        });
    };
}
