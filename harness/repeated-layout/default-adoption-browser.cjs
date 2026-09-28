'use strict';

// End-to-end proof: populate the real app state, click the real calculate button,
// and capture the state consumed by the main UI and standard PDF exporter.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const scenarios = require('./cases.json');
const { visibleResult } = require('./support');

const repo = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.WOODCUTTER_OUTPUT || path.join(repo, 'output/case5-default/after'));
const previous = JSON.parse(fs.readFileSync(path.join(repo, 'output/ten-case-results/results.json'), 'utf8'));
const previousById = new Map(previous.map(entry => [entry.scenario.id, entry]));
const pdfinfo = process.env.PDFINFO || '/Users/zart/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdfinfo';
const pdftoppm = process.env.PDFTOPPM || '/Users/zart/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm';
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ headless: true });
    const results = [], errors = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(process.env.WOODCUTTER_URL || 'http://127.0.0.1:8765', { waitUntil: 'networkidle' });

        for (const scenario of scenarios) {
            await page.evaluate(data => {
                appState.reset();
                document.getElementById('boardWidth').value = data.board.width;
                document.getElementById('boardHeight').value = data.board.height;
                document.getElementById('boardThickness').value = data.board.thickness;
                document.getElementById('considerGrain').checked = data.settings.considerGrain;
                SettingsManager.applyToUI({ ...SettingsManager.DEFAULT_SETTINGS, ...data.settings });
                appState.updateBoardSpec({ ...data.board, considerGrain: data.settings.considerGrain });
                data.items.forEach(item => appState.addPart({ ...item, rotatable: item.allowRotate }));
            }, scenario);
            await page.locator('#calculateBtn').click();
            await page.waitForFunction(() => appState.result && !document.getElementById('calculateBtn').disabled);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const snapshot = await page.evaluate(() => ({
                result: appState.result,
                cost: appState.costInfo,
                parts: appState.cuttingList,
                boardSpec: appState.boardSpec,
                settings: appState.settings,
                displayed: {
                    panels: document.getElementById('totalPanelCount')?.textContent,
                    cuts: document.getElementById('totalCutCount')?.textContent,
                    price: document.getElementById('totalCuttingCost')?.textContent
                }
            }));

            if (scenario.id === 'CASE5') {
                assert.equal(snapshot.result.engine, 'REPEATED_LAYOUT');
                assert.equal(snapshot.result.mode, 'auto');
                assert.equal(snapshot.result.bins.length, 1);
                assert.equal(snapshot.result.bins[0].placed.length, 16);
                assert.equal(snapshot.cost.totalCuts, 20);
                assert.equal(snapshot.cost.totalCuttingCost, 30000);
                assert.deepEqual(snapshot.displayed, { panels: '1장', cuts: '20회', price: '30,000원' });
                assert.equal(snapshot.settings.kerf, 4.2);
                assert.equal(snapshot.boardSpec.considerGrain, true);
                await page.locator('#groupCanvas-0').screenshot({ path: path.join(output, 'CASE5-default-layout.png') });

                const pending = page.waitForEvent('download');
                await page.locator('#downloadPdfBtn').click();
                const download = await pending;
                const pdfPath = path.join(output, 'CASE5-default.pdf');
                await download.saveAs(pdfPath);
                assert.equal(await download.failure(), null);
                const pdfBytes = fs.statSync(pdfPath).size;
                assert.ok(pdfBytes <= 10_000_000, `PDF가 10MB 제한을 넘음: ${pdfBytes}`);
                const info = execFileSync(pdfinfo, [pdfPath], { encoding: 'utf8' });
                assert.match(info, /Page size:\s+595\.28 x 841\.89 pts \(A4\)/);
                const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
                assert.ok(pages >= 1);
                execFileSync(pdftoppm, ['-f', '2', '-l', '2', '-singlefile', '-png', '-r', '120', pdfPath,
                    path.join(output, 'CASE5-default-pdf-page')], { stdio: 'ignore' });
                results.push({ id: scenario.id, result: snapshot.result, costInfo: snapshot.cost,
                    displayed: snapshot.displayed, pdf: { bytes: pdfBytes, pages, pageSize: 'A4' } });
            } else {
                const baseline = previousById.get(scenario.id);
                assert.ok(baseline, `기존 결과 없음: ${scenario.id}`);
                assert.deepEqual(visibleResult(snapshot.result), visibleResult(baseline.result), `${scenario.id} 배치/절단/잔재 변경`);
                assert.deepEqual(snapshot.cost, baseline.cost, `${scenario.id} 비용 변경`);
                results.push({ id: scenario.id, unchangedFromPrevious: true,
                    panelCount: snapshot.result.bins.length, totalCuts: snapshot.cost.totalCuts,
                    totalCuttingCost: snapshot.cost.totalCuttingCost });
            }
        }
        assert.deepEqual(errors, [], `브라우저 예외: ${errors.join('; ')}`);
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({
            generatedAt: new Date().toISOString(), cases: results, browserErrors: errors
        }, null, 2));
        console.log(JSON.stringify({ cases: results.length, output, errors }, null, 2));
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
