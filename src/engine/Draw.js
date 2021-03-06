import { ChshGameOutcomeCounts } from "src/engine/ChSh.js"
import {
    FunctionGroup,
    asyncifyProgressReporter,
    streamGeneratedPromiseResults,
    delayed
} from "src/engine/Async.js"

const CELL_SPAN = 55;
const TABLE_SPAN = CELL_SPAN*4;
const HEADER_UNIT = 10;
const GAME_RUNS_PER_CHUNK = 1000;
const RUN_CHUNK_COUNT = 100;
const RUN_CONCURRENCY = 2; // Caution: chrome seems to dislike too many concurrent web workers. By crashing.
const SHOW_BUSY_GRACE_PERIOD = 250; // millis
const SHOW_ERR_GRACE_PERIOD = 500; // millis

function fillCenteredText(ctx, text, x, y, rotation=0) {
    var w = ctx.measureText(text).width;
    let h = 12;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillText(text, -w/2, h/2);
    ctx.restore();
}

/**
 * @param {!CanvasRenderingContext2D} ctx
 * @param {!ChshGameOutcomeCounts} outcomes
 * @param {!function(!string)} labelSetter
 * @param {!boolean} noWaitActuallyDoSignalling Hacky param to re-use existing code for drawing alternative game. Sorry.
 */
