'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scenario, runtime, pack } = require('./runtime.cjs');
const { assertValid } = require('../repeated-layout/support');

test('reported 24 square parts finish on one board with valid cuts and kerf', () => {
    const run = pack();
    assert.equal(run.result.bins.length, 1);
    assert.equal(run.result.bins[0].placed.length, 24);
    assertValid(run);
    assert.ok(run.elapsedMs < 1000, `calculation took ${run.elapsedMs}ms`);
});

test('direct GPP with a frozen clock is bounded and returns its full baseline', () => {
    const r = runtime(scenario(), () => 0);
    r.evaluate(`
        var baseline;
        var originalBase = packer.packAdaptiveBase;
        packer.packAdaptiveBase = function(items) { baseline = originalBase.call(this, items); return baseline; };
        var result = packer.guillotinePartitionPlanner(data.items, data.board.height, data.board.width, false);
    `);
    assert.deepEqual(r.context.result.bins, r.context.baseline.bins);
    assert.deepEqual(r.context.result.unplaced, r.context.baseline.unplaced);
    assertValid({ caseData: r.data, items: r.data.items, result: r.context.result });
});

test('deadline expires inside enumeration and unwinds to the complete baseline', () => {
    const r = runtime(scenario(20), reads => reads <= 2 ? 0 : 2000);
    r.evaluate(`
        var baseline;
        var originalBase = packer.packAdaptiveBase;
        packer.packAdaptiveBase = function(items) { baseline = originalBase.call(this, items); return baseline; };
        var result = packer.guillotinePartitionPlanner(data.items, data.board.height, data.board.width, false);
    `);
    assert.ok(r.clockReads() >= 3, 'deadline exercised');
    assert.deepEqual(r.context.result.bins, r.context.baseline.bins);
    assert.deepEqual(r.context.result.unplaced, r.context.baseline.unplaced);
});

test('deadline exhaustion keeps every board of the existing two-board layout', () => {
    const r = runtime(require('../residual-labels/case11.json'), reads => reads <= 2 ? 0 : 2000);
    r.evaluate(`
        var baseline;
        var originalBase = packer.packAdaptiveBase;
        packer.packAdaptiveBase = function(items) { baseline = originalBase.call(this, items); return baseline; };
        var result = packer.guillotinePartitionPlanner(data.items, data.board.height, data.board.width, false);
    `);
    assert.ok(r.clockReads() >= 3, 'deadline exercised');
    assert.equal(r.context.baseline.bins.length, 2);
    assert.deepEqual(r.context.result.bins, r.context.baseline.bins);
    assert.deepEqual(r.context.result.unplaced, r.context.baseline.unplaced);
    assertValid({ caseData: r.data, items: r.data.items, result: r.context.result });
});

test('unexpected planner failures are not swallowed as budget exhaustion', () => {
    const r = runtime(scenario());
    r.evaluate('packer.generateCutCandidates = function() { throw new Error("unexpected planner failure"); };');
    assert.throws(() => r.evaluate('packer.guillotinePartitionPlanner(data.items, 2440, 1220, false);'),
        /unexpected planner failure/);
});

test('rotation disabled retains the reported quantities and 4.2mm saw gaps', () => {
    const input = scenario();
    input.items.forEach(i => { i.allowRotate = false; });
    const run = pack(input);
    assert.equal(run.result.bins.length, 1);
    assertValid(run);
});

for (const count of [20, 22, 26, 28, 30, 31, 32, 33, 64]) {
    test(`${count} mixed square parts preserve quantities and physical geometry`, () => {
        const run = pack(scenario(count));
        assert.equal(run.result.bins.length, 1);
        assertValid(run);
    });
}
for (const count of [31, 32, 33, 64]) {
    test(`direct GPP safely falls back at ${count} pieces without wrapped masks`, () => {
        const r = runtime(scenario(count), () => 0);
        r.evaluate(`
            var baseline;
            var originalBase = packer.packAdaptiveBase;
            packer.packAdaptiveBase = function(items) { baseline = originalBase.call(this, items); return baseline; };
            var result = packer.guillotinePartitionPlanner(data.items, data.board.height, data.board.width, false);
        `);
        assert.deepEqual(r.context.result.bins, r.context.baseline.bins);
        assert.deepEqual(r.context.result.unplaced, r.context.baseline.unplaced);
        assertValid({ caseData: r.data, items: r.data.items, result: r.context.result });
    });
}
for (const settings of [{ considerGrain: true }, { enableTrim: true }, { kerf: 0 }, { considerGrain: true, enableTrim: true }]) {
    test(`reported dimensions with ${JSON.stringify(settings)}`, () => {
        const input = scenario(24, settings);
        if (settings.kerf === 0) input.items.forEach(i => { i.allowRotate = false; });
        const run = pack(input);
        assert.equal(run.result.bins.length, 1);
        assertValid(run);
    });
}
