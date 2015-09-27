/**
 * A weighted combination of states.
 * Like a probability distribution, except the probabilities are replaced by amplitudes.
 */
export default class Superposition {
    /**
     * @param {int} bit_count
     */
    constructor(bit_count) {
        this._bit_count = bit_count;
        this._N = 1 << bit_count;
        this._amps = new Float32Array(2 << bit_count);
        this._amps[0] = 1;
    }

    /**
     * Applies a controlled unitary operation to one of the qubits in the superposition.
     * @param {int} target_bit_index
     * @param {!Array.<int>} axis An [x, y, z] unit vector to rotate around.
     * @param {number} theta The amount to rotate by, in radians.
     * @param {!Array.<int>} control_bit_indices
     */
    rotate(target_bit_index, axis, theta, control_bit_indices=[]) {
        let [x, y, z] = axis;
        // U = |z    x-iy|
        //     |x+iy   -z|

        // p = (-1)^t = cos(theta) + i sin(theta)
        let pr = Math.cos(theta);
        let pi = Math.sin(theta);

        // M = U^t = ( (1+p)*I + (1-p)*U )/2 = | 1+p+(1-p)z    (1-p)(x-iy) |
        //                                     | (1-p)(x+iy)    1+p-(1-p)z |
        // Well, this ended up kind of complicated...
        let ar = (1 + pr + z - pr*z)/2;
        let ai = (pi - pi*z)/2;
        let br = (x - pr*x - pi*y)/2;
        let bi = (-y + pr*y - pi*x)/2;
        let cr = (x - pr*x + pi*y)/2;
        let ci = (y - pr*y - pi*x)/2;
        let dr = (1 + pr - z + pr*z)/2;
        let di = (pi + pi*z)/2;

        for (let i = 0; i < this._N; i++) {
           if ((i & (1 << target_bit_index)) === 0 && control_bit_indices.every(k => (i & (1 << k)) !== 0)) {
               let j = i*2;
               let k = j + (2 << target_bit_index);

               let ur = this._amps[j];
               let ui = this._amps[j+1];
               let vr = this._amps[k];
               let vi = this._amps[k+1];

               // | a b | |u| = |au+bv|
               // | c d | |v|   |cu+dv|
               let ur2 = ar*ur - ai*ui + br*vr - bi*vi;
               let ui2 = ar*ui + ai*ur + br*vi + bi*vr;
               let vr2 = cr*ur - ci*ui + dr*vr - di*vi;
               let vi2 = cr*ui + ci*ur + dr*vi + di*vr;

               this._amps[j] = ur2;
               this._amps[j+1] = ui2;
               this._amps[k] = vr2;
               this._amps[k+1] = vi2;
           }
        }
    }

    /**
     * Measures one of the qubits in the superposition.
     * @param {int} target_bit_index
     */
    measure(target_bit_index) {
        // Weigh.
        let p = 0;
        for (let i = 0; i < this._N; i++) {
            if ((i & (1 << target_bit_index)) !== 0) {
                let vr = this._amps[i*2];
                let vi = this._amps[i*2+1];
                p += vr*vr + vi*vi;
            }
        }

        // Collapse.
        let outcome = Math.random() < p;

        // Renormalize.
        let w = Math.sqrt(outcome ? p : 1-p);
        for (let i = 0; i < this._N; i++) {
            let b = (i & (1 << target_bit_index)) !== 0;
            if (b === outcome) {
                this._amps[i*2] /= w;
                this._amps[i*2+1] /= w;
            } else {
                this._amps[i*2] = 0;
                this._amps[i*2+1] = 0;
            }
        }

        return outcome;
    }

    /**
     * Returns a copy of the amplitudes buffer.
     * @returns {!Float32Array}
     */
    peek() {
        return new Float32Array(this._amps);
    }
}