export function drawChshOutcomeStats(ctx, outcomes, labelSetter, noWaitActuallyDoSignalling) {
    let playCount = outcomes.countPlays();
    let winCount = outcomes.countWins();
    if (noWaitActuallyDoSignalling) {
        winCount =
            outcomes.countForCase(true, false, false, true) +
            outcomes.countForCase(true, false, true, true) +
            outcomes.countForCase(true, true, false, true) +
            outcomes.countForCase(true, true, true, true) +
            outcomes.countForCase(false, false, false, false) +
            outcomes.countForCase(false, false, true, false) +
            outcomes.countForCase(false, true, false, false) +
            outcomes.countForCase(false, true, true, false);

    }

    let mean = winCount/playCount;

    // Not really correct.. but close enough.
    let sampleMean = (winCount+1)/(playCount+2);
    let sampleStdDev = Math.sqrt(sampleMean*(1-sampleMean)/(playCount+1));
    let errorBars = 3*sampleStdDev;

    if (noWaitActuallyDoSignalling) {
        let over = (Math.max(mean, 1 - mean) - 0.5) / sampleStdDev;
        let msg1 = `~${(100*mean).toFixed(1)}% (\u00B1${(errorBars*100).toFixed(1)}%)`;
        let msg2 = `${winCount} correct out of ${playCount}`;
        let msg3 =
            over <= 1 ? 'Nope. Just noise.' :
            over <= 3 ? 'Probably Not.' /* about 1 in 6 by chance */ :
            over <= 5 ? 'Maybe. Or lucky? \u03C3>3' /* about 1 in 750 by chance */ :
            'Looks like it! \u03C3>5' /* about 1 in 30000 by chance */;
        labelSetter(msg1 + '\n' + msg2 + '\n' + msg3);
    } else {
        let over = (Math.max(mean, 1 - mean) - 0.75) / sampleStdDev;
        let msg1 = `~${(100*mean).toFixed(1)}% (\u00B1${(errorBars*100).toFixed(1)}%)`;
        let msg2 = `${winCount} wins out of ${playCount} plays`;
        let msg3 =
            over <= 1 ? 'No' :
            over <= 3 ? 'Probably Not' /* about 1 in 6 by chance */ :
            over <= 5 ? 'Maybe. Could be lucky? \u03C3>3' /* about 1 in 750 by chance */ :
            'Looks like it! \u03C3>5' /* about 1 in 30000 by chance */;
        labelSetter(msg1 + '\n' + msg2 + '\n' + msg3);
    }
    let inset = HEADER_UNIT*6;

    // Draw data.
    ctx.clearRect(0, 0, 16*CELL_SPAN+10, 16*CELL_SPAN+10);
    let numCases = noWaitActuallyDoSignalling ? 4 : 16;
    for (let i = 0; i < numCases; i++) {
        // Compute case stats.
        let move2 = (i & 1) !== 0;
        let ref2 = (i & 2) !== 0;
        let move1 = (i & 4) !== 0;
        let ref1 = (i & 8) !== 0;
        let x = inset + (i & 3) * CELL_SPAN;
        let y = inset + ((i & 0xC) >> 2) * CELL_SPAN;
        let isGoodCase = ChshGameOutcomeCounts.caseToIsWin(ref1, ref2, move1, move2);
        let caseCount = outcomes.countForCase(ref1, ref2, move1, move2);
        if (noWaitActuallyDoSignalling) {
            x = inset + (i & 1) * CELL_SPAN;
            y = inset + ((i & 2) >> 1) * CELL_SPAN;
            ref1 = (i & 2) !== 0;
            caseCount =
                outcomes.countForCase(ref1, false, false, move2) +
                outcomes.countForCase(ref1, true, false, move2) +
                outcomes.countForCase(ref1, false, true, move2) +
                outcomes.countForCase(ref1, true, true, move2);
            isGoodCase = move2 == ref1;
        }
        let casePortion = caseCount / playCount;

        // Draw cell background.
        // Note: Since the casePortion maxes out at 25%, it would be reasonable to scale this up by a factor of 4...
        //   but then the color transition can happen behind the text and that looks bad.
        let h = casePortion*CELL_SPAN;
        ctx.fillStyle = isGoodCase ? '#CFF' : '#FCC'; // Light background.
        ctx.fillRect(x, y, CELL_SPAN, CELL_SPAN);
        ctx.fillStyle = isGoodCase ? '#0CC' : '#F66'; // Darker foreground fill-in showing proportion.
        ctx.fillRect(x, y + CELL_SPAN - h, CELL_SPAN, h);

        // Draw centered cell text.
        ctx.font = "10pt Helvetica";
        let caseText = caseCount === 0 ? '' : (isGoodCase ? '' : '-') + caseCount.toString();
        ctx.fillStyle = 'black';
        fillCenteredText(ctx, caseText, x + CELL_SPAN/2, y + CELL_SPAN/2);
    }

    // Draw grid and headers.
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'black';
    for (let i of [0, 1]) {
        // Switch between row-wise and column-wise, so each is handled by the same code below.
        let name = i == 0 ? "BOB" : "ALICE";
        let print = i == 0 ?
            (t, x, y) => fillCenteredText(ctx, t, inset + x, y) :
            (t, y, x) => fillCenteredText(ctx, t, x, inset + y, -Math.PI/2);
        let line = i == 0 ?
            (x, y, dx, dy) => {
                ctx.beginPath();
                ctx.moveTo(inset + x, y);
                ctx.lineTo(inset + x + dx, y + dy);
                ctx.stroke();
            } :
            (y, x, dy, dx) => {
                ctx.beginPath();
                ctx.moveTo(x, inset + y);
                ctx.lineTo(x + dx, inset + y + dy);
                ctx.stroke();
            };

        if (noWaitActuallyDoSignalling) {
            // Dividers.
            ctx.lineWidth = 0.5;
            line(0, HEADER_UNIT*4, TABLE_SPAN/2, 0); // Divider between name / refChoice.
            line(0, HEADER_UNIT*2, TABLE_SPAN/2, 0); // Divider between refChoice / move.
            line(0, HEADER_UNIT*2, 0, HEADER_UNIT*4 + TABLE_SPAN/2); // Left border.
            line(CELL_SPAN, HEADER_UNIT*4, 0, HEADER_UNIT*2 + TABLE_SPAN/2); // Left-center column divider.
            line(TABLE_SPAN/2, HEADER_UNIT*2, 0, HEADER_UNIT*4 + TABLE_SPAN/2); // Right border.

            // Header cell text.
            ctx.font = "12pt Helvetica";
            print(name, CELL_SPAN, HEADER_UNIT);
            ctx.font = "10pt Helvetica";
            print(i == 1 ? "send" : "receive", CELL_SPAN, HEADER_UNIT*3);
            ctx.font = "8pt Helvetica";
            print("false", CELL_SPAN/2, HEADER_UNIT*5);
            print("true", CELL_SPAN + CELL_SPAN/2, HEADER_UNIT*5);
        } else {
            // Dividers.
            ctx.lineWidth = 1.5;
            line(2*CELL_SPAN, HEADER_UNIT*2, 0, HEADER_UNIT*4 + TABLE_SPAN); // Center column divider.
            ctx.lineWidth = 0.5;
            line(0, HEADER_UNIT*4, TABLE_SPAN, 0); // Divider between name / refChoice.
            line(0, HEADER_UNIT*2, TABLE_SPAN, 0); // Divider between refChoice / move.
            line(0, HEADER_UNIT*2, 0, HEADER_UNIT*4 + TABLE_SPAN); // Left border.
            line(CELL_SPAN, HEADER_UNIT*4, 0, HEADER_UNIT*2 + TABLE_SPAN); // Left-center column divider.
            line(CELL_SPAN*3, HEADER_UNIT*4, 0, HEADER_UNIT*2 + TABLE_SPAN); // Right-center column divider.
            line(TABLE_SPAN, HEADER_UNIT*2, 0, HEADER_UNIT*4 + TABLE_SPAN); // Right border.

            // Header cell text.
            ctx.font = "12pt Helvetica";
            print(name, 2*CELL_SPAN, HEADER_UNIT);
            ctx.font = "10pt Helvetica";
            print("refChoice: False", CELL_SPAN, HEADER_UNIT*3);
            print("refChoice: True", CELL_SPAN*3, HEADER_UNIT*3);
            ctx.font = "8pt Helvetica";
            print("move:false", CELL_SPAN/2, HEADER_UNIT*5);
            print("move:true", CELL_SPAN + CELL_SPAN/2, HEADER_UNIT*5);
            print("move:false", CELL_SPAN*2 + CELL_SPAN/2, HEADER_UNIT*5);
            print("move:true", CELL_SPAN*3 + CELL_SPAN/2, HEADER_UNIT*5);
        }
    }
}

