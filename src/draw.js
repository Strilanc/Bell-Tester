import { ChshGameOutcomeCounts } from "src/lib.js"

const CELL_SPAN = 75;
const TABLE_SPAN = CELL_SPAN*4;
const HEADER_UNIT = 10;

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
 */
export function drawOutcomeStats(ctx, outcomes, labelSetter) {
    let playCount = outcomes.countPlays();
    let winCount = outcomes.countWins();
    let mean = winCount/playCount;
    let sampleStdDev = Math.sqrt(mean*(1-mean)/Math.max(1, playCount-1));
    let errorBars = 3*sampleStdDev;  // Not really appropriate.. but close enough.
    let msg = `${winCount}/${playCount}; ~${(100*mean).toFixed(1)}% (\u00B1${(errorBars*100).toFixed(1)}%)`;
    labelSetter(msg);

    let inset = HEADER_UNIT*7;

    ctx.clearRect(0, 0, 16*CELL_SPAN+10, 16*CELL_SPAN+10);
    for (let i = 0; i < 16; i++) {
        // Compute case stats.
        let move1 = (i & 1) !== 0;
        let ref1 = (i & 2) !== 0;
        let move2 = (i & 4) !== 0;
        let ref2 = (i & 8) !== 0;
        let x = inset + (i & 3) * CELL_SPAN;
        let y = inset + ((i & 0xC) >> 2) * CELL_SPAN;
        let caseCount = outcomes.countForCase(ref1, ref2, move1, move2);
        let isGoodCase = ChshGameOutcomeCounts.caseToIsWin(ref1, ref2, move1, move2);
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
        let caseText = (isGoodCase ? '' : '-') + caseCount.toString();
        ctx.fillStyle = 'black';
        fillCenteredText(ctx, caseText, x + CELL_SPAN/2, y + CELL_SPAN/2);
    }

    // Draw grid and legend.
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'black';
    ctx.font = "12pt Helvetica";
    fillCenteredText(ctx, "Measured", inset/2, inset/2, -Math.PI/4);
    fillCenteredText(ctx, "Hits", inset*0.65, inset*0.65, -Math.PI/4);
    for (let i of [0, 1]) {
        let name = i == 0 ? "ALICE" : "BOB";
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

        ctx.lineWidth = 1.5;
        line(2*CELL_SPAN, HEADER_UNIT*3, 0, HEADER_UNIT*4 + TABLE_SPAN); // Center column divider.

        ctx.lineWidth = 0.5;
        line(0, HEADER_UNIT*5, TABLE_SPAN, 0); // Divider between name / refChoice.
        line(0, HEADER_UNIT*3, TABLE_SPAN, 0); // Divider between refChoice / move.
        line(0, HEADER_UNIT*3, 0, HEADER_UNIT*4 + TABLE_SPAN); // Left border.
        line(CELL_SPAN, HEADER_UNIT*5, 0, HEADER_UNIT*2 + TABLE_SPAN); // Left-center column divider.
        line(CELL_SPAN*3, HEADER_UNIT*5, 0, HEADER_UNIT*2 + TABLE_SPAN); // Right-center column divider.
        line(TABLE_SPAN, HEADER_UNIT*3, 0, HEADER_UNIT*4 + TABLE_SPAN); // Right border.

        ctx.font = "16pt Helvetica";
        print(name, 2*CELL_SPAN, HEADER_UNIT*2);
        ctx.font = "10pt Helvetica";
        print("refChoice=False", CELL_SPAN, HEADER_UNIT*4);
        print("refChoice=True", CELL_SPAN*3, HEADER_UNIT*4);
        ctx.font = "8pt Helvetica";
        print("move=False", CELL_SPAN/2, HEADER_UNIT*6);
        print("move=True", CELL_SPAN + CELL_SPAN/2, HEADER_UNIT*6);
        print("move=False", CELL_SPAN*2 + CELL_SPAN/2, HEADER_UNIT*6);
        print("move=True", CELL_SPAN*3 + CELL_SPAN/2, HEADER_UNIT*6);
    }
}
