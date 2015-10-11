import { asyncEval } from 'src/engine/Async.js'
import Seq from "src/base/Seq.js"
import { ROTATE_FUNC_STRING, MEASURE_FUNC_STRING } from "src/engine/Superposition.js"

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

    // Note: not guaranteed protection. The web worker could have access to the same entropy or to reflection.
    let dontTouchMyStuffSuffix = Seq.range(10).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    let round = `__i_${dontTouchMyStuffSuffix}`;
    let allSharedBits = `__shared_${dontTouchMyStuffSuffix}`;
    let moves = `__moves_${dontTouchMyStuffSuffix}`;
    let rand = `__rand_${dontTouchMyStuffSuffix}`;

    let allSharedBitsArrayText = JSON.stringify(Seq.range(count).
        map(() => Math.floor(Math.random() * (1 << sharedBitCount))).
        toArray());

    // Avoid revealing the suffix of the other items via 'this.constructor.toString()'.
    let dontTouchMyStuffSuffix2 = Seq.range(10).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    let CustomType = `__custom_type__${dontTouchMyStuffSuffix2}`;

    let wrapCode = (code, refCoinMask) => `
        function ${CustomType}() {}
        ${CustomType}.prototype.invokeCode = function(refChoice, sharedBits) {
            // Be forgiving.
            var refchoice = refChoice;
            var ref_choice = refChoice;
            var sharedbits = sharedBits;
            var shared_bits = sharedBits;
            var True = true;
            var False = false;

            var move = undefined;

            eval(${JSON.stringify(code)});

            // Loose equality is on purpose, so people entering 'x ^ y' don't get an error.
            if (!(move == true) && !(move == false)) {
                throw new Error("'move' variable ended up " + move + " instead of true or false");
            }
            return move == true;
        };
        (function() {
            var ${allSharedBits} = ${allSharedBitsArrayText};
            var ${moves} = [];
            var ${rand} = Math.random;
            for (var ${round} = 0; ${round} < ${count}; ${round}++) {
                var sharedBits = [];
                var i;
                for (i = 0; i < ${sharedBitCount}; i++) {
                    sharedBits.push((${allSharedBits}[${round}] & (1 << i)) !== 0);
                }
                i = undefined;

                var refChoice = ${rand}() < 0.5;
                ${moves}.push(refChoice);
                ${moves}.push(new ${CustomType}().invokeCode(refChoice, sharedBits));
            };
            return ${moves};
        })()`;

    let wrapCode1 = wrapCode(code1, 1);
    let wrapCode2 = wrapCode(code2, 2);
    let results1 = asyncEval(wrapCode1, timeoutMillis, cancelTaker);
    let results2 = asyncEval(wrapCode2, timeoutMillis, cancelTaker);
    return Promise.all([results1, results2]).then(moves => {
        if (!Array.isArray(moves[0]) ||
            !Array.isArray(moves[1]) ||
            moves[0].length !== count*2 ||
            moves[1].length !== count*2) {
            throw new RangeError("Corrupted moves.")
        }
        return ChshGameOutcomeCounts.fromCountsByMap(Seq.range(count).map(i => {
            let refCoin1 = moves[0][i*2] === true;
            let refCoin2 = moves[1][i*2] === true;
            let move1 = moves[0][i*2+1] === true;
            let move2 = moves[1][i*2+1] === true;
            return ChshGameOutcomeCounts.caseToKey(refCoin1, refCoin2, move1, move2);
        }).countBy(e => e));
    });
}

