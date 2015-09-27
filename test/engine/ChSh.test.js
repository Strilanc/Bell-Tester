import {
    Suite,
    assertThat,
    assertThrows,
    assertTrue,
    assertFalse,
    willResolveTo,
    willReject,
    promiseEventLoopYielder
} from "test/TestUtil.js"

import {
    ChshGameOutcomeCounts,
    asyncEvalClassicalChshGameRuns
} from "src/engine/ChSh.js"

import Seq from "src/base/Seq.js"

let suite = new Suite("lib");

suite.test("ChshGameOutcomeCounts_new", () => {
    let n = new ChshGameOutcomeCounts();
    assertThat(n.countPlays()).isEqualTo(0);
    assertThat(n.countWins()).isEqualTo(0);
    assertThat(n.countForCase(false, false, false, false)).isEqualTo(0);
});

suite.test("ChshGameOutcomeCounts_caseToKey", () => {
    let a = ChshGameOutcomeCounts.caseToKey(false, false, false, false);
    let b1 = ChshGameOutcomeCounts.caseToKey(true, false, false, false);
    let b2 = ChshGameOutcomeCounts.caseToKey(false, true, false, false);
    let b3 = ChshGameOutcomeCounts.caseToKey(false, false, true, false);
    let b4 = ChshGameOutcomeCounts.caseToKey(false, false, false, true);
    assertThat(a).isNotEqualTo(b1);
    assertThat(a).isNotEqualTo(b2);
    assertThat(a).isNotEqualTo(b3);
    assertThat(a).isNotEqualTo(b4);
});

suite.test("ChshGameOutcomeCounts_caseToIsWin", () => {
    let W = true;
    let _ = false;
    let wins = [
        W, _, W, _,
        _, W, _, W,
        W, _, _, W,
        _, W, W, _
    ];
    for (let i = 0; i < 16; i++) {
        assertThat(ChshGameOutcomeCounts.caseToIsWin(
            (i & 2) !== 0, //ref1
            (i & 8) !== 0, //ref2
            (i & 1) !== 0, //move1
            (i & 4) !== 0 // move2
        )).isEqualTo(wins[i]);
    }
});

suite.test("ChshGameOutcomeCounts_fromCountsByMap", () => {
    for (let ref1 of [false, true]) {
        for (let ref2 of [false, true]) {
            for (let move1 of [false, true]) {
                for (let move2 of [false, true]) {
                    let k = ChshGameOutcomeCounts.caseToKey(ref1, ref2, move1, move2);
                    let n = ChshGameOutcomeCounts.fromCountsByMap(new Map([[k, 1]]))
                    let w = ChshGameOutcomeCounts.caseToIsWin(ref1, ref2, move1, move2);
                    assertThat(n.countForCase(ref1, ref2, move1, move2)).isEqualTo(1);
                    assertThat(n.countForCase(!ref1, ref2, move1, move2)).isEqualTo(0);
                    assertThat(n.countForCase(ref1, !ref2, move1, move2)).isEqualTo(0);
                    assertThat(n.countForCase(ref1, ref2, !move1, move2)).isEqualTo(0);
                    assertThat(n.countForCase(ref1, ref2, move1, !move2)).isEqualTo(0);
                    assertThat(n.countWins()).isEqualTo(w ? 1 : 0);
                    assertThat(n.countPlays()).isEqualTo(1);
                }
            }
        }
    }
});

suite.test("ChshGameOutcomeCounts_mergedWith", () => {
    let k1 = ChshGameOutcomeCounts.caseToKey(false, false, false, false);
    let k2 = ChshGameOutcomeCounts.caseToKey(true, true, true, true);
    let n1 = ChshGameOutcomeCounts.fromCountsByMap(new Map([[k1, 2]]));
    let n2 = ChshGameOutcomeCounts.fromCountsByMap(new Map([[k2, 3]]));

    let n3 = n1.mergedWith(n2);
    assertThat(n3.countForCase(false, false, false, false)).isEqualTo(2);
    assertThat(n3.countForCase(true, true, true, true)).isEqualTo(3);
    assertThat(n3.countPlays()).isEqualTo(5);

    let n4 = n3.mergedWith(n2);
    assertThat(n4.countForCase(false, false, false, false)).isEqualTo(2);
    assertThat(n4.countForCase(true, true, true, true)).isEqualTo(6);
    assertThat(n4.countPlays()).isEqualTo(8);
});

suite.test("ChshGameOutcomeCounts_isEqualTo", () => {
    let k1 = ChshGameOutcomeCounts.caseToKey(false, false, false, false);
    let k2 = ChshGameOutcomeCounts.caseToKey(true, true, true, true);
    let n1 = () => ChshGameOutcomeCounts.fromCountsByMap(new Map([[k1, 2]]));
    let n2 = () => ChshGameOutcomeCounts.fromCountsByMap(new Map([[k2, 3]]));
    let n3 = () => ChshGameOutcomeCounts.fromCountsByMap(new Map([[k2, 2]]));
    let groups = [
        [new ChshGameOutcomeCounts(), new ChshGameOutcomeCounts()],
        [n1(), n1()],
        [n2(), n2()],
        [n3(), n3()],
        [n2().mergedWith(n3()), n2().mergedWith(n3())]
    ];
    for (let g1 of groups) {
        for (let g2 of groups) {
            for (let e1 of g1) {
                for (let e2 of g2) {
                    assertThat(e1.isEqualTo(e2)).isEqualTo(g1 === g2);
                }
            }
        }
    }

    // interop works?
    assertThat(new ChshGameOutcomeCounts()).isEqualTo(new ChshGameOutcomeCounts());
});

suite.test("asyncEvalClassicalChshGameRuns", () => {
    let out = s => ChshGameOutcomeCounts.fromCountsByMap(
        new Seq(s).countBy(i => ChshGameOutcomeCounts.caseToKey(i & 1, i & 2, i & 4, i & 8)));
    let c = [];
    let r = Promise.all([
        willResolveTo(asyncEvalClassicalChshGameRuns("move=false", "move=false", 4), out([0, 1, 2, 3])),
        willResolveTo(asyncEvalClassicalChshGameRuns("move=false", "move=true", 4), out([8, 9, 10, 11])),
        willResolveTo(asyncEvalClassicalChshGameRuns("move=refChoice", "move=true", 4), out([8, 13, 10, 15])),
        willResolveTo(asyncEvalClassicalChshGameRuns("move=refChoice", "move=true", 8),
            out([8, 8, 13, 13, 10, 10, 15, 15])),
        // Timeout.
        willReject(asyncEvalClassicalChshGameRuns("while(true);", "move=true", 1, 10)),
        // Parse error.
        willReject(asyncEvalClassicalChshGameRuns("{", "move=true", 1)),
        // Throw.
        willReject(asyncEvalClassicalChshGameRuns("throw 1;", "move=true", 1)),
        // Cancellation.
        willReject(asyncEvalClassicalChshGameRuns("while(true);", "move=true", 1, Infinity, 16, e => c.push(e)))
    ]);
    for (let e of c) e();
    return r;
});
