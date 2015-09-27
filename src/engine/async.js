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
