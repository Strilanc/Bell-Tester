import { Suite, assertThat, assertThrows, assertTrue, assertFalse, willResolveTo, willReject } from "test/TestUtil.js"
import Util from "src/base/Util.js"

import Seq from "src/base/Seq.js"

let suite = new Suite("Util");

suite.test("need", () => {
    assertThrows(() => Util.need(false));
    Util.need(true);
});

suite.test("notNull", () => {
    assertThrows(() => Util.notNull(null));
    assertThat(Util.notNull([])).isEqualTo([]);
    assertThat(Util.notNull("")).isEqualTo("");
});

suite.test("isPowerOf2", () => {
    assertFalse(Util.isPowerOf2(-1));
    assertFalse(Util.isPowerOf2(0));
    assertTrue(Util.isPowerOf2(1));
    assertTrue(Util.isPowerOf2(2));
    assertFalse(Util.isPowerOf2(3));
    assertTrue(Util.isPowerOf2(4));
    assertFalse(Util.isPowerOf2(5));
});

suite.test("bitSize", () => {
    assertThat(Util.bitSize(0)).isEqualTo(0);
    assertThat(Util.bitSize(1)).isEqualTo(1);
    assertThat(Util.bitSize(2)).isEqualTo(2);
    assertThat(Util.bitSize(3)).isEqualTo(2);
    assertThat(Util.bitSize(4)).isEqualTo(3);
    assertThat(Util.bitSize(5)).isEqualTo(3);
    assertThat(Util.bitSize(6)).isEqualTo(3);
    assertThat(Util.bitSize(7)).isEqualTo(3);
    assertThat(Util.bitSize(8)).isEqualTo(4);
    assertThat(Util.bitSize(9)).isEqualTo(4);
    assertThat(Util.bitSize(1 << 20)).isEqualTo(21);
    assertThat(Util.bitSize((1 << 20) + (1 << 19))).isEqualTo(21);
});

suite.test("ceilingPowerOf2", () => {
    assertThat(Util.ceilingPowerOf2(-1)).isEqualTo(1);
    assertThat(Util.ceilingPowerOf2(0)).isEqualTo(1);
    assertThat(Util.ceilingPowerOf2(1)).isEqualTo(1);
    assertThat(Util.ceilingPowerOf2(2)).isEqualTo(2);
    assertThat(Util.ceilingPowerOf2(3)).isEqualTo(4);
    assertThat(Util.ceilingPowerOf2(4)).isEqualTo(4);
    assertThat(Util.ceilingPowerOf2(5)).isEqualTo(8);
    assertThat(Util.ceilingPowerOf2(6)).isEqualTo(8);
    assertThat(Util.ceilingPowerOf2(7)).isEqualTo(8);
    assertThat(Util.ceilingPowerOf2(8)).isEqualTo(8);
    assertThat(Util.ceilingPowerOf2(9)).isEqualTo(16);
    assertThat(Util.ceilingPowerOf2((1 << 20) - 1)).isEqualTo(1 << 20);
    assertThat(Util.ceilingPowerOf2(1 << 20)).isEqualTo(1 << 20);
    assertThat(Util.ceilingPowerOf2((1 << 20) + 1)).isEqualTo(1 << 21);
});

suite.test("powerOfTwoness", () => {
    assertThat(Util.powerOfTwoness(-2)).isEqualTo(1);
    assertThat(Util.powerOfTwoness(-1)).isEqualTo(0);
    assertThat(Util.powerOfTwoness(0)).isEqualTo(Math.POSITIVE_INFINITY);
    assertThat(Util.powerOfTwoness(1)).isEqualTo(0);
    assertThat(Util.powerOfTwoness(2)).isEqualTo(1);
    assertThat(Util.powerOfTwoness(3)).isEqualTo(0);
    assertThat(Util.powerOfTwoness(4)).isEqualTo(2);
    assertThat(Util.powerOfTwoness(5)).isEqualTo(0);
    assertThat(Util.powerOfTwoness(6)).isEqualTo(1);
    assertThat(Util.powerOfTwoness(7)).isEqualTo(0);
    assertThat(Util.powerOfTwoness(8)).isEqualTo(3);
    assertThat(Util.powerOfTwoness(9)).isEqualTo(0);

    assertThat(Util.powerOfTwoness(1 << 20)).isEqualTo(20);
    assertThat(Util.powerOfTwoness(1 + (1 << 20))).isEqualTo(0);
    assertThat(Util.powerOfTwoness(2 + (1 << 20))).isEqualTo(1);
});

