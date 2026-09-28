'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runCase } = require('../lib/runner');
const { loadProduction } = require('../lib/environment');
const { prepareCase, visibleResult } = require('../repeated-layout/support');
const scenarios = require('../repeated-layout/cases.json');

const before = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'baselines/ten-cases.json'), 'utf8'
));

test('AREA_TARGET_HYBRID creates a branch by copying only the changed bin', () => {
    const { GuillotinePacker } = loadProduction({ kerf: 4.2 });
    const packer = new GuillotinePacker(2440, 1220, 4.2);
    const state = {
        bins: [packer.createAreaTargetBinState(), packer.createAreaTargetBinState()],
        usedArea: 0,
        cutCount: 0
    };
    const sourceSnapshot = structuredClone(state);
    const item = { id: 'A-0', width: 400, height: 300, allowRotate: true };
    const rect = state.bins[0].freeRects[0];
    const orientation = packer.getAreaTargetOrientations(item, rect)[0];

    const branch = packer.placeAreaTargetItem(
        state, 0, 0, item, rect, orientation, 'H_SPLIT'
    );

    assert.notEqual(branch.bins[0], state.bins[0]);
    assert.notEqual(branch.bins[0].placed, state.bins[0].placed);
    assert.notEqual(branch.bins[0].freeRects, state.bins[0].freeRects);
    assert.notEqual(branch.bins[0].cutDetails, state.bins[0].cutDetails);
    assert.equal(branch.bins[1], state.bins[1]);
    assert.deepEqual(state, sourceSnapshot);
});

test('the ten saved visible results and costs remain byte-for-byte equivalent', () => {
    for (const expected of before) {
        const scenario = scenarios.find(item => item.id === expected.id);
        const actual = runCase(prepareCase(scenario));
        assert.deepEqual(
            { result: visibleResult(actual.result), cost: actual.cost },
            { result: expected.result, cost: expected.cost },
            `${expected.id} output changed`
        );
    }
});

test('large repeated dimensions complete with valid full production and cost totals', () => {
    const child = spawnSync(process.execPath, [path.join(__dirname, 'large-case.cjs')], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8',
        timeout: 15000
    });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.status, 0, child.stderr);
    const run = JSON.parse(child.stdout);
    assert.equal(run.unplaced, 0);
    assert.equal(run.counts['0'], 230);
    assert.equal(run.counts['1'], 460);
    assert.ok(run.binCount > 0);
    assert.equal(run.patterns, 2);
    assert.deepEqual(run.patternCopies, [115, 92]);
    assert.ok(run.geometryValid);
    assert.ok(run.cutDetailsValid);
    assert.ok(run.guillotineSequenceValid);
    assert.ok(Number.isFinite(run.cost.totalCuttingCost));
    assert.ok(run.elapsedMs < 15000, `took ${run.elapsedMs.toFixed(1)}ms`);
});

test('grain and trim enabled retain all pieces and produce valid cut geometry', () => {
    const child = spawnSync(process.execPath, [path.join(__dirname, 'large-case.cjs')], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8',
        timeout: 15000,
        env: { ...process.env, BULK_GRAIN_AND_TRIM: '1' }
    });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.status, 0, child.stderr);
    const run = JSON.parse(child.stdout);
    assert.equal(run.unplaced, 0);
    assert.equal(run.counts['0'], 230);
    assert.equal(run.counts['1'], 460);
    assert.equal(run.geometryValid, true);
    assert.equal(run.cutDetailsValid, true);
    assert.equal(run.guillotineSequenceValid, true);
    assert.equal(run.patterns, 2);
    assert.ok(Number.isFinite(run.cost.totalCuttingCost));
});