/**
 * @param {!HTMLTextAreaElement} codeTextArea1
 * @param {!HTMLTextAreaElement} codeTextArea2
 * @param {!HTMLLabelElement} rateLabel
 * @param {!HTMLLabelElement} countLabel
 * @param {!HTMLLabelElement} judgementLabel
 * @param {!HTMLLabelElement} errLabel
 * @param {!HTMLDivElement} resultsDiv
 * @param {!HTMLCanvasElement} canvas
 * @param {!string} initialCode1
 * @param {!string} initialCode2
 * @param {!ChshGameOutcomeCounts} precomputedInitialOutcome
 * @param {!function(!string, !string, int, !function(!function()))} asyncGameRunner
 * @param {!boolean} noWaitActuallyDoSignalling Hacky param to re-use existing code for drawing alternative game. Sorry.
 */
export function wireGame(
        codeTextArea1,
        codeTextArea2,
        rateLabel,
        countLabel,
        judgementLabel,
        errLabel,
        resultsDiv,
        canvas,
        initialCode1,
        initialCode2,
        precomputedInitialOutcome,
        asyncGameRunner,
        noWaitActuallyDoSignalling = false) {
    codeTextArea1.value = initialCode1;
    codeTextArea2.value = initialCode2;
    let ctx = canvas.getContext('2d');
    let labelEventualSet = asyncifyProgressReporter((text, flag) => {
        if (flag) {
            let lines = text.split('\n');
            rateLabel.textContent = lines[0];
            countLabel.textContent = lines[1];
            judgementLabel.textContent = lines[2];
            errLabel.textContent = '';
            resultsDiv.style.opacity = 1;
            codeTextArea1.style.backgroundColor = 'white';
            codeTextArea2.style.backgroundColor = 'white';
        } else {
            errLabel.textContent = text;
            resultsDiv.style.opacity = 0.25;
            codeTextArea1.style.backgroundColor = 'pink';
            codeTextArea2.style.backgroundColor = 'pink';
        }
    });
    let cancellor = new FunctionGroup();
    let cancellorAdd = canceller => cancellor.add(canceller);
    let lastText1 = initialCode1;
    let lastText2 = initialCode2;
    let recompute = () => {
        let s1 = codeTextArea1.value;
        let s2 = codeTextArea2.value;
        if (lastText1 === s1 && lastText2 === s2) {
            return;
        }
        lastText1 = s1;
        lastText2 = s2;

        // Stop previous async evaluation.
        cancellor.runAndClear();

        let totalOutcomes = new ChshGameOutcomeCounts();
        streamGeneratedPromiseResults(
            () => asyncGameRunner(s1, s2, GAME_RUNS_PER_CHUNK, cancellorAdd),
            partialOutcomes => {
                totalOutcomes = totalOutcomes.mergedWith(partialOutcomes); // I miss reactive observables...
                drawChshOutcomeStats(
                    ctx,
                    totalOutcomes,
                    e => labelEventualSet(Promise.resolve(e)),
                    noWaitActuallyDoSignalling);
            },
            ex => labelEventualSet(delayed(ex, SHOW_ERR_GRACE_PERIOD, true)),
            RUN_CHUNK_COUNT,
            RUN_CONCURRENCY,
            cancellorAdd);
    };

    // Recompute when the entered code changes.
    const textAreaChangeEvents = ['change', 'keydown', 'keypress', 'paste', 'keyup'];
    for (let t of [codeTextArea1, codeTextArea2]) {
        for (let e of textAreaChangeEvents) {
            t.addEventListener(e, recompute);
        }
    }

    // Show a default result on startup (instead of applying any compute load).
    drawChshOutcomeStats(
        ctx,
        precomputedInitialOutcome,
        e => labelEventualSet(Promise.resolve(e)),
        noWaitActuallyDoSignalling);
}
