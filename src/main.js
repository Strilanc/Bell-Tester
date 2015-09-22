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
const SHARED_BIT_COUNT = 16; // number of shared classical bits given to each player
const GAME_RUNS_PER_CHUNK = 1000;
const RUN_CHUNK_COUNT = 100;
const RUN_CONCURRENCY = 2; // Caution: chrome seems to dislike too many concurrent web workers. By crashing.
const TABLE_CELL_SPAN = 50;


let setterToPromiseRatchet = setter => {
    let latestCompletedId = 0;
    let nextId = 1;
    return promise => {
        let id = nextId;
        nextId = (nextId + 1) & 0xFFFF;
        promise.then(e => {
            // Never switch to an older result from a more recent one.
            let isLate = ((latestCompletedId - id) & 0xFFFF) < 0x8FFF;
            if (isLate) return;
            latestCompletedId = id;
            setter(e);
        }, ex => {
            // Never switch to showing an error that's already stale.
            let isNotLatestSet = ((id + 1) & 0xFFFF) !== nextId;
            if (isNotLatestSet) return;
            latestCompletedId = id;
            setter(ex);
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
            let sampleStdDev = Math.sqrt(p*(1-p)/Math.max(1, playCount-1));
            let tolerance = 3*sampleStdDev;
            let msg = `${winCount}/${playCount}; ~${(100*p).toFixed(1)}% (\u00B1${(tolerance*100).toFixed(1)}%)`;
            let canvas = document.getElementById("drawCanvas");
            let ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, 4*TABLE_CELL_SPAN+10, 4*TABLE_CELL_SPAN+10);
            for (let i = 0; i < 16; i++) {
                let ref1 = (i & 2) !== 0;
                let ref2 = (i & 8) !== 0;
                let move1 = (i & 1) !== 0;
                let move2 = (i & 4) !== 0;
                let m = outcomes.countForCase(ref1, ref2, move1, move2);
                let b = ChshGameOutcomeCounts.caseToIsWin(ref1, ref2, move1, move2);
                let q = 4 * m / playCount;
                let h = q*TABLE_CELL_SPAN;
                let x = (i & 3) * TABLE_CELL_SPAN;
                let y = ((i & 0xC) >> 2) * TABLE_CELL_SPAN;
                ctx.fillStyle = b ? '#CFC' : '#FCC';
                ctx.fillRect(x, y, TABLE_CELL_SPAN, TABLE_CELL_SPAN);
                ctx.fillStyle = b ? '#0F0' : '#F66';
                ctx.fillRect(x, y + TABLE_CELL_SPAN - h, TABLE_CELL_SPAN, h);
                ctx.font = "10pt Helvetica";
                let s = m.toString();
                ctx.fillStyle = 'black';
                ctx.fillText(s, x + TABLE_CELL_SPAN/2 - ctx.measureText(s).width/2, y + TABLE_CELL_SPAN/2 + 6);
            }
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i*TABLE_CELL_SPAN);
                ctx.lineTo(4*TABLE_CELL_SPAN, i*TABLE_CELL_SPAN);
                ctx.moveTo(i*TABLE_CELL_SPAN, 0);
                ctx.lineTo(i*TABLE_CELL_SPAN, 4*TABLE_CELL_SPAN);
                ctx.lineWidth = i === 2 ? 2 : 0.5;
                ctx.stroke();
            }
            labelEventualSet(Promise.resolve(msg));
        },
        ex => labelEventualSet(delayed(ex, SHOW_ERR_GRACE_PERIOD, true)),
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
