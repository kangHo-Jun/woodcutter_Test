'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const scenarios = require('../repeated-layout/cases.json');
const baselines = require('../bulk-performance/baselines/ten-cases.json');
const { runScenario, visibleResult, assertValid, assertSequentialCuts } = require('../repeated-layout/support');
const { approvedDefaultResult } = require('../../js/repeatedLayout');
const { loadProduction } = require('../lib/environment');
const case11 = require('./case11.json');

// Same public calculation boundaries as the existing approved ten-case suite.
// Never replace the saved baselines with output from a modified engine.
for (const scenario of scenarios) {
    test(`${scenario.id}: 기존 배치·절단·잔재·요금 및 기본 선택 보존`, () => {
        const run = runScenario(scenario);
        const baseline = baselines.find(entry => entry.id === scenario.id);
        assert.deepEqual({ result: visibleResult(run.result), cost: run.cost },
            { result: baseline.result, cost: baseline.cost });
        assertValid(run);
        const selected = approvedDefaultResult({
            board: { width: run.result.bins[0].width, height: run.result.bins[0].height },
            kerf: scenario.settings.kerf,
            items: run.items,
            baseline: run.result,
            settings: { ...scenario.settings, cutDirection: scenario.settings.mode },
            boardSpec: { ...scenario.board, considerGrain: scenario.settings.considerGrain },
            cuttingList: structuredClone(scenario.items)
        });
        if (scenario.id !== 'CASE5') {
            assert.equal(selected, run.result);
            return;
        }
        assertValid({ ...run, result: selected });
        assertSequentialCuts(selected, scenario.settings.kerf);
        assert.equal(selected.bins.length, 1);
        assert.equal(selected.bins[0].cuttingCount, 20);
        const expected = [0, 264.2, 528.4, 792.6].flatMap(y =>
            [[0, 450], [454.2, 450], [908.4, 350], [1262.6, 350]]
                .map(([x, width]) => ({ x, y, width, height: 260 })));
        const actual = selected.bins[0].placed.slice().sort((a, b) => a.y - b.y || a.x - b.x);
        assert.equal(actual.length, expected.length);
        expected.forEach((rect, index) => Object.keys(rect).forEach(key =>
            assert.ok(Math.abs(actual[index][key] - rect[key]) < 1e-6, `CASE5 ${index}/${key}`)));
        const { CostCalculator } = loadProduction();
        const cost = CostCalculator.calculate(selected.bins, { ...scenario.settings, cutPrice: 1500 });
        assert.equal(cost.totalCuts, 20);
        assert.equal(cost.totalCuttingCost, 30000);
    });
}

test('CASE11 [임시 설정]: A/B/C 세로 보존 + D 3세로/1가로를 한 장에서 절단', () => {
    // Diagnostic RED only: 4.2mm is an assumption, not a confirmed photo setting.
    // Do not weaken kerf/geometry checks or claim this RED proves an engine bug.
    const run = runScenario(case11);
    assertValid(run);
    assert.equal(run.result.bins.length, case11.expected.bins,
        '원본 설정 미확정: 현재 4.2mm 가정에서 한 장 목표 미달. 치수 성립 확인 후 GREEN 진행');
    const bin = run.result.bins[0];
    for (const width of [685, 300, 173]) {
        assert.equal(bin.placed.filter(p => p.width === width && p.height === 840).length, 1);
    }
    const vertical = bin.placed.filter(p => p.width === 195 && p.height === 650);
    const horizontal = bin.placed.filter(p => p.width === 650 && p.height === 195);
    assert.equal(vertical.length, 3);
    assert.equal(horizontal.length, 1);
    assert.ok(vertical.every(p => horizontal[0].y >= p.y + p.height + case11.settings.kerf - 1e-6));
    assertSequentialCuts(run.result, case11.settings.kerf);
});
