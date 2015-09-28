import Seq from 'src/base/Seq.js'
import { wireGame } from 'src/engine/Draw.js'
import { ChshGameOutcomeCounts, asyncEvalClassicalChshGameRuns, asyncEvalQuantumChshGameRuns } from 'src/engine/ChSh.js'

const SHARED_BIT_COUNT = 16; // number of shared classical bits given to each player
const ASYNC_EVAL_TIMEOUT = 2000; // millis

let classicalRecorded = [
    25186, 0, 12553, 12494,
    0, 0, 0, 0,
    24718, 0, 12468, 12581,
    0, 0, 0, 0
];
let quantumRecorded = [
    10813, 1734, 10416, 1875,
    1832, 10833, 1840, 10619,
    10581, 1835, 1849, 10811,
    1817, 10643, 10672, 1830
];

let precomputedClassicalOutcomeForDefaultStrategy = ChshGameOutcomeCounts.fromCountsByMap(
    Seq.range(16).toMap(i => ChshGameOutcomeCounts.caseToKey(i & 8, i & 2, i & 4, i & 1), i => classicalRecorded[i]));
let precomputedQuantumOutcomeForDefaultStrategy = ChshGameOutcomeCounts.fromCountsByMap(
    Seq.range(16).toMap(i => ChshGameOutcomeCounts.caseToKey(i & 8, i & 2, i & 4, i & 1), i => quantumRecorded[i]));

wireGame(
    document.getElementById('srcTextArea1_classical'),
    document.getElementById('srcTextArea2_classical'),
    document.getElementById('rateLabel_classical'),
    document.getElementById('countLabel_classical'),
    document.getElementById('judgementLabel_classical'),
    document.getElementById('errorLabel_classical'),
    document.getElementById('resultsDiv_classical'),
    document.getElementById('drawCanvas_classical'),
    "// write any strategy you want!\nmove = false",
    "// write any strategy you want!\nmove = refChoice && sharedBits[0];",
    precomputedClassicalOutcomeForDefaultStrategy,
    (code1, code2, runs, cancellor) => asyncEvalClassicalChshGameRuns(
        code1,
        code2,
        runs,
        ASYNC_EVAL_TIMEOUT,
        SHARED_BIT_COUNT,
        cancellor));

wireGame(
    document.getElementById('srcTextArea1_quantum'),
    document.getElementById('srcTextArea2_quantum'),
    document.getElementById('rateLabel_quantum'),
    document.getElementById('countLabel_quantum'),
    document.getElementById('judgementLabel_quantum'),
    document.getElementById('errorLabel_quantum'),
    document.getElementById('resultsDiv_quantum'),
    document.getElementById('drawCanvas_quantum'),
    "turn(X, -45)\nif (refChoice) turn(X, 90)\nmove = measure()",
    "if (refChoice) turn(X, 90)\nmove = measure()",
    precomputedQuantumOutcomeForDefaultStrategy,
    (code1, code2, runs, cancellor) => asyncEvalQuantumChshGameRuns(
        code1,
        code2,
        runs,
        ASYNC_EVAL_TIMEOUT,
        cancellor));
