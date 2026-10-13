'use strict';
// Existing project Playwright runtime; no installs and no production modifications.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { prepareCase, visibleResult, assertValid } = require('../repeated-layout/support');
const { scenario } = require('./runtime.cjs');
const scenarios = [...require('../repeated-layout/cases.json'), require('../residual-labels/case11.json')];
const target = process.argv[2] || 'Test';
const baseline = require(`../residual-labels/baselines/${target}.json`);
const out = path.resolve(__dirname, '../../output/partition-budget', target);
fs.mkdirSync(out, { recursive: true });
const url = `http://127.0.0.1:8893/woodcutter_${target}/`;
(async () => {
    const browser = await chromium.launch({ headless: true });
    const errors = [], results = [];
    try {
        async function pageFor(viewport) {
            const page = await browser.newPage({ viewport, acceptDownloads: true });
            page.setDefaultTimeout(10000);
            page.on('pageerror', e => errors.push(e.message));
            page.on('dialog', async d => { errors.push('dialog: ' + d.message()); await d.dismiss(); });
            await page.goto(url, { waitUntil: 'networkidle' });
            assert(await page.evaluate(() => !!window.jspdf), 'real PDF library available');
            const source = await page.locator('script[src*="js/packer.js"]').getAttribute('src');
            assert(source.includes('20261013-partition-budget-1'), 'versioned fixed engine');
            await page.evaluate(() => {
                const original = GuillotinePacker.prototype.pack;
                GuillotinePacker.prototype.pack = function(...args) {
                    const start = performance.now();
                    const result = original.apply(this, args);
                    window.__packMs = performance.now() - start;
                    return result;
                };
            });
            return page;
        }
        async function calculate(page) {
            const start = performance.now();
            await page.locator('#calculateBtn').click();
            await page.waitForFunction(() => appState.result && !document.getElementById('calculateBtn').disabled, null, { timeout: 3000 });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            return { ...(await page.evaluate(() => ({ result: appState.result, cost: appState.costInfo, packMs: window.__packMs, settings: appState.settings }))), uiMs: performance.now() - start };
        }
        async function pdf(page, name, mobile = false) {
            const before = await page.evaluate(() => JSON.stringify({ result: appState.result, cost: appState.costInfo }));
            if (mobile) await page.locator('[data-panel="center"]').click();
            const [file] = await Promise.all([
                page.waitForEvent('download'),
                page.locator('#downloadPdfBtn').click()
            ]);
            const save = path.join(out, name + '.pdf');
            await file.saveAs(save);
            assert.equal(await file.failure(), null);
            const bytes = fs.readFileSync(save);
            assert(bytes.subarray(0, 5).toString() === '%PDF-');
            assert(bytes.length <= 10000000);
            assert.equal(await page.evaluate(() => JSON.stringify({ result: appState.result, cost: appState.costInfo })), before);
            return bytes.length;
        }
        const page = await pageFor({ width: 1600, height: 1100 });
        for (const s of scenarios) {
            await page.evaluate(d => {
                appState.reset();
                for (const [id, val] of Object.entries({ boardWidth: d.board.width, boardHeight: d.board.height, boardThickness: d.board.thickness })) document.getElementById(id).value = val;
                document.getElementById('considerGrain').checked = d.settings.considerGrain;
                SettingsManager.applyToUI({ ...SettingsManager.DEFAULT_SETTINGS, ...d.settings, cutDirection: d.settings.mode });
                appState.updateBoardSpec({ ...d.board, considerGrain: d.settings.considerGrain });
                d.items.forEach(item => appState.addPart({ ...item, rotatable: item.allowRotate }));
            }, s);
            const data = await calculate(page), old = baseline.cases.find(c => c.id === s.id), prepared = prepareCase(s);
            assert.deepEqual(visibleResult(data.result), visibleResult(old.result), s.id + ' layout');
            assert.deepEqual(data.cost, old.cost, s.id + ' cost');
            assertValid({ caseData: prepared, items: prepared.items, result: data.result });
            const pdfBytes = await pdf(page, s.id);
            results.push({ id: s.id, ...data, pdfBytes });
            console.log(target, s.id, 'PASS', data.packMs.toFixed(1) + 'ms');
        }
        await page.close();
        for (const mobile of [false, true]) {
            const p = await pageFor(mobile ? { width: 390, height: 844 } : { width: 1600, height: 1100 });
            for (const [id, val] of Object.entries({ boardWidth: '1220', boardHeight: '2440', boardThickness: '18', kerfInput: '4.2' })) await p.locator('#' + id).fill(val);
            await p.locator('#considerGrain').uncheck();
            await p.locator('#enableTrim').uncheck();
            await p.locator('#partRotatable').check();
            for (const size of ['205', '105']) {
                await p.locator('#partWidth').fill(size);
                await p.locator('#partHeight').fill(size);
                await p.locator('#partQty').fill('12');
                await p.locator('#addPartBtn').click();
            }
            const data = await calculate(p), prepared = prepareCase(scenario());
            assert.equal(data.result.bins.length, 1);
            assert.equal(data.result.bins[0].placed.length, 24);
            assertValid({ caseData: prepared, items: prepared.items, result: data.result });
            assert(data.packMs < 1000, 'real engine should finish within 1 second');
            assert(data.uiMs < 3000, 'UI should show result within 3 seconds');
            await p.locator('#groupCanvas-0').screenshot({ path: path.join(out, mobile ? 'reported-mobile.png' : 'reported-desktop.png') });
            const pdfBytes = await pdf(p, mobile ? 'reported-mobile' : 'reported-desktop', mobile);
            results.push({ id: mobile ? 'reported-mobile' : 'reported-desktop', ...data, pdfBytes });
            console.log(target, mobile ? 'MOBILE' : 'DESKTOP', 'PASS', data.packMs.toFixed(1) + 'ms', data.uiMs.toFixed(1) + 'ms UI');
            await p.close();
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ target, errors, cases: results }, null, 2));
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
