export const ROTATE_FUNC_STRING = `
    (function(amps, target_bit_index, axis, theta, control_bit_indices) {
        if (control_bit_indices === undefined) control_bit_indices = [];
        var n = amps.length/2;
        var x = axis[0];
        var y = axis[1];
        var z = axis[2];
        // U = |z    x-iy|
        //     |x+iy   -z|

        var isGoodNumber = function(val) {
            return typeof val === "number" && isFinite(val) && val > -100000 && val < 100000;
        };
        if (!isGoodNumber(theta)) throw Error("Bad turn angle");
        if (!isGoodNumber(x)) throw Error("Bad turn axis x");
        if (!isGoodNumber(y)) throw Error("Bad turn axis y");
        if (!isGoodNumber(z)) throw Error("Bad turn axis z");
        var e = x*x + y*y + z*z - 1;
        if (e*e > 0.0001) throw Error("Bad turn axis length")

        // p = (-1)^t = cos(theta) + i sin(theta)
        var pr = Math.cos(theta);
        var pi = Math.sin(theta);

        // M = U^t = ( (1+p)*I + (1-p)*U )/2 = | 1+p+(1-p)z    (1-p)(x-iy) |
        //                                     | (1-p)(x+iy)    1+p-(1-p)z |
        // Well, this ended up kind of complicated...
        var ar = (1 + pr + z - pr*z)/2;
        var ai = (pi - pi*z)/2;
        var br = (x - pr*x - pi*y)/2;
        var bi = (-y + pr*y - pi*x)/2;
        var cr = (x - pr*x + pi*y)/2;
        var ci = (y - pr*y - pi*x)/2;
        var dr = (1 + pr - z + pr*z)/2;
        var di = (pi + pi*z)/2;

        for (var i = 0; i < n; i++) {
            // Only process each amplitude pair once.
            var skip = (i & (1 << target_bit_index)) !== 0;
            // Skip parts of the superposition where control bits are off.
            for (var k = 0; k < control_bit_indices.length; k++) {
                skip |= (i & (1 << control_bit_indices[k])) === 0;
            }
            if (skip) continue;

            var j1 = i*2;
            var j2 = j1 + (2 << target_bit_index);

            var ur = amps[j1];
            var ui = amps[j1+1];
            var vr = amps[j2];
            var vi = amps[j2+1];

            // | a b | |u| = |au+bv|
            // | c d | |v|   |cu+dv|
            var ur2 = ar*ur - ai*ui + br*vr - bi*vi;
            var ui2 = ar*ui + ai*ur + br*vi + bi*vr;
            var vr2 = cr*ur - ci*ui + dr*vr - di*vi;
            var vi2 = cr*ui + ci*ur + dr*vi + di*vr;

            amps[j1] = ur2;
            amps[j1+1] = ui2;
            amps[j2] = vr2;
            amps[j2+1] = vi2;
        }
    })`;

export const MEASURE_FUNC_STRING = `
    (function(amps, target_bit_index) {
        var n = amps.length / 2;
        // Weigh.
        var p = 0;
        for (var i = 0; i < n; i++) {
            if ((i & (1 << target_bit_index)) !== 0) {
                var vr = amps[i*2];
                var vi = amps[i*2+1];
                p += vr*vr + vi*vi;
            }
        }

        // Collapse.
        var outcome = Math.random() < p;

        // Renormalize.
        var w = Math.sqrt(outcome ? p : 1-p);
        for (var i = 0; i < n; i++) {
            var b = (i & (1 << target_bit_index)) !== 0;
            if (b === outcome) {
                amps[i*2] /= w;
                amps[i*2+1] /= w;
            } else {
                amps[i*2] = 0;
                amps[i*2+1] = 0;
            }
        }

        return outcome;
    })`;
