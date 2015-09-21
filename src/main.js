import Config from "src/Config.js"
import describe from "src/base/Describe.js"
import Seq from "src/base/Seq.js"
import Util from "src/base/Util.js"

let timeout = 500; // millis
let showWorkingGracePeriod = 250; // millis
let showErrorGracePeriod = 25; // millis

let worldsWorstSandbox = code => `eval(${JSON.stringify(code)});`;
let wrap = code => `
    var refA = 0;
    var refB = 1;
    var result;
    ${worldsWorstSandbox(code)}
    if (result === undefined) {
        throw new Error("Nothing was assigned to 'result'!");
    }
    result;`;


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

let delayed = (val, delay) => new Promise(resolve => setTimeout(() => resolve(val), delay));

/** @type {!HTMLTextAreaElement} */
let textArea = document.getElementById("srcTextArea1");
let label = document.getElementById("lblTextArea1");
let labelEventualSet = setterToPromiseRatchet(text => label.textContent = text);

let prevCancels = [];
let lastText = undefined;
let ref = () => {
    if (lastText === textArea.value) {
        return;
    }
    lastText = textArea.value;

    labelEventualSet(delayed("working...", showWorkingGracePeriod));
    for (let e of prevCancels) {
        e();
    }
    prevCancels = [];
    let code = wrap(textArea.value);
    let f = Util.asyncEval(code, timeout, prevCancels).then(
            e => describe(e),
            e => delayed("Error: " + describe(e), showErrorGracePeriod));
    labelEventualSet(f);
};

textArea.addEventListener("change", ref);
textArea.addEventListener("keydown", ref);
textArea.addEventListener("keypress", ref);
textArea.addEventListener("paste", ref);
textArea.addEventListener("keyup", ref);
ref();
