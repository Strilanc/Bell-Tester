import { asyncEval } from 'src/engine/Async.js'
import Seq from "src/base/Seq.js"

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
export function asyncEvalClassicalChshGameRuns(
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
