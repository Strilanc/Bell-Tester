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
    FunctionGroup,
    delayed,
    streamGeneratedPromiseResults,
    ChshGameOutcomeCounts,
    asyncEvalChshGameRuns,
    asyncifyProgressReporter
} from "src/lib.js"

import Seq from "src/base/Seq.js"

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

suite.test("delayed", () => Promise.all([
    willResolveTo(delayed("x", 1), "x"),
    willReject(delayed("x", 1, true))
]));

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

suite.test("asyncEvalChshGameRuns", () => {
    let out = s => ChshGameOutcomeCounts.fromCountsByMap(
        new Seq(s).countBy(i => ChshGameOutcomeCounts.caseToKey(i & 1, i & 2, i & 4, i & 8)));
    let c = [];
    let r = Promise.all([
        willResolveTo(asyncEvalChshGameRuns("move=false", "move=false", 4), out([0, 1, 2, 3])),
        willResolveTo(asyncEvalChshGameRuns("move=false", "move=true", 4), out([8, 9, 10, 11])),
        willResolveTo(asyncEvalChshGameRuns("move=refChoice", "move=true", 4), out([8, 13, 10, 15])),
        willResolveTo(asyncEvalChshGameRuns("move=refChoice", "move=true", 8), out([8, 8, 13, 13, 10, 10, 15, 15])),
        // Timeout.
        willReject(asyncEvalChshGameRuns("while(true);", "move=true", 1, 10)),
        // Parse error.
        willReject(asyncEvalChshGameRuns("{", "move=true", 1)),
        // Throw.
        willReject(asyncEvalChshGameRuns("throw 1;", "move=true", 1)),
        // Cancellation.
        willReject(asyncEvalChshGameRuns("while(true);", "move=true", 1, Infinity, 16, e => c.push(e)))
    ]);
    for (let e of c) e();
    return r;
});

suite.test("asyncifyProgressReporter_oneByOne", () => promiseEventLoopYielder(function*() {
    let a = [];
    let b = [];
    let f = asyncifyProgressReporter((e, v) => { a.push(e); b.push(v); });
    yield undefined;
    assertThat(a).isEqualTo([]);
    assertThat(b).isEqualTo([]);

    f(Promise.resolve("a"));
    yield undefined;
    assertThat(a).isEqualTo(["a"]);
    assertThat(b).isEqualTo([true]);

    f(Promise.reject("b"));
    yield undefined;
    assertThat(a).isEqualTo(["a", "b"]);
    assertThat(b).isEqualTo([true, false]);
}));

suite.test("asyncifyProgressReporter_overlapResolveInOrder", () => promiseEventLoopYielder(function*() {
    let a = [];
    let b = [];
    let f = asyncifyProgressReporter((e, v) => { a.push(e); b.push(v); });
    let res1 = undefined;
    let res2 = undefined;
    f(new Promise(r => res1 = r));
    f(new Promise(r => res2 = r));
    yield undefined;
    assertThat(a).isEqualTo([]);
    assertThat(b).isEqualTo([]);

    res1("a");
    yield undefined;
    assertThat(a).isEqualTo(["a"]);
    assertThat(b).isEqualTo([true]);

    res2("b");
    yield undefined;
    assertThat(a).isEqualTo(["a", "b"]);
    assertThat(b).isEqualTo([true, true]);
}));

suite.test("asyncifyProgressReporter_overlapResolveOutOfOrder", () => promiseEventLoopYielder(function*() {
    let a = [];
    let b = [];
    let f = asyncifyProgressReporter((e, v) => { a.push(e); b.push(v); });
    let res1 = undefined;
    let res2 = undefined;
    f(new Promise(r => res1 = r));
    f(new Promise(r => res2 = r));
    yield undefined;
    assertThat(a).isEqualTo([]);
    assertThat(b).isEqualTo([]);

    res2("a");
    yield undefined;
    assertThat(a).isEqualTo(["a"]);
    assertThat(b).isEqualTo([true]);

    res1("b");
    yield undefined;
    assertThat(a).isEqualTo(["a"]);
    assertThat(b).isEqualTo([true]);
}));

suite.test("asyncifyProgressReporter_overlapRejectInOrder", () => promiseEventLoopYielder(function*() {
    let a = [];
    let b = [];
    let f = asyncifyProgressReporter((e, v) => { a.push(e); b.push(v); });
    let rej1 = undefined;
    let rej2 = undefined;
    f(new Promise((_, r) => rej1 = r));
    f(new Promise((_, r) => rej2 = r));
    yield undefined;
    assertThat(a).isEqualTo([]);
    assertThat(b).isEqualTo([]);

    rej1("a");
    yield undefined;
    assertThat(a).isEqualTo([]);
    assertThat(b).isEqualTo([]);

    rej2("b");
    yield undefined;
    assertThat(a).isEqualTo(["b"]);
    assertThat(b).isEqualTo([false]);
}));

suite.test("asyncifyProgressReporter_overlapRejectOutOfOrderBlockStaleErr", () => promiseEventLoopYielder(function*() {
    let a = [];
    let b = [];
    let f = asyncifyProgressReporter((e, v) => { a.push(e); b.push(v); });
    let rej1 = undefined;
    let rej2 = undefined;
    f(new Promise((_, r) => rej1 = r));
    f(new Promise((_, r) => rej2 = r));
    assertThat(a).isEqualTo([]);
    assertThat(b).isEqualTo([]);

    rej2("a");
    yield undefined;
    assertThat(a).isEqualTo(["a"]);
    assertThat(b).isEqualTo([false]);

    rej1("b");
    yield undefined;
    assertThat(a).isEqualTo(["a"]);
    assertThat(b).isEqualTo([false]);
}));

suite.test("asyncifyProgressReporter_overlapResolveRejectBlockStaleErr", () => promiseEventLoopYielder(function*() {
    let a = [];
    let b = [];
    let f = asyncifyProgressReporter((e, v) => { a.push(e); b.push(v); });
    let rej = undefined;
    let res = undefined;
    f(new Promise((_, r) => rej = r));
    f(new Promise(r => res = r));
    yield undefined;
    assertThat(a).isEqualTo([]);
    assertThat(b).isEqualTo([]);

    rej("a");
    yield undefined;
    assertThat(a).isEqualTo([]);
    assertThat(b).isEqualTo([]);

    res("b");
    yield undefined;
    assertThat(a).isEqualTo(["b"]);
    assertThat(b).isEqualTo([true]);
}));
