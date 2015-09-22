import Config from "src/Config.js"
import describe from "src/base/Describe.js"
import Seq from "src/base/Seq.js"
import Util from "src/base/Util.js"
import { FunctionGroup, delayed, streamGeneratedPromiseResults, ChshGameOutcomeCounts } from "src/lib.js";

const ASYNC_EVAL_TIMEOUT = 2000; // millis
const SHOW_BUSY_GRACE_PERIOD = 250; // millis
const SHOW_ERR_GRACE_PERIOD = 50; // millis
const SHARED_BIT_COUNT = 16;

let worldsWorstSandbox = code => `(function() { eval(${JSON.stringify(code)}); }());`;

let runGameManyTimes = (code1, code2, count, cancelTaker) => {
    // Note: not guaranteed protection. The web worker could have access to the same entropy or to reflection.
    let dontTouchMyStuffSuffix = Seq.range(10).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    let pk = `__i_${dontTouchMyStuffSuffix}`;
    let pb = `__shared_${dontTouchMyStuffSuffix}`;
    let pm = `__moves_${dontTouchMyStuffSuffix}`;

    let allSharedBitsArrayText = describe(Seq.range(count).
        map(() => Math.floor(Math.random() * (1 << SHARED_BIT_COUNT))).
        toArray());

    let wrapCode = (code, refCoinMask) => `
        var ${pb} = ${allSharedBitsArrayText};
        var ${pm} = [];
        for (var ${pk} = 0; ${pk} < ${count}; ${pk}++) {
            var sharedBits = [];
            var i;
            for (i = 0; i < ${SHARED_BIT_COUNT}; i++) {
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

            var move = undefined;
            ${worldsWorstSandbox(code)}

            // Loose equality is on purpose, so people entering 'x ^ y' don't get an error.
            if (!(move == true) && !(move == false)) {
                throw new Error("move ended up " + move + " instead of true or false");
            }
            ${pm}.push(move == true);
        };
        ${pm};
        `;

    let wrapCode1 = wrapCode(code1, 1);
    let wrapCode2 = wrapCode(code2, 2);
    let results1 = Util.asyncEval(wrapCode1, ASYNC_EVAL_TIMEOUT, cancelTaker);
    let results2 = Util.asyncEval(wrapCode2, ASYNC_EVAL_TIMEOUT, cancelTaker);
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
};

let setterToPromiseRatchet = setter => {
    let latestCompletedId = 0;
    let nextId = 1;
    return promise => {
        let id = nextId;
        nextId = (nextId + 1) & 0xFFFF;
        promise.then(e => {
            // http://algorithmicassertions.com/math/2014/03/11/Ordering-Cyclic-Sequence-Numbers.html
            let isLate = ((latestCompletedId - id) & 0xFFFF) < 0x8FFF;
            if (isLate) return;
            latestCompletedId = id;
            setter(e);
        });
    };
};

let textArea1 = document.getElementById("srcTextArea1");
let textArea2 = document.getElementById("srcTextArea2");
let label = document.getElementById("lblResults");

let labelEventualSet = setterToPromiseRatchet(text => label.textContent = text);
let cancellor = new FunctionGroup();
let cancellorAdd = canceller => cancellor.add(canceller);
let lastText1 = undefined;
let lastText2 = undefined;
let ref = () => {
    let s1 = textArea1.value;
    let s2 = textArea2.value;
    if (lastText1 === s1 && lastText2 === s2) {
        return;
    }
    lastText1 = s1;
    lastText2 = s2;

    cancellor.runAndClear();

    let outcomes = new ChshGameOutcomeCounts();

    streamGeneratedPromiseResults(
        () => runGameManyTimes(s1, s2, 1000, cancellorAdd),
        partialOutcomes => {
            outcomes = outcomes.mergedWith(partialOutcomes);
            let playCount = outcomes.countPlays();
            let winCount = outcomes.countWins();
            let p = winCount/playCount;
            let s = Math.sqrt(p*(1-p)/playCount);
            labelEventualSet(Promise.resolve(winCount + "/" + playCount + "; ~" + (100*p).toFixed(1) + "% (\u00B1" + (300*s).toFixed(1) + "%)"));
        },
        ex => labelEventualSet(delayed(ex, SHOW_ERR_GRACE_PERIOD)),
        100,
        2,
        cancellorAdd);
};

textArea1.addEventListener("change", ref);
textArea1.addEventListener("keydown", ref);
textArea1.addEventListener("keypress", ref);
textArea1.addEventListener("paste", ref);
textArea1.addEventListener("keyup", ref);
textArea2.addEventListener("change", ref);
textArea2.addEventListener("keydown", ref);
textArea2.addEventListener("keypress", ref);
textArea2.addEventListener("paste", ref);
textArea2.addEventListener("keyup", ref);
ref();
