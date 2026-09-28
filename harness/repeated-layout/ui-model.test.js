'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deepFreeze } = require('./support');
function state() {
    return { boardSpec: { width: 1220, height: 2440, considerGrain: true },
        settings: { kerf: 4.2, enableTrim: false, trimMargin: 9 },
        cuttingList: [{ id: 'A', width: 260, height: 450, qty: 8, allowRotate: false }],
        result: { bins: [{ width: 2440, height: 1220 }], unplaced: [] },
        costInfo: { totalCuts: 16, totalCuttingCost: 24000 } };
}
test('비교 화면용 복사본은 기존 축·결 방향과 비용을 유지하고 기존 상태를 공유하지 않음', () => {
    const { createSnapshot } = require('../../js/repeatedLayoutUI');
    const source = deepFreeze(state()); const snapshot = createSnapshot(source);
    assert.deepEqual(snapshot.input.board, { width: 2440, height: 1220 });
    assert.deepEqual(snapshot.input.items, [{ id:'A', width:450, height:260, qty:8, allowRotate:false }]);
    assert.deepEqual(snapshot.cost, source.costInfo);
    snapshot.input.baseline.bins[0].width = 999;
    snapshot.cost.totalCuts = 1;
    assert.equal(source.result.bins[0].width, 2440);
    assert.equal(source.costInfo.totalCuts, 16);
});
test('전단 후 유효 폭은 현재 UI와 같은 1043.6mm', () => {
    const { createSnapshot } = require('../../js/repeatedLayoutUI');
    const source = state(); source.boardSpec.width = 1070; source.settings.enableTrim = true;
    source.result.bins[0].height = 1043.6;
    assert.ok(Math.abs(createSnapshot(source).input.board.height - 1043.6) < 1e-6);
});
test('버전별 전단 차이: v4 엔진이 산출한 유효 폭 1056mm를 그대로 사용', () => {
    const { createSnapshot } = require('../../js/repeatedLayoutUI');
    const source = state(); source.boardSpec.width = 1070; source.settings.enableTrim = true;
    source.result.bins[0].height = 1056;
    assert.equal(createSnapshot(source).input.board.height, 1056);
});
test('계산 결과가 없으면 비교 화면과 PDF용 스냅샷을 만들지 않음', () => {
    const { createSnapshot } = require('../../js/repeatedLayoutUI');
    const source = state(); source.result = null;
    assert.equal(createSnapshot(source), null);
});
