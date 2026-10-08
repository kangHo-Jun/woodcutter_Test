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
        for (const bin of run.result.bins) {
            const display = require('../../js/residualLabels').build({bin,board:{width:bin.width,height:bin.height},kerf:scenario.settings.kerf});
            assert.deepEqual(display.unresolved, [], scenario.id + ' unresolved remnants');
        }
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

test('CASE11: 기존 2장 결과 보존 및 세 잔재 실치수 정수표시', () => {
    const run = runScenario(case11);
    assertValid(run);
    assert.equal(run.result.bins.length, 2);
    assert.equal(run.result.bins[0].placed.length, 6);
    const result = require('../../js/residualLabels').build({bin:run.result.bins[0],board:{width:1820,height:910},kerf:4.2});
    assert.deepEqual(result.unresolved, []);
    assert.deepEqual(result.labels.map(l=>l.text).sort(), ['649 × 185','1820 × 65','51 × 650'].sort());
});
