import {
    FunctionGroup,
    delayed,
    streamGeneratedPromiseResults,
    ChshGameOutcomeCounts,
    asyncEvalChshGameRuns,
    asyncifyProgressReporter
} from 'src/engine/lib.js'
import { drawOutcomeStats } from 'src/engine/draw.js'

const ASYNC_EVAL_TIMEOUT = 2000; // millis
const SHOW_BUSY_GRACE_PERIOD = 250; // millis
const SHOW_ERR_GRACE_PERIOD = 500; // millis
const SHARED_BIT_COUNT = 16; // number of shared classical bits given to each player
const GAME_RUNS_PER_CHUNK = 1000;
const RUN_CHUNK_COUNT = 100;
const RUN_CONCURRENCY = 2; // Caution: chrome seems to dislike too many concurrent web workers. By crashing.

let textArea1 = document.getElementById('srcTextArea1');
let textArea2 = document.getElementById('srcTextArea2');
let rateLabel = document.getElementById('rateLabel');
let countLabel = document.getElementById('countLabel');
let judgementLabel = document.getElementById('judgementLabel');
let resultsDiv = document.getElementById('resultsDiv');
let errLabel = document.getElementById('errorLabel');
let canvas = document.getElementById('drawCanvas');
let ctx = canvas.getContext('2d');

// Set up recomputation engine and have it output to UI.
let labelEventualSet = asyncifyProgressReporter((text, flag) => {
    if (flag) {
        let lines = text.split('\n');
        rateLabel.textContent = lines[0];
        countLabel.textContent = lines[1];
        judgementLabel.textContent = lines[2];
        errLabel.textContent = '';
        resultsDiv.style.opacity = 1;
        textArea1.style.backgroundColor = 'white';
        textArea2.style.backgroundColor = 'white';
    } else {
        errLabel.textContent = text;
        resultsDiv.style.opacity = 0.25;
        textArea1.style.backgroundColor = 'pink';
        textArea2.style.backgroundColor = 'pink';
    }
});
let cancellor = new FunctionGroup();
let cancellorAdd = canceller => cancellor.add(canceller);
let lastText1 = undefined;
let lastText2 = undefined;
let recompute = () => {
    let s1 = textArea1.value;
    let s2 = textArea2.value;
    if (lastText1 === s1 && lastText2 === s2) {
        return;
    }
    lastText1 = s1;
    lastText2 = s2;

    // Stop previous async evaluation.
    cancellor.runAndClear();

    let quickExperimenter = () => asyncEvalChshGameRuns(
        s1,
        s2,
        GAME_RUNS_PER_CHUNK,
        ASYNC_EVAL_TIMEOUT,
        SHARED_BIT_COUNT,
        cancellorAdd);

    let totalOutcomes = new ChshGameOutcomeCounts();
    streamGeneratedPromiseResults(
        quickExperimenter,
        partialOutcomes => {
            totalOutcomes = totalOutcomes.mergedWith(partialOutcomes); // I miss reactive observables...
            drawOutcomeStats(ctx, totalOutcomes, e => labelEventualSet(Promise.resolve(e)));
        },
        ex => labelEventualSet(delayed(ex, SHOW_ERR_GRACE_PERIOD, true)),
        RUN_CHUNK_COUNT,
        RUN_CONCURRENCY,
        cancellorAdd);
};

// Wire UI events into to engine.
const textAreaChangeEvents = ['change', 'keydown', 'keypress', 'paste', 'keyup'];
for (let t of [textArea1, textArea2]) {
    for (let e of textAreaChangeEvents) {
        t.addEventListener(e, recompute);
    }
}
recompute();
