'use strict';

const assert = require('node:assert/strict');
const { runCase } = require('../lib/runner');
const { validateRun } = require('../validator');

// Fixture dimensions are UI input dimensions. Follow main-unified.handleCalculate:
// panel length -> X; trim consumes panel width (Y) at both ends.
function prepareCase(scenario) {
    const data = structuredClone(scenario);
    data.name = data.id;
    const { settings } = data;
    if (settings.enableTrim) {
        data.board.width -= 2 * (settings.trimMargin + settings.kerf);
    }
    data.items = data.items.map(item => ({
        ...item,
        width: settings.considerGrain ? Math.max(item.width, item.height)
            : (!item.allowRotate ? item.height : item.width),
        height: settings.considerGrain ? Math.min(item.width, item.height)
            : (!item.allowRotate ? item.width : item.height),
        allowRotate: item.allowRotate && !settings.considerGrain
    }));
    return data;
}

function runScenario(scenario) {
    return runCase(prepareCase(scenario));
}

// Deliberate characterization of existing externally visible output. Do not
// snapshot timing, search diagnostics or engine names as part of the contract.
function visibleResult(result) {
    return {
        unplaced: result.unplaced,
        totalEfficiency: result.totalEfficiency,
        bins: result.bins.map(bin => ({
            width: bin.width, height: bin.height,
            placed: bin.placed,
            freeRects: bin.freeRects,
            cutDetails: bin.cutDetails,
            cuttingCount: bin.cuttingCount,
            usedArea: bin.usedArea, totalArea: bin.totalArea,
            efficiency: bin.efficiency
        }))
    };
}

function assertProtected(run, baseline) {
    assert.deepEqual(visibleResult(run.result), visibleResult(baseline.result),
        '기존 배치/회전/절단 정보/잔재가 변경됨');
    assert.deepEqual(run.cost, baseline.cost, '기존 표시 횟수/재단비가 변경됨');
}

function assertValid(run) {
    const validation = validateRun(run);
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
    assert.equal(run.result.unplaced.length, 0, '미배치 부품이 없어야 함');
    // Existing validator checks overlap, but not the physical saw gap.
    const kerf = run.caseData.settings.kerf;
    for (const bin of run.result.bins) {
        for (let i = 0; i < bin.placed.length; i++) {
            for (let j = i + 1; j < bin.placed.length; j++) {
                const a = bin.placed[i], b = bin.placed[j];
                const gapX = Math.max(b.x - a.x - a.width, a.x - b.x - b.width);
                const gapY = Math.max(b.y - a.y - a.height, a.y - b.y - b.height);
                assert.ok(Math.max(gapX, gapY) >= kerf - 1e-6,
                    `톱날 간격 부족: 부품 ${i}/${j}`);
            }
        }
    }
}

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
}

function assertSequentialCuts(candidate, kerf) {
    const sameRect = (a, b) => ['x', 'y', 'width', 'height']
        .every(key => Math.abs(a[key] - b[key]) < 1e-6);
    for (const bin of candidate.bins) {
        const available = [{ x: 0, y: 0, width: bin.width, height: bin.height }];
        assert.equal(bin.cuttingCount, bin.cutDetails.length);
        for (const cut of bin.cutDetails) {
            const index = available.findIndex(rect => sameRect(rect, cut.sourceRect));
            assert.notEqual(index, -1, '현재 남아 있는 실제 부재에서만 절단 가능');
            const rect = available.splice(index, 1)[0];
            const [axis, size, span, spanSize] = cut.axis === 'X'
                ? ['x', 'width', 'y', 'height'] : ['y', 'height', 'x', 'width'];
            assert.ok(Math.abs(cut.spanStart - rect[span]) < 1e-6);
            assert.ok(Math.abs(cut.spanEnd - rect[span] - rect[spanSize]) < 1e-6,
                '현재 부재를 관통해야 함');
            const before = cut.pos - rect[axis];
            const after = rect[size] - before - kerf;
            assert.ok(before > 0 && after >= -1e-6, '톱날 두께를 포함해 분리 가능해야 함');
            available.push({ ...rect, [size]: before });
            if (after > 1e-6) available.push({ ...rect, [axis]: cut.pos + kerf, [size]: after });
        }
        for (const expected of [...bin.placed, ...bin.freeRects]) {
            const index = available.findIndex(rect => sameRect(rect, expected));
            assert.notEqual(index, -1, '절단 완료 후 부품/잔재 치수가 실제로 만들어져야 함');
            available.splice(index, 1);
        }
        assert.equal(available.length, 0, '미기록된 조각이 없어야 함');
    }
}

module.exports = { prepareCase, runScenario, visibleResult, assertProtected, assertValid, deepFreeze, assertSequentialCuts };
