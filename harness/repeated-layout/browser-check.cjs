'use strict';
// Run with NODE_PATH pointing to an installed Playwright runtime. No test framework or package install needed.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const cases = require('./cases.json');
const { visibleResult } = require('./support');
const output = process.env.WOODCUTTER_OUTPUT
    ? path.resolve(process.env.WOODCUTTER_OUTPUT) : path.resolve(__dirname, '../../output/playwright');
const baselineOnly = process.env.WOODCUTTER_BASELINE_ONLY === '1';
const baselineFile = process.env.WOODCUTTER_BEFORE_FILE;
const prior = baselineFile && !baselineOnly ? JSON.parse(fs.readFileSync(baselineFile)) : null;
const saved = {};
fs.mkdirSync(output, { recursive: true });
const snapshot = page => page.evaluate(() => JSON.stringify({ result: appState.result, cost: appState.costInfo, parts: appState.cuttingList }));
async function download(page, selector, filename) {
    const pending = page.waitForEvent('download');
    await page.locator(selector).click();
    const file = await pending;
    await file.saveAs(path.join(output, filename));
    assert.equal(await file.failure(), null);
}
(async () => {
    const browser = await chromium.launch({ headless: true });
    const errors = [], results = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(process.env.WOODCUTTER_URL || 'http://127.0.0.1:8765', { waitUntil: 'networkidle' });
        assert.equal(await page.evaluate(() => !!window.jspdf), true, '실제 PDF 라이브러리 로드');
        if (!baselineOnly) assert.equal(await page.locator('#compareLayoutBtn').isDisabled(), true);
        for (const data of cases) {
            // Feed the app's existing public state and visible inputs, then click the real calculate button.
            await page.evaluate(data => {
                appState.reset();
                document.getElementById('boardWidth').value = data.board.width;
                document.getElementById('boardHeight').value = data.board.height;
                document.getElementById('boardThickness').value = data.board.thickness;
                document.getElementById('considerGrain').checked = data.settings.considerGrain;
                SettingsManager.applyToUI({ ...SettingsManager.DEFAULT_SETTINGS, ...data.settings });
                appState.updateBoardSpec({ ...data.board, considerGrain: data.settings.considerGrain });
                data.items.forEach(item => appState.addPart({ ...item, rotatable: item.allowRotate }));
            }, data);
            await page.locator('#calculateBtn').click();
            await page.waitForFunction(() => appState.result && !document.getElementById('calculateBtn').disabled);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const before = await snapshot(page);
            saved[data.id] = JSON.parse(before);
            if (prior) assert.deepEqual(JSON.parse(before), prior[data.id], `${data.id}: 해당 버전 이식 전후 결과 일치`);
            if (/^CASE[1-4]$/.test(data.id)) {
                const fixed = require(`./baselines/${data.id.toLowerCase()}.json`);
                const actual = JSON.parse(before);
                assert.equal(JSON.stringify(visibleResult(actual.result)), JSON.stringify(visibleResult(fixed.result)), data.id);
                assert.deepEqual(actual.cost, fixed.cost);
            }
            if (baselineOnly) continue;
            assert.equal(await page.locator('#compareLayoutBtn').isDisabled(), false);
            const dimensions = await page.evaluate(() => ({
                actual: { width: appState.result.bins[0].width, height: appState.result.bins[0].height },
                comparison: RepeatedLayoutUI.createSnapshot(appState).input.board
            }));
            assert.deepEqual(dimensions.comparison, dimensions.actual, '각 버전의 유효 판재 크기 보존');
            await page.locator('#compareLayoutBtn').click();
            assert.equal(await page.locator('#repeatedLayoutDialog').evaluate(d => d.open), true);
            const count = await page.locator('#repeatedLayoutCandidate canvas').count();
            assert.equal(count, data.expected.candidate ? 1 : 0, data.id);
            await page.locator('#repeatedLayoutEnabled').uncheck();
            assert.equal(await page.locator('#repeatedLayoutCandidate canvas').count(), 0);
            await page.locator('#repeatedLayoutEnabled').check();
            assert.equal(await page.locator('#repeatedLayoutCandidate canvas').count(), count);
            assert.equal(await snapshot(page), before, '후보 ON/OFF로 기존 결과 변경 금지');
            if (data.id === 'CASE1' || data.id === 'CASE5') {
                await page.locator('#repeatedLayoutDialog').screenshot({ path: path.join(output, `${data.id}-comparison.png`) });
                await download(page, '#downloadComparisonPdf', `${data.id}-comparison.pdf`);
                assert.equal(await snapshot(page), before, '비교 PDF가 기존 상태를 변경하면 안 됨');
            }
            if (data.id === 'CASE5') {
                await page.setViewportSize({ width: 390, height: 844 });
                assert.equal(await page.locator('#repeatedLayoutDialog').evaluate(d => d.scrollWidth <= d.clientWidth + 1), true);
                assert.equal(await page.locator('.rlc-diagram').first().evaluate(d => d.scrollWidth > d.clientWidth), true);
                await page.locator('.rlc-diagram').first().evaluate(d => { d.scrollLeft = 100; });
                assert.ok(await page.locator('.rlc-diagram').first().evaluate(d => d.scrollLeft > 0));
                await page.locator('#repeatedLayoutDialog').screenshot({ path: path.join(output, 'CASE5-mobile.png') });
                await page.setViewportSize({ width: 1600, height: 1050 });
            }
            await page.locator('#closeRepeatedLayout').click();
            if (data.id === 'CASE5') await download(page, '#downloadPdfBtn', 'CASE5-original.pdf');
            assert.equal(await snapshot(page), before);
            // Invalidate even edits that have not yet been committed to appState.
            await page.locator('#partWidth').fill('261');
            assert.equal(await page.locator('#compareLayoutBtn').isDisabled(), true);
            results.push({ case: data.id, candidate: count === 1, unchanged: true, invalidated: true });
        }
        if (baselineOnly) {
            fs.writeFileSync(baselineFile || path.join(output, 'before.json'), JSON.stringify(saved, null, 2));
            console.log(JSON.stringify({ baselineCaptured: Object.keys(saved).length, output }));
            return;
        }
        // A complete end-user input path, independent of the fixture-loading helper.
        await page.reload({ waitUntil: 'networkidle' });
        await page.locator('#considerGrain').check();
        for (const [length, quantity] of [[450, 8], [350, 8]]) {
            await page.locator('#partWidth').fill('260');
            await page.locator('#partHeight').fill(String(length));
            await page.locator('#partQty').fill(String(quantity));
            await page.locator('#addPartBtn').click();
        }
        await page.locator('#calculateBtn').click();
        await page.locator('#compareLayoutBtn').click();
        assert.equal(await page.locator('#repeatedLayoutCandidate canvas').count(), 1);
        await page.locator('#closeRepeatedLayout').click();
        await page.locator('#boardWidth').fill('1200');
        assert.equal(await page.locator('#compareLayoutBtn').isDisabled(), true);
        assert.deepEqual(errors, [], '브라우저 실행 오류');
        fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ results, manualEntry: 'PASS', errors }, null, 2));
        console.log(JSON.stringify({ cases: results.length, manualEntry: 'PASS', errors, output }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
