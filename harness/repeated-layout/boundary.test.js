'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compareLayouts } = require('../../js/repeatedLayout');
const { assertSequentialCuts, deepFreeze } = require('./support');

function input(width, height) {
    return deepFreeze({
        board: { width, height }, kerf: 2,
        items: [{ id: 'A', width: 20, height: 10, qty: 4, allowRotate: false }],
        baseline: { bins: [{}], unplaced: [] }
    });
}

test('정확히 맞는 42×22 판재: 끝단 절단 없이 20×10 네 조각', () => {
    const result = compareLayouts(input(42, 22), { enabled: true });
    assert.ok(result.candidate);
    assert.equal(result.candidate.bins[0].cuttingCount, 3);
    assert.equal(result.candidate.bins[0].placed.length, 4);
    assert.equal(result.candidate.bins[0].freeRects.length, 0);
    assertSequentialCuts(result.candidate, 2);
});

test('끝단에 톱날 두께만 남은 44×24 판재: 끝단도 실제 절단', () => {
    const result = compareLayouts(input(44, 24), { enabled: true });
    assert.ok(result.candidate);
    assert.equal(result.candidate.bins[0].cuttingCount, 6);
    assert.equal(result.candidate.bins[0].freeRects.length, 0);
    assertSequentialCuts(result.candidate, 2);
});

test('끝단 여유가 톱날보다 작은 경우: 무리한 후보를 생성하지 않음', () => {
    for (const [width, height] of [[43, 22], [42, 23]]) {
        const source = input(width, height);
        const result = compareLayouts(source, { enabled: true });
        assert.equal(result.candidate, null);
        assert.equal(result.baseline, source.baseline);
    }
});
