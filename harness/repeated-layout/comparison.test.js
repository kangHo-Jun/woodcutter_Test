'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cases = require('./cases.json');
const { runScenario, visibleResult, assertProtected, assertValid, deepFreeze, assertSequentialCuts } = require('./support');

function comparisonApi() {
    const file = path.resolve(__dirname, '../../js/repeatedLayout.js');
    assert.ok(fs.existsSync(file),
        'RED: 반복 배치 비교 기능이 아직 구현되지 않았습니다 (js/repeatedLayout.js)');
    const { compareLayouts } = require(file);
    assert.equal(typeof compareLayouts, 'function', '공개 compareLayouts 함수 필요');
    return compareLayouts;
}

function assertRepeatedPattern(candidate, expected) {
    assert.equal(candidate.bins.length, 1);
    const rows = new Map();
    for (const part of candidate.bins[0].placed) {
        const key = Math.round(part.y * 1e6) / 1e6;
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(part);
    }
    assert.equal(rows.size, expected.rows, '동일한 260mm 폭 4줄이어야 함');
    let firstPositions;
    for (const row of rows.values()) {
        row.sort((a, b) => a.x - b.x);
        assert.deepEqual(row.map(part => part.width), expected.pattern,
            '각 줄의 부품 순서/길이가 지정 반복 패턴과 달라짐');
        assert.ok(row.every(part => part.height === 260), '결 방향/부품 폭 보존');
        const positions = row.map(part => Math.round(part.x * 1e6) / 1e6);
        if (!firstPositions) firstPositions = positions;
        assert.deepEqual(positions, firstPositions, '줄 사이 절단 위치가 정렬되어야 함');
    }
}

test('나무결 ON: 260×200은 기존 방향 정규화를 보존하고 반복 후보에서 제외', () => {
    const scenario = structuredClone(cases[6]);
    scenario.items[2].height = 200;
    const run = runScenario(scenario);
    assert.equal(run.items[2].width, 260);
    assert.equal(run.items[2].height, 200);
    const result = comparisonApi()({
        board: { width: 2440, height: 1220 }, kerf: 4.2,
        items: run.items, baseline: run.result
    }, { enabled: true });
    assert.equal(result.candidate, null);
    assert.equal(result.baseline, run.result);
});

for (const scenario of cases) {
    test(`${scenario.id}: ${scenario.purpose} — 비교 ON/OFF 모두 기존 결과 보존`, () => {
        const compareLayouts = comparisonApi();
        const run = runScenario(scenario);
        assertValid(run);
        const originalCost = structuredClone(run.cost);
        const baseline = structuredClone(run.result);
        const input = deepFreeze({
            board: { width: run.caseData.board.height, height: run.caseData.board.width },
            kerf: run.caseData.settings.kerf,
            items: structuredClone(run.items),
            baseline
        });
        const before = JSON.stringify(input);
        if (scenario.expected.effectiveWidth !== undefined) {
            assert.ok(Math.abs(input.board.height - scenario.expected.effectiveWidth) < 1e-6);
        }
        const off = compareLayouts(input, { enabled: false });
        assert.deepEqual(off.baseline, baseline);
        assert.equal(off.candidate, null, '기능 OFF일 때 후보를 생성하지 않음');
        const on = compareLayouts(input, { enabled: true });
        assert.deepEqual(on.baseline, baseline, '기능 ON이어도 기존 결과를 교체하지 않음');
        assert.equal(JSON.stringify(input), before, '기존 입력/배치 객체를 변경하지 않음');
        assert.deepEqual(run.cost, originalCost);
        if (scenario.expected.candidate) {
            assert.ok(on.candidate, '유효한 반복 배치 후보가 필요함');
            assert.ok(on.candidate.bins.length <= baseline.bins.length, '원판 수 증가 금지');
            assertValid({ ...run, result: on.candidate });
            assertSequentialCuts(on.candidate, input.kerf);
            assertRepeatedPattern(on.candidate, scenario.expected);
            assert.ok(on.candidate.bins.every(bin => Array.isArray(bin.cutDetails) && bin.cutDetails.length > 0),
                '후보는 검증 가능한 절단 정보를 포함해야 함');
        } else {
            assert.equal(on.candidate, null, '적용 범위 밖이거나 유효한 반복 배치가 없으면 기존 결과 유지');
        }
        // Detect persistent side effects on the real production packer/cost path.
        const after = runScenario(scenario);
        assert.deepEqual(visibleResult(after.result), visibleResult(run.result));
        assert.deepEqual(after.cost, originalCost);
        if (/^CASE[1-4]$/.test(scenario.id)) {
            assertProtected(after, require(`./baselines/${scenario.id.toLowerCase()}.json`));
        }
    });
}
