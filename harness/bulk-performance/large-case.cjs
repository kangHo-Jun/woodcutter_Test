'use strict';

const { runCase } = require('../lib/runner');
const { validateRun } = require('../validator');

const grainAndTrim = process.env.BULK_GRAIN_AND_TRIM === '1';
let data = {
    name: 'BULK_995x901_230__465x901_460',
    board: { width: 1220, height: 2440, thickness: 18 },
    settings: { kerf: 4.2, mode: 'auto', considerGrain: false, enableTrim: false },
    items: [
        { id: 'A', width: 995, height: 901, qty: 230, allowRotate: true },
        { id: 'B', width: 465, height: 901, qty: 460, allowRotate: true }
    ]
};
if (grainAndTrim) {
    data = require('../repeated-layout/support').prepareCase({
        ...data,
        settings: { ...data.settings, considerGrain: true, enableTrim: true, trimMargin: 9 }
    });
}
const run = runCase(data);
const validation = validateRun(run);
const counts = {};
for (const part of run.result.bins.flatMap(bin => bin.placed)) {
    counts[part.originalId] = (counts[part.originalId] ?? 0) + 1;
}
const patterns = new Map();
for (const bin of run.result.bins) {
    const key = JSON.stringify(bin.placed.map(part => [
        part.originalId, part.x, part.y, part.width, part.height, !!part.rotated
    ]).sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]));
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
}
console.log(JSON.stringify({
    elapsedMs: run.elapsedMs,
    binCount: run.result.bins.length,
    unplaced: run.result.unplaced.length,
    counts,
    patterns: patterns.size,
    patternCopies: [...patterns.values()].sort((a, b) => b - a),
    geometryValid: validation.geometryValid,
    cutDetailsValid: validation.cutDetailsValid,
    guillotineSequenceValid: validation.guillotineSequenceValid,
    cost: run.cost
}));
