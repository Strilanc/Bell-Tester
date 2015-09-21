import Config from "src/Config.js"
import describe from "src/base/Describe.js"
import Seq from "src/base/Seq.js"
import Util from "src/base/Util.js"

let timeout = 2000; // millis
let showWorkingGracePeriod = 250; // millis
let showErrorGracePeriod = 50; // millis

let chsh_outcome = (refA, refB, moveA, moveB) => (moveA !== moveB) === (refA && refB);

let worldsWorstSandbox = code => `(function() { eval(${JSON.stringify(code)}); }());`;

let coinFlip = () => Math.random() < 0.5;

let runGameManyTimes = (code1, code2, count, cancelList) => {
    // Note: not guaranteed protection. The web worker could have access to the same entropy or to reflection.
    let dontTouchMyStuffSuffix = Seq.range(10).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    let pk = `__i_${dontTouchMyStuffSuffix}`;
    let pb = `__shared_${dontTouchMyStuffSuffix}`;
    let pm = `__moves_${dontTouchMyStuffSuffix}`;

    let sharedBitsPer = 16;
    let allSharedBitsArrayText = describe(Seq.range(count).
        map(() => Math.floor(Math.random() * (1 << sharedBitsPer))).
        toArray());

    let wrapCode = (code, refCoinMask) => `
        var ${pb} = ${allSharedBitsArrayText};
        var ${pm} = [];
        for (var ${pk} = 0; ${pk} < ${count}; ${pk}++) {
            var sharedBits = [];
            var i;
            for (i = 0; i < ${sharedBitsPer}; i++) {
                sharedBits.push((${pb}[${pk}] & (1 << i)) !== 0);
            }
            i = undefined;

            var refChoice = (${pk} & ${refCoinMask}) !== 0;
            var refchoice = refChoice; // You're welcome.
            var ref_choice = refChoice;

            var move = undefined;
            ${worldsWorstSandbox(code)}
            if (!(move == true) && !(move == false)) {
                throw new Error("move ended up " + move + " instead of true or false");
            }
            ${pm}.push(move == true);
        };
        ${pm};
        `;

    let wrapCode1 = wrapCode(code1, 1);
    let wrapCode2 = wrapCode(code2, 2);
    let results1 = Util.asyncEval(wrapCode1, timeout, cancelList);
    let results2 = Util.asyncEval(wrapCode2, timeout, cancelList);
    let winCount = Promise.all([results1, results2]).then(moves => Seq.range(count).filter(i => {
        let refCoin1 = (i & 1) !== 0;
        let refCoin2 = (i & 2) !== 0;
        let move1 = moves[0][i];
        let move2 = moves[1][i];
        return chsh_outcome(refCoin1, refCoin2, move1, move2);
    }).count());
    return winCount;
};

let setterToPromiseRatchet = setter => {
    let latestCompletedId = 0;
    let nextId = 1;
    return promise => {
        let id = nextId;
        nextId = (nextId + 1) & 0xFFFF;
        promise.then(e => {
            // http://algorithmicassertions.com/math/2014/03/11/Ordering-Cyclic-Sequence-Numbers.html
            let isLate = ((latestCompletedId - id) & 0xFFFF) < 0x8FFF;
            if (isLate) return;
            latestCompletedId = id;
            setter(e);
        });
    };
};

let streamPromise = (promiser, capacity, max, valueConsumer, errorConsumer) => {
    let cancelled = false;
    let runs = 0;
    let add = () => {
        if (cancelled) return;
        if (runs >= max) return;
        let p = promiser(runs);
        runs += 1;
        p.then(e => {
            if (cancelled) return;
            valueConsumer(e);
            add();
        }, errorConsumer);
    };
    for (let i = 0; i < capacity; i++) {
        add();
    }
    return () => cancelled = true;
};

let delayed = (val, delay) => new Promise(resolve => setTimeout(() => resolve(val), delay));

let textArea1 = document.getElementById("srcTextArea1");
let textArea2 = document.getElementById("srcTextArea2");
let label = document.getElementById("lblTextArea1");

let labelEventualSet = setterToPromiseRatchet(text => label.textContent = text);
let prevCancels = [];
let lastText1 = undefined;
let lastText2 = undefined;
let ref = () => {
    let s1 = textArea1.value;
    let s2 = textArea2.value;
    if (lastText1 === s1 && lastText2 === s2) {
        return;
    }
    lastText1 = s1;
    lastText2 = s2;

    for (let e of prevCancels) {
        e();
    }
    prevCancels = [];

    let winCount = 0;
    let playCount = 0;

    let c = streamPromise(() => {
        return runGameManyTimes(s1, s2, 1000, prevCancels);
    }, 2, 100, r => {
        playCount += 1000;
        winCount += r;
        let p = winCount/playCount;
        let s = Math.sqrt(p*(1-p)/playCount);
        labelEventualSet(Promise.resolve(winCount + "/" + playCount + "; ~" + (100*p).toFixed(1) + "% (\u00B1" + (300*s).toFixed(1) + "%)"));
    }, ex => {
        labelEventualSet(delayed(ex, showErrorGracePeriod));
    });
    prevCancels.push(c);
};

textArea1.addEventListener("change", ref);
textArea1.addEventListener("keydown", ref);
textArea1.addEventListener("keypress", ref);
textArea1.addEventListener("paste", ref);
textArea1.addEventListener("keyup", ref);
textArea2.addEventListener("change", ref);
textArea2.addEventListener("keydown", ref);
textArea2.addEventListener("keypress", ref);
textArea2.addEventListener("paste", ref);
textArea2.addEventListener("keyup", ref);
ref();

//interpretify(document.getElementById("srcTextArea1"), document.getElementById("lblTextArea1"));
//interpretify(document.getElementById("srcTextArea2"), document.getElementById("lblTextArea2"));
