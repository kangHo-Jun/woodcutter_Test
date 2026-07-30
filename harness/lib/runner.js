'use strict';

const { performance } = require('perf_hooks');
const { loadProduction } = require('./environment');

function cloneItems(items) {
    return items.map((item, index) => ({
        ...item,
        id: item.id ?? String.fromCharCode(65 + index),
        allowRotate: item.allowRotate !== false,
        rotatable: item.rotatable !== false
    }));
}

function shuffle(items, random = Math.random) {
    const copy = cloneItems(items);
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function runCase(caseData, options = {}) {
    const { GuillotinePacker, CostCalculator, SettingsManager } = loadProduction({
        kerf: caseData.settings?.kerf ?? 4.2,
        enableTrim: caseData.settings?.enableTrim ?? false,
        trimMargin: caseData.settings?.trimMargin ?? 9,
        mode: caseData.settings?.mode ?? 'auto',
        boardThickness: caseData.board.thickness ?? 18,
        considerGrain: caseData.settings?.considerGrain ?? false,
        autoEngine: options.autoEngine ?? 'adaptive'
    });

    window.CostCalculator = CostCalculator;
    window.SettingsManager = SettingsManager;
    const items = options.shuffle ? shuffle(caseData.items, options.random) : cloneItems(caseData.items);
    const kerf = caseData.settings?.kerf ?? SettingsManager.DEFAULT_SETTINGS.kerf;
    const mode = caseData.settings?.mode ?? 'auto';

    // Production UI maps board length to X and board width to Y.
    const packer = new GuillotinePacker(caseData.board.height, caseData.board.width, kerf);
    const productionLogs = [];
    const originalLog = console.log;
    const originalInfo = console.info;
    if (!options.verbose) {
        console.log = (...args) => productionLogs.push(args.join(' '));
        console.info = (...args) => productionLogs.push(args.join(' '));
    }
    const started = performance.now();
    let result;
    let elapsedMs;
    try {
        result = packer.pack(items, mode);
        elapsedMs = performance.now() - started;
    } finally {
        console.log = originalLog;
        console.info = originalInfo;
    }
    const cost = CostCalculator.calculate(result.bins, {
        ...SettingsManager.DEFAULT_SETTINGS,
        ...caseData.settings,
        kerf
    });

    return {
        caseData,
        items,
        result,
        cost,
        elapsedMs,
        productionLogs
    };
}

function summarizeRuns(runs) {
    const bins = runs.map(run => run.result.bins.length);
    const times = runs.map(run => run.elapsedMs);
    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const binMean = mean(bins);
    const variance = mean(bins.map(value => (value - binMean) ** 2));
    const distribution = {};
    bins.forEach(value => {
        distribution[value] = (distribution[value] ?? 0) + 1;
    });
    return {
        runs: runs.length,
        best: Math.min(...bins),
        worst: Math.max(...bins),
        average: binMean,
        standardDeviation: Math.sqrt(variance),
        elapsedTotalMs: times.reduce((sum, value) => sum + value, 0),
        elapsedAverageMs: mean(times),
        distribution,
        unstable: new Set(bins).size > 1
    };
}

module.exports = {
    cloneItems,
    runCase,
    shuffle,
    summarizeRuns
};
