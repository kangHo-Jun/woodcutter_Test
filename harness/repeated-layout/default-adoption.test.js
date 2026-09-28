'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const scenarios = require('./cases.json');
const { runScenario, visibleResult, assertValid, assertSequentialCuts } = require('./support');
const { approvedDefaultResult } = require('../../js/repeatedLayout');
const { validateRun } = require('../validator');
const { CostCalculator } = require('../lib/environment').loadProduction({ boardThickness: 18 });

function adoptionInput(scenario, run) {
    return {
        board: { width: run.result.bins[0].width, height: run.result.bins[0].height },
        kerf: scenario.settings.kerf,
        items: run.items,
        baseline: run.result,
        settings: {
            ...scenario.settings,
            cutDirection: scenario.settings.mode,
            enableTrim: scenario.settings.enableTrim ?? false
        },
        boardSpec: {
            ...scenario.board,
            considerGrain: scenario.settings.considerGrain
        },
        cuttingList: structuredClone(scenario.items)
    };
}

for (const scenario of scenarios) {
    test(`${scenario.id}: 기본 결과는 승인된 CASE5에만 적용`, () => {
        const run = runScenario(scenario);
        const before = structuredClone(visibleResult(run.result));
        const beforeCost = structuredClone(run.cost);
        const selected = approvedDefaultResult(adoptionInput(scenario, run));

        if (scenario.id !== 'CASE5') {
            assert.equal(selected, run.result, '다른 입력은 기존 엔진 결과 객체를 유지');
            assert.deepEqual(visibleResult(selected), before);
            assert.deepEqual(run.cost, beforeCost, '기존 원가 계산 결과를 유지');
            return;
        }

        assert.notEqual(selected, run.result, 'CASE5는 고객 승인 반복배치를 기본 결과로 사용');
        assert.deepEqual(visibleResult(run.result), before, '후보 생성 중 baseline을 수정하지 않음');
        assert.equal(selected.engine, 'REPEATED_LAYOUT');
        assert.equal(selected.mode, 'auto');
        assert.equal(selected.bins.length, 1);
        assert.equal(selected.bins[0].placed.length, 16);
        assert.equal(selected.bins[0].cuttingCount, 20);
        const rowStarts = selected.bins[0].placed
            .filter((part, index, all) => index === 0 || Math.abs(part.y - all[index - 1].y) > 1e-6)
            .map(part => part.y);
        assert.equal(rowStarts.length, 4);
        [0, 264.2, 528.4, 792.6].forEach((expected, index) =>
            assert.ok(Math.abs(rowStarts[index] - expected) < 1e-6));
        const selectedRun = { ...run, result: selected };
        const validation = validateRun(selectedRun);
        assert.equal(validation.valid, true, JSON.stringify(validation.errors));
        assertValid(selectedRun);
        assertSequentialCuts(selected, scenario.settings.kerf);
        assert.equal(run.cost.totalCuts, 16);
        const selectedCost = CostCalculator.calculate(selected.bins, { ...scenario.settings, cutPrice: 1500 });
        assert.equal(selectedCost.totalCuts, 20);
        assert.equal(selectedCost.totalCuttingCost, 30000);
    });
}

test('CASE5 signature ignores input order and IDs but enforces orientation and settings', () => {
    const scenario = scenarios.find(item => item.id === 'CASE5');
    const run = runScenario(scenario);
    const input = adoptionInput(scenario, run);
    input.cuttingList.reverse();
    input.cuttingList[0].id = 'different-id';
    input.cuttingList[1].id = 'another-id';
    input.items.reverse();
    assert.notEqual(approvedDefaultResult(input), input.baseline);

    const rotationAllowed = structuredClone(input);
    rotationAllowed.cuttingList[0].allowRotate = true;
    assert.equal(approvedDefaultResult(rotationAllowed), rotationAllowed.baseline);
    const kerfChanged = structuredClone(input);
    kerfChanged.kerf = 3;
    assert.equal(approvedDefaultResult(kerfChanged), kerfChanged.baseline);
});
