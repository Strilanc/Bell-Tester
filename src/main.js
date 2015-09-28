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
    document.getElementById('srcTextArea1_a'),
    document.getElementById('srcTextArea2_a'),
    document.getElementById('rateLabel_a'),
    document.getElementById('countLabel_a'),
    document.getElementById('judgementLabel_a'),
    document.getElementById('errorLabel_a'),
    document.getElementById('resultsTable_a'),
    document.getElementById('drawCanvas_a'),
    "// write any strategy you want!\nmove = false",
    "// write any strategy you want!\nmove = refChoice && sharedBits[0]",
    precomputedClassicalOutcomeForDefaultStrategy,
    (code1, code2, runs, cancellor) => asyncEvalClassicalChshGameRuns(
        code1,
        code2,
        runs,
        ASYNC_EVAL_TIMEOUT,
        SHARED_BIT_COUNT,
        cancellor));

wireGame(
    document.getElementById('srcTextArea1_b'),
    document.getElementById('srcTextArea2_b'),
    document.getElementById('rateLabel_b'),
    document.getElementById('countLabel_b'),
    document.getElementById('judgementLabel_b'),
    document.getElementById('errorLabel_b'),
    document.getElementById('resultsDiv_b'),
    document.getElementById('drawCanvas_b'),
    "turn(X, -45) //rotate qubit -45\u00B0 around X axis\nif (refChoice) turn(X, 90)\nmove = measure()",
    "if (refChoice) turn(X, 90)\nmove = measure()",
    precomputedQuantumOutcomeForDefaultStrategy,
    (code1, code2, runs, cancellor) => asyncEvalQuantumChshGameRuns(
        code1,
        code2,
        runs,
        ASYNC_EVAL_TIMEOUT,
        cancellor));
