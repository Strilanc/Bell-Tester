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
    asyncifyProgressReporter,
    asyncEval
} from "src/engine/Async.js"

let suite = new Suite("lib");

suite.test("asyncEval", () => {
    let cancellers = [];
    let result = Promise.all([
        // result
        willResolveTo(asyncEval("5+3"), 8),
        willResolveTo(asyncEval("[]"), []),
        willResolveTo(asyncEval("var a = 5; var b = 7; a + b;"), 12),
        willResolveTo(asyncEval("var a = 5; var b = 7; a + b;", 1000), 12),

        // syntax error
        willReject(asyncEval("{")),
        willReject(asyncEval("{", 1000)),

        // exception thrown
        willReject(asyncEval("throw 1;")),
        willReject(asyncEval("throw new Error();")),

        // infinite loop (timeout)
        willReject(asyncEval("while (true) {}", 50)),

        // infinite loop (cancelled)
        willReject(asyncEval("while (true) {}", Infinity, e => cancellers.push(e)))
    ]);
    for (let f of cancellers) {
        f();
    }
    return result;
});

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
