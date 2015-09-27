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

import { ROTATE_FUNC_STRING, MEASURE_FUNC_STRING } from "src/engine/Superposition.js"


const rotate = eval(ROTATE_FUNC_STRING);
const measure = eval(MEASURE_FUNC_STRING);
const init = i => {
    let r = new Float32Array(2 << i);
    r[0] = 1;
    return r;
};

let suite = new Suite("lib");

suite.test("turn_1", () => {
    let s = init(1);
    let f = Math.sqrt(0.5);
    let X = [1, 0, 0];
    let Y = [0, 1, 0];
    let Z = [0, 0, 1];
    let H = [f, 0, f];

    // X
    rotate(s, 0, X, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
    rotate(s, 0, X, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // H[0]
    rotate(s, 0, H, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([f, 0, f, 0]));
    rotate(s, 0, H, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // Z[0]
    rotate(s, 0, Z, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // Y
    rotate(s, 0, Y, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 0, 1]));
    rotate(s, 0, Y, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    rotate(s, 0, X, Math.PI);

    // H[1]
    rotate(s, 0, H, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([f, 0, -f, 0]));
    rotate(s, 0, H, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));

    // Z[1]
    rotate(s, 0, Z, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, -1, 0]));
    rotate(s, 0, Z, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));

    rotate(s, 0, X, Math.PI);

    // sqrt(X)
    rotate(s, 0, X, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0.5, 0.5, 0.5, -0.5]));
    rotate(s, 0, X, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
    rotate(s, 0, X, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0.5, -0.5, 0.5, 0.5]));
    rotate(s, 0, X, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // sqrt(Y)
    rotate(s, 0, Y, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0.5, 0.5, 0.5, 0.5]));
    rotate(s, 0, Y, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 0, 1]));
    rotate(s, 0, Y, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0.5, -0.5, -0.5, 0.5]));
    rotate(s, 0, Y, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    // sqrt(Z)
    rotate(s, 0, Z, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));
    rotate(s, 0, X, Math.PI);
    rotate(s, 0, Z, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 0, 1]));
    rotate(s, 0, Z, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, -1, 0]));
    rotate(s, 0, Z, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 0, -1]));
    rotate(s, 0, Z, Math.PI/2);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
});

suite.test("turn_2", () => {
    let s = init(2);
    let f = Math.sqrt(0.5);
    let X = [1, 0, 0];
    let H = [f, 0, f];

    rotate(s, 0, H, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([f, 0, f, 0, 0, 0, 0, 0]));

    rotate(s, 1, H, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0]));

    rotate(s, 0, H, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([f, 0, 0, 0, f, 0, 0, 0]));

    rotate(s, 0, X, Math.PI, [1]);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([f, 0, 0, 0, 0, 0, f, 0]));

    rotate(s, 1, X, Math.PI, [0]);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([f, 0, f, 0, 0, 0, 0, 0]));
});

suite.test("measure_1", () => {
    let s = init(1);
    let f = Math.sqrt(0.5);
    let X = [1, 0, 0];
    let H = [f, 0, f];

    assertFalse(measure(s, 0));
    assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));
    assertFalse(measure(s, 0));
    assertFalse(measure(s, 0));
    rotate(s, 0, X, Math.PI);
    assertTrue(measure(s, 0));
    assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
    assertTrue(measure(s, 0));
    assertTrue(measure(s, 0));
    rotate(s, 0, X, Math.PI);
    assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));

    for (let i = 0; i < 10; i++) {
        rotate(s, 0, H, Math.PI);
        let b = measure(s, 0);
        if (b) {
            assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 1, 0]));
            rotate(s, 0, X, Math.PI);
        } else {
            assertThat(s).isApproximatelyEqualTo(new Float32Array([1, 0, 0, 0]));
        }
    }
});

suite.test("measure_2", () => {
    let s = init(2);
    let f = Math.sqrt(0.5);
    let X = [1, 0, 0];
    let H = [f, 0, f];

    rotate(s, 0, H, Math.PI);
    rotate(s, 1, H, Math.PI);
    for (let i = 0; i < 10; i++) {
        let b1 = measure(s, 0);
        if (b1) {
            assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, f, 0, 0, 0, f, 0]));
            rotate(s, 0, X, Math.PI);
        } else {
            assertThat(s).isApproximatelyEqualTo(new Float32Array([f, 0, 0, 0, f, 0, 0, 0]));
        }
        rotate(s, 0, H, Math.PI);

        let b2 = measure(s, 1);
        if (b2) {
            assertThat(s).isApproximatelyEqualTo(new Float32Array([0, 0, 0, 0, f, 0, f, 0]));
            rotate(s, 1, X, Math.PI);
        } else {
            assertThat(s).isApproximatelyEqualTo(new Float32Array([f, 0, f, 0, 0, 0, 0, 0]));
        }
        rotate(s, 1, H, Math.PI);
    }
});
