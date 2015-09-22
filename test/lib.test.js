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

import { FunctionGroup, delayed, streamGeneratedPromiseResults, ChshGameOutcomeCounts } from "src/lib.js"

let suite = new Suite("lib");

suite.test("FunctionGroup_interaction", () => {
    let i = 0;
    let f = new FunctionGroup();

    f.add(() => i++);
    assertThat(i).isEqualTo(0);

    f.runAndClear();
    assertThat(i).isEqualTo(1);

    f.runAndClear();
    assertThat(i).isEqualTo(1);

    f.add(() => i++);
    f.add(() => i++);
    assertThat(i).isEqualTo(1);

    f.runAndClear();
    assertThat(i).isEqualTo(3);
});

suite.test("delayed", () => {
    return willResolveTo(delayed("x", 1), "x");
});

suite.test("streamGeneratedPromiseResults_default", () => promiseEventLoopYielder(function*() {
    let resolvers = [];
    let rejectors = [];
    let vals = [];
    let errs = [];

    streamGeneratedPromiseResults(
        () => new Promise((res, rej) => { resolvers.push(res); rejectors.push(rej); }),
        e => vals.push(e),
        e => errs.push(e));
    assertThat(resolvers.length).isEqualTo(1);
    assertThat(vals).isEqualTo([]);
    assertThat(errs).isEqualTo([]);

    resolvers[0]("x");
    yield undefined;
    assertThat(resolvers.length).isEqualTo(2);
    assertThat(vals).isEqualTo(["x"]);
    assertThat(errs).isEqualTo([]);

    resolvers[1]("y");
    yield undefined;
    assertThat(resolvers.length).isEqualTo(3);
    assertThat(vals).isEqualTo(["x", "y"]);
    assertThat(errs).isEqualTo([]);

    rejectors[2]("z");
    yield undefined;
    assertThat(resolvers.length).isEqualTo(3);
    assertThat(vals).isEqualTo(["x", "y"]);
    assertThat(errs).isEqualTo(["z"]);
}));

suite.test("streamGeneratedPromiseResults_limit", () => promiseEventLoopYielder(function*() {
    let resolvers = [];
    let rejectors = [];
    let vals = [];
    let errs = [];

    streamGeneratedPromiseResults(
        () => new Promise((res, rej) => { resolvers.push(res); rejectors.push(rej); }),
        e => vals.push(e),
        e => errs.push(e),
        3);
    resolvers[0]("x");
    yield undefined;
    assertThat(vals).isEqualTo(["x"]);

    resolvers[1]("y");
    yield undefined;
    assertThat(vals).isEqualTo(["x", "y"]);

    resolvers[2]("z");
    yield undefined;
    assertThat(vals).isEqualTo(["x", "y", "z"]);

    // Done.
    assertThat(resolvers.length).isEqualTo(3);
}));

suite.test("streamGeneratedPromiseResults_concurrent", () => promiseEventLoopYielder(function*() {
    let resolvers = [];
    let rejectors = [];
    let vals = [];
    let errs = [];

    streamGeneratedPromiseResults(
        () => new Promise((res, rej) => { resolvers.push(res); rejectors.push(rej); }),
        e => vals.push(e),
        e => errs.push(e),
        Infinity,
        2);
    assertThat(resolvers.length).isEqualTo(2);
    assertThat(vals).isEqualTo([]);
    assertThat(errs).isEqualTo([]);

    resolvers[0]("x");
    yield undefined;
    assertThat(resolvers.length).isEqualTo(3);
    assertThat(vals).isEqualTo(["x"]);
    assertThat(errs).isEqualTo([]);

    rejectors[1]("z");
    yield undefined;
    assertThat(resolvers.length).isEqualTo(3);
    assertThat(vals).isEqualTo(["x"]);
    assertThat(errs).isEqualTo(["z"]);

    resolvers[2]("ignored");
    yield undefined;
    assertThat(resolvers.length).isEqualTo(3);
    assertThat(vals).isEqualTo(["x"]);
    assertThat(errs).isEqualTo(["z"]);

}));

suite.test("streamGeneratedPromiseResults_outOfOrder", () => promiseEventLoopYielder(function*() {
    let resolvers = [];
    let rejectors = [];
    let vals = [];
    let errs = [];

    streamGeneratedPromiseResults(
        () => new Promise((res, rej) => { resolvers.push(res); rejectors.push(rej); }),
        e => vals.push(e),
        e => errs.push(e),
        Infinity,
        2);
    resolvers[1]("x");
    yield undefined;
    assertThat(vals).isEqualTo(["x"]);

    resolvers[0]("y");
    yield undefined;
    assertThat(vals).isEqualTo(["x", "y"]);
}));

suite.test("streamGeneratedPromiseResults_cancelled", () => promiseEventLoopYielder(function*() {
    let resolvers = [];
    let rejectors = [];
    let vals = [];
    let errs = [];
    let cancellers = [];

    streamGeneratedPromiseResults(
        () => new Promise((res, rej) => { resolvers.push(res); rejectors.push(rej); }),
        e => vals.push(e),
        e => errs.push(e),
        Infinity,
        1,
        e => cancellers.push(e));

    resolvers[0]("x");
    yield undefined;
    assertThat(vals).isEqualTo(["x"]);
    assertThat(resolvers.length).isEqualTo(2);
    for (let e of cancellers) e();

    resolvers[1]("y");
    assertThat(vals).isEqualTo(["x"]);
    assertThat(resolvers.length).isEqualTo(2);
}));

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
