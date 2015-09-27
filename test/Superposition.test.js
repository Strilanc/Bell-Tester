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

import Superposition from "src/Superposition.js"

import Seq from "src/base/Seq.js"

let suite = new Suite("lib");

suite.test("constructor", () => {
    assertThat(new Superposition(0).peek()).isEqualTo(new Float32Array([1, 0]));
    assertThat(new Superposition(1).peek()).isEqualTo(new Float32Array([1, 0, 0, 0]));
    assertThat(new Superposition(2).peek()).isEqualTo(new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]));
});

suite.test("turn_1", () => {
    let s = new Superposition(1);
    let f = Math.sqrt(0.5);
    let X = [1, 0, 0];
    let Y = [0, 1, 0];
    let Z = [0, 0, 1];
    let H = [f, 0, f];

    // X
    s.rotate(0, X, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
    s.rotate(0, X, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // H[0]
    s.rotate(0, H, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([f, 0, f, 0]));
    s.rotate(0, H, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // Z[0]
    s.rotate(0, Z, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // Y
    s.rotate(0, Y, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 0, 1]));
    s.rotate(0, Y, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    s.rotate(0, X, Math.PI);

    // H[1]
    s.rotate(0, H, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([f, 0, -f, 0]));
    s.rotate(0, H, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));

    // Z[1]
    s.rotate(0, Z, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, -1, 0]));
    s.rotate(0, Z, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));

    s.rotate(0, X, Math.PI);

    // sqrt(X)
    s.rotate(0, X, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0.5, 0.5, 0.5, -0.5]));
    s.rotate(0, X, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
    s.rotate(0, X, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0.5, -0.5, 0.5, 0.5]));
    s.rotate(0, X, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // sqrt(Y)
    s.rotate(0, Y, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0.5, 0.5, 0.5, 0.5]));
    s.rotate(0, Y, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 0, 1]));
    s.rotate(0, Y, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0.5, -0.5, -0.5, 0.5]));
    s.rotate(0, Y, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // sqrt(Z)
    s.rotate(0, Z, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));
    s.rotate(0, X, Math.PI);
    s.rotate(0, Z, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 0, 1]));
    s.rotate(0, Z, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, -1, 0]));
    s.rotate(0, Z, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 0, -1]));
    s.rotate(0, Z, Math.PI/2);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
});

suite.test("turn_2", () => {
    let s = new Superposition(2);
    let f = Math.sqrt(0.5);
    let X = [1, 0, 0];
    let H = [f, 0, f];

    s.rotate(0, H, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([f, 0, f, 0, 0, 0, 0, 0]));

    s.rotate(1, H, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0]));

    s.rotate(0, H, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([f, 0, 0, 0, f, 0, 0, 0]));

    s.rotate(0, X, Math.PI, [1]);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([f, 0, 0, 0, 0, 0, f, 0]));

    s.rotate(1, X, Math.PI, [0]);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([f, 0, f, 0, 0, 0, 0, 0]));
});

suite.test("measure_1", () => {
    let s = new Superposition(1);
    let f = Math.sqrt(0.5);
    let X = [1, 0, 0];
    let H = [f, 0, f];

    assertFalse(s.measure(0));
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));
    assertFalse(s.measure(0));
    assertFalse(s.measure(0));
    s.rotate(0, X, Math.PI);
    assertTrue(s.measure(0));
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
    assertTrue(s.measure(0));
    assertTrue(s.measure(0));
    s.rotate(0, X, Math.PI);
    assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    for (let i = 0; i < 1000; i++) {
        s.rotate(0, H, Math.PI);
        let b = s.measure(0);
        if (b) {
            assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
            s.rotate(0, X, Math.PI);
        } else {
            assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));
        }
    }
});

suite.test("measure_2", () => {
    let s = new Superposition(2);
    let f = Math.sqrt(0.5);
    let X = [1, 0, 0];
    let H = [f, 0, f];

    s.rotate(0, H, Math.PI);
    s.rotate(1, H, Math.PI);
    for (let i = 0; i < 1000; i++) {
        let b1 = s.measure(0);
        if (b1) {
            assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, f, 0, 0, 0, f, 0]));
            s.rotate(0, X, Math.PI);
        } else {
            assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([f, 0, 0, 0, f, 0, 0, 0]));
        }
        s.rotate(0, H, Math.PI);

        let b2 = s.measure(1);
        if (b2) {
            assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([0, 0, 0, 0, f, 0, f, 0]));
            s.rotate(1, X, Math.PI);
        } else {
            assertThat(s.peek()).isApproximatelyEqualTo(new Float32Array([f, 0, f, 0, 0, 0, 0, 0]));
        }
        s.rotate(1, H, Math.PI);
    }
});
