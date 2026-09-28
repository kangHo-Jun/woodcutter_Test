'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cases = require('./cases.json');
const { runScenario, assertProtected, assertValid } = require('./support');

for (const [index, scenario] of cases.entries()) {
    test(`${scenario.id}: 현재 프로그램의 유효한 기준 결과 유지`, () => {
        const baseline = index < 4
            ? require(`./baselines/${scenario.id.toLowerCase()}.json`)
            : null;
        for (let repeat = 0; repeat < 3; repeat++) {
            const run = runScenario(scenario);
            assertValid(run);
            assert.equal(run.result.bins.length, scenario.expected.bins ?? 1);
            if (baseline) assertProtected(run, baseline);
            if (scenario.expected.effectiveWidth !== undefined) {
                assert.ok(Math.abs(run.caseData.board.width - scenario.expected.effectiveWidth) < 1e-6);
            }
        }
    });
}
