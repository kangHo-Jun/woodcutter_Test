#!/usr/bin/env node
'use strict';

const path = require('path');
const { listCaseFiles, loadCase } = require('./lib/case-loader');
const { runCase, summarizeRuns } = require('./lib/runner');
const { validateRun } = require('./validator');

function parseArgs(argv) {
    const options = { repeat: 1, shuffle: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--repeat' || argv[i] === '-n') options.repeat = Number(argv[++i]);
        else if (argv[i] === '--shuffle') options.shuffle = true;
        else if (argv[i] === '--json') options.json = true;
        else throw new Error(`알 수 없는 옵션: ${argv[i]}`);
    }
    if (!Number.isInteger(options.repeat) || options.repeat < 1) {
        throw new Error('--repeat는 1 이상의 정수여야 합니다.');
    }
    return options;
}

function mark(value) {
    return value ? 'PASS' : 'FAIL';
}

function expectationPass(data, bins) {
    const target = data.expected?.maxBins;
    if (!Number.isFinite(target)) return true;
    return bins <= target;
}

function runOne(file, options) {
    const { data } = loadCase(file);
    const runs = [];
    const validations = [];
    for (let i = 0; i < options.repeat; i++) {
        const run = runCase(data, { shuffle: options.shuffle });
        runs.push(run);
        validations.push(validateRun(run));
    }
    const stats = summarizeRuns(runs);
    const geometryValid = validations.every(value => value.geometryValid);
    const cutDetailsValid = validations.every(value => value.cutDetailsValid);
    const guillotineSequenceValid = validations.every(value => value.guillotineSequenceValid);
    const expectationValid = data.classification === 'reference'
        ? true
        : runs.every(run => expectationPass(data, run.result.bins.length));
    const valid = geometryValid && cutDetailsValid && guillotineSequenceValid && expectationValid;
    return {
        name: data.name,
        file: path.basename(file),
        classification: data.classification ?? 'required',
        bins: runs[0].result.bins.length,
        expectedMax: data.expected?.maxBins ?? '-',
        engine: runs[0].result.engine ?? runs[0].result.mode ?? 'unknown',
        geometryValid,
        cutDetailsValid,
        guillotineSequenceValid,
        expectationValid,
        valid,
        stats,
        firstErrors: validations.find(value => !value.valid)?.errors ?? null
    };
}

function printTable(rows) {
    const columns = [
        ['케이스', 18, row => row.name],
        ['구분', 9, row => row.classification],
        ['판재', 6, row => `${row.bins}/${row.expectedMax}`],
        ['엔진', 20, row => row.engine],
        ['geometry', 9, row => mark(row.geometryValid)],
        ['cutDetails', 11, row => mark(row.cutDetailsValid)],
        ['guillotine', 11, row => mark(row.guillotineSequenceValid)],
        ['기대값', 8, row => row.classification === 'reference' ? 'INFO' : mark(row.expectationValid)],
        ['전체', 6, row => mark(row.valid)]
    ];
    const line = row => columns.map(([, width, getter]) =>
        String(getter(row)).slice(0, width).padEnd(width)
    ).join(' | ');
    console.log(columns.map(([title, width]) => title.padEnd(width)).join(' | '));
    console.log(columns.map(([, width]) => '-'.repeat(width)).join('-|-'));
    rows.forEach(row => console.log(line(row)));
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const rows = listCaseFiles().map(file => runOne(file, options));
    if (options.json) {
        console.log(JSON.stringify(rows, null, 2));
    } else {
        printTable(rows);
        console.log('');
        rows.forEach(row => {
            const s = row.stats;
            console.log(`${row.name}: 분포=${JSON.stringify(s.distribution)}, 최선=${s.best}, 최악=${s.worst}, 평균=${s.average.toFixed(3)}, 표준편차=${s.standardDeviation.toFixed(3)}, 총=${s.elapsedTotalMs.toFixed(1)}ms`);
            if (s.unstable) console.warn(`⚠ ${row.name}: 판재 수 비결정성/순서 의존성 감지`);
        });
        const passed = rows.filter(row => row.valid).length;
        console.log(`\n전체: ${passed}/${rows.length} PASS`);
    }
    if (rows.some(row => !row.valid)) process.exitCode = 1;
}

try {
    main();
} catch (error) {
    console.error(`오류: ${error.message}`);
    process.exitCode = 1;
}
