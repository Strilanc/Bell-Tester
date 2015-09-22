import Config from "src/Config.js"
import describe from "src/base/Describe.js"
import Seq from "src/base/Seq.js"
import Util from "src/base/Util.js"
import {
    FunctionGroup,
    delayed,
    streamGeneratedPromiseResults,
    ChshGameOutcomeCounts,
    asyncEvalChshGameRuns
} from "src/lib.js"

const ASYNC_EVAL_TIMEOUT = 2000; // millis
const SHOW_BUSY_GRACE_PERIOD = 250; // millis
const SHOW_ERR_GRACE_PERIOD = 50; // millis
const SHARED_BIT_COUNT = 16;
const GAME_RUNS_PER_CHUNK = 1000;
const RUN_CHUNK_COUNT = 100;
const RUN_CONCURRENCY = 2;


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
        () => asyncEvalChshGameRuns(s1, s2, GAME_RUNS_PER_CHUNK, ASYNC_EVAL_TIMEOUT, SHARED_BIT_COUNT, cancellorAdd),
        partialOutcomes => {
            outcomes = outcomes.mergedWith(partialOutcomes);
            let playCount = outcomes.countPlays();
            let winCount = outcomes.countWins();
            let p = winCount/playCount;
            let s = Math.sqrt(p*(1-p)/playCount);
            labelEventualSet(Promise.resolve(winCount + "/" + playCount + "; ~" + (100*p).toFixed(1) + "% (\u00B1" + (300*s).toFixed(1) + "%)"));
        },
        ex => labelEventualSet(delayed(ex, SHOW_ERR_GRACE_PERIOD)),
        RUN_CHUNK_COUNT,
        RUN_CONCURRENCY,
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
