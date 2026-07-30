#!/usr/bin/env node
'use strict';

const path = require('path');
const { loadCase } = require('./lib/case-loader');
const { runCase, summarizeRuns } = require('./lib/runner');
const { writeSvg } = require('./lib/svg');
const { validateRun } = require('./validator');

function parseArgs(argv) {
    const options = { repeat: 1, shuffle: false, json: false };
    for (let i = 0; i < argv.length; i++) {
        const value = argv[i];
        if (value === '--case') options.case = argv[++i];
        else if (value === '--repeat' || value === '-n') options.repeat = Number(argv[++i]);
        else if (value === '--shuffle') options.shuffle = true;
        else if (value === '--svg') options.svg = argv[++i];
        else if (value === '--json') options.json = true;
        else if (value === '--help' || value === '-h') options.help = true;
        else throw new Error(`알 수 없는 옵션: ${value}`);
    }
    if (!Number.isInteger(options.repeat) || options.repeat < 1) {
        throw new Error('--repeat는 1 이상의 정수여야 합니다.');
    }
    return options;
}

function help() {
    console.log(`사용법:
  node harness/run.js --case case1.json
  node harness/run.js --case dataset-b-548.json --repeat 10 --shuffle
  node harness/run.js --case case2.json --svg harness/output/case2.svg

옵션:
  --case <file>   harness/cases 또는 현재 경로의 JSON
  --repeat, -n N  새 packer 인스턴스로 N회 실행
  --shuffle       매회 입력 그룹 순서를 셔플
  --svg <file>    첫 실행 결과를 SVG로 저장
  --json          기계 판독용 JSON 요약 출력`);
}

function compactErrors(validation) {
    return Object.fromEntries(
        Object.entries(validation.errors).map(([key, errors]) => [
            key,
            errors.slice(0, 10)
        ])
    );
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        help();
        return;
    }
    const { file, data } = loadCase(options.case);
    const runs = [];
    for (let i = 0; i < options.repeat; i++) {
        runs.push(runCase(data, { shuffle: options.shuffle }));
    }
    const validations = runs.map(validateRun);
    const stats = summarizeRuns(runs);
    const payload = {
        case: data.name,
        file,
        engine: runs[0].result.engine ?? runs[0].result.mode ?? 'unknown',
        bins: runs[0].result.bins.length,
        unplaced: runs[0].result.unplaced.length,
        geometryValid: validations.every(value => value.geometryValid),
        cutDetailsValid: validations.every(value => value.cutDetailsValid),
        guillotineSequenceValid: validations.every(value => value.guillotineSequenceValid),
        valid: validations.every(value => value.valid),
        statistics: stats,
        errors: compactErrors(validations.find(value => !value.valid) ?? validations[0])
    };
    if (options.svg) payload.svg = writeSvg(runs[0], options.svg);

    if (options.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
    }

    console.log(`\n${data.name} (${path.basename(file)})`);
    console.log(`engine: ${payload.engine} | bins: ${payload.bins} | unplaced: ${payload.unplaced}`);
    console.log(`geometryValid: ${payload.geometryValid ? 'PASS' : 'FAIL'}`);
    console.log(`cutDetailsValid: ${payload.cutDetailsValid ? 'PASS' : 'FAIL'}`);
    console.log(`guillotineSequenceValid: ${payload.guillotineSequenceValid ? 'PASS' : 'FAIL'}`);
    console.log(`분포: ${JSON.stringify(stats.distribution)}`);
    console.log(`최선/최악/평균/표준편차: ${stats.best}/${stats.worst}/${stats.average.toFixed(3)}/${stats.standardDeviation.toFixed(3)}`);
    console.log(`소요시간: 총 ${stats.elapsedTotalMs.toFixed(1)}ms, 평균 ${stats.elapsedAverageMs.toFixed(1)}ms`);
    if (stats.unstable) console.warn('⚠ 판재 수가 실행마다 흔들립니다.');
    if (!payload.valid) console.log(JSON.stringify(payload.errors, null, 2));
    if (payload.svg) console.log(`SVG: ${payload.svg}`);
    if (!payload.valid) process.exitCode = 1;
}

try {
    main();
} catch (error) {
    console.error(`오류: ${error.message}`);
    process.exitCode = 1;
}
