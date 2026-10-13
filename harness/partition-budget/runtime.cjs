'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { installBrowserStubs } = require('../lib/environment');
const { prepareCase } = require('../repeated-layout/support');
const target = process.env.PACKER_ROOT ? path.resolve(process.env.PACKER_ROOT) : path.resolve(__dirname, '../..');
function scenario(count = 24, settings = {}) {
    return { id: 'SQUARES', board: { width: 1220, height: 2440, thickness: 18 },
        settings: { kerf: 4.2, mode: 'auto', considerGrain: false, enableTrim: false, trimMargin: 9, ...settings },
        items: [{ id: 'A', width: 205, height: 205, qty: Math.ceil(count / 2), allowRotate: true },
            { id: 'B', width: 105, height: 105, qty: Math.floor(count / 2), allowRotate: true }] };
}
function runtime(input = scenario(), clock) {
    const data = prepareCase(input);
    installBrowserStubs({ ...data.settings, boardThickness: data.board.thickness });
    let clockReads = 0;
    const Clock = clock ? class extends Date { static now() { return clock(++clockReads); } } : Date;
    const context = vm.createContext({ window: global.window, document: global.document,
        localStorage: global.localStorage, Date: Clock, performance,
        console: { log() {}, info() {}, warn() {}, error() {} }, data });
    for (const name of ['costCalculator.js', 'settingsManager.js', 'packer.js']) {
        vm.runInContext(fs.readFileSync(path.join(target, 'js', name), 'utf8'), context, { filename: name });
    }
    const evaluate = code => vm.runInContext(code, context, { timeout: 3000 });
    evaluate('var packer = new GuillotinePacker(data.board.height, data.board.width, data.settings.kerf);');
    return { data, context, evaluate, clockReads: () => clockReads };
}
function pack(input = scenario()) {
    const r = runtime(input);
    const start = performance.now();
    r.evaluate('var result = packer.pack(data.items, data.settings.mode);');
    return { caseData: r.data, items: r.data.items, result: JSON.parse(JSON.stringify(r.context.result)), elapsedMs: performance.now() - start };
}
module.exports = { scenario, runtime, pack };