export function asyncEvalQuantumChshGameRuns(
        code1,
        code2,
        count=1,
        timeoutMillis=Infinity,
        cancelTaker=undefined) {

    // The name of the game is: fail at isolating two chunks of code from each other despite running them in the same
    // context! The inevitable outcome of the game is... losing despite trying!

    // e.g. "move = Date.x = refChoice" with "move = Date.x && !refChoice"

    let dontTouchMyStuffSuffix = Seq.range(10).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    let round = `__i_${dontTouchMyStuffSuffix}`;
    let moves = `__moves_${dontTouchMyStuffSuffix}`;
    let rotateFunc = `__rotate_${dontTouchMyStuffSuffix}`;
    let measureFunc = `__measure_${dontTouchMyStuffSuffix}`;
    let amplitudes = `__amps_${dontTouchMyStuffSuffix}`;
    let rand = `__rand_${dontTouchMyStuffSuffix}`;
    let sqrt = `__sqrt_${dontTouchMyStuffSuffix}`;
    let float32Array = `__float32array_${dontTouchMyStuffSuffix}`;

    // Avoid revealing the suffix of the other items via 'this.constructor.toString()'.
    let dontTouchMyStuffSuffix2 = Seq.range(10).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    let CustomType = `__custom_type__${dontTouchMyStuffSuffix2}`;

    let createInvokeFunction = (code, i) => `
        ${CustomType}.prototype.invokeCode${i} = function(refChoice) {
            // Available rotation axies.
            var X = [1, 0, 0];
            var Y = [0, 1, 0];
            var Z = [0, 0, 1];
            var H = [Math.sqrt(0.5), 0, Math.sqrt(0.5)];

            // Available actions.
            var measure = function() {
                return ${measureFunc}(${amplitudes}, ${i});
            };
            var turn = function(axis, degs) {
                if (axis.length !== 3) throw new Error("First arg to 'turn' should be a rotation axis (X/Y/Z/H).");
                return ${rotateFunc}(${amplitudes}, ${i}, axis, (degs === undefined ? 180 : degs)*Math.PI/180, []);
            };

            // Be forgiving.
            var refchoice = refChoice;
            var ref_choice = refChoice;
            var True = true;
            var False = false;

            var move = undefined;

            //Easter egg.
            var sharedQubit = "containing a spooky ghost of Eisteinian proportions";
            var sharedQubits = [sharedQubit];

            eval(${JSON.stringify(code)});

            // Loose equality is on purpose, so people entering 'x ^ y' don't get an error.
            if (!(move == true) && !(move == false)) {
                throw new Error("'move' variable ended up " + move + " instead of true or false");
            }
            return move == true;
        };`;

    let wrappedCode = `
        var ${amplitudes};
        var ${rand} = Math.random;
        var ${sqrt} = Math.sqrt;
        var ${rotateFunc} = ${ROTATE_FUNC_STRING.replace("Math.random", rand).replace("Math.sqrt", sqrt)};
        var ${measureFunc} = ${MEASURE_FUNC_STRING.replace("Math.random", rand).replace("Math.sqrt", sqrt)};
        function ${CustomType}() {}
        ${createInvokeFunction(code1, 0)};
        ${createInvokeFunction(code2, 1)};
        (function() {
            // Stash functions that user code can re-assign.
            var ${float32Array} = Float32Array;

            var ${round} = 0;
            var ${moves} = [];
            for (; ${round} < ${count}; ${round}++) {
                // Create pre-shared entangled 00+11 state.
                ${amplitudes} = new ${float32Array}(2 << 2);
                ${amplitudes}[0] = ${sqrt}(0.5);
                ${amplitudes}[6] = ${sqrt}(0.5);

                // Note: order shouldn't matter.
                // Also, because these are run in the same web worker, it's much easier for them to cheat..
                var refChoice1 = ${rand}() < 0.5;
                var refChoice2 = ${rand}() < 0.5;
                ${moves}.push(refChoice1);
                ${moves}.push(refChoice2);
                ${moves}.push(new ${CustomType}().invokeCode0(refChoice1));
                ${moves}.push(new ${CustomType}().invokeCode1(refChoice2));
            };
            return ${moves};
        })();`;

    let results = asyncEval(wrappedCode, timeoutMillis, cancelTaker);
    return results.then(moves => {
        if (!Array.isArray(moves) || moves.length !== 4*count) {
            throw new RangeError("Corrupted moves.")
        }
        return ChshGameOutcomeCounts.fromCountsByMap(Seq.range(count).map(i => {
            let refCoin1 = moves[4*i] === true;
            let refCoin2 = moves[4*i + 1] === true;
            let move1 = moves[4*i + 2] === true;
            let move2 = moves[4*i + 3] === true;
            return ChshGameOutcomeCounts.caseToKey(refCoin1, refCoin2, move1, move2);
        }).countBy(e => e));
    });
}