suite.test("reverseGroupMap", () => {
    assertThat(Util.reverseGroupMap(new Map())).isEqualTo(new Map());
    assertThat(Util.reverseGroupMap(new Map([["a", ["b"]]]))).isEqualTo(new Map([["b", ["a"]]]));
    assertThat(Util.reverseGroupMap(new Map([
        ["a", ["b", "c"]]
    ]))).isEqualTo(new Map([
        ["b", ["a"]],
        ["c", ["a"]]
    ]));
    assertThat(Util.reverseGroupMap(new Map([
        ["a", ["b"]],
        ["c", ["b"]]
    ]))).isEqualTo(new Map([
        ["b", ["a", "c"]]
    ]));
    assertThat(Util.reverseGroupMap(new Map([
        ["a", [1, 2, 3]],
        ["b", [2, 3, 4]],
        ["c", [3, 4, 5]]
    ]))).isEqualTo(new Map([
        [1, ["a"]],
        [2, ["a", "b"]],
        [3, ["a", "b", "c"]],
        [4, ["b", "c"]],
        [5, ["c"]]
    ]));

    assertThat(Util.reverseGroupMap(new Map([
        ["a", [1, 2, 3]],
        ["b", [2, 3, 4]],
        ["c", [3, 4, 5]]
    ]), true)).isEqualTo(new Map([
        [1, ["a"]],
        [2, ["a", "b"]],
        [3, ["a", "b", "c"]],
        [4, ["b", "c"]],
        [5, ["c"]],
        ["a", []],
        ["b", []],
        ["c", []]
    ]));
    assertThat(Util.reverseGroupMap(new Map([
        [3, [1, 2]],
        [2, [1]]
    ]), true)).isEqualTo(new Map([
        [1, [3, 2]],
        [2, [3]],
        [3, []]
    ]));
});

suite.test("binarySearchForTransitionFromTrueToFalse", () => {
    let r = ["axe", "cat", "def", "g"];
    assertThat(Util.binarySearchForTransitionFromTrueToFalse(r.length, i => r[i] < "a")).isEqualTo(0);
    assertThat(Util.binarySearchForTransitionFromTrueToFalse(r.length, i => r[i] < "b")).isEqualTo(1);
    assertThat(Util.binarySearchForTransitionFromTrueToFalse(r.length, i => r[i] < "d")).isEqualTo(2);
    assertThat(Util.binarySearchForTransitionFromTrueToFalse(r.length, i => r[i] < "e")).isEqualTo(3);

    for (let n = 0; n < 10; n++) {
        for (let t = 0; t <= n; t++) {
            assertThat(Util.binarySearchForTransitionFromTrueToFalse(n, i => i < t)).isEqualTo(t);
            assertThat(Util.binarySearchForTransitionFromTrueToFalse(n, i => i <= t)).isEqualTo(Math.min(n, t + 1));
        }
    }
});

suite.test("asyncEval", () => {
    return Promise.all([
        // result
        willResolveTo(Util.asyncEval("5+3", Infinity), 8),
        willResolveTo(Util.asyncEval("[]", Infinity), []),
        willResolveTo(Util.asyncEval("var a = 5; var b = 7; a + b;", Infinity), 12),
        willResolveTo(Util.asyncEval("var a = 5; var b = 7; a + b;", 1000), 12),

        // syntax error
        willReject(Util.asyncEval("{", Infinity)),
        willReject(Util.asyncEval("{", 1000)),

        // exception thrown
        willReject(Util.asyncEval("throw 1;", Infinity)),
        willReject(Util.asyncEval("throw new Error();", Infinity)),

        // infinite loop
        willReject(Util.asyncEval("while (true) {}", 50))
    ]);
});
