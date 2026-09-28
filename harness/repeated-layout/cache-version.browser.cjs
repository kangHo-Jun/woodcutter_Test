'use strict';

// Reproduce an already-loaded build that has cached the pre-adoption scripts.
// The next document load must request the versioned current assets and calculate CASE5 correctly.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const currentHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'js/main-unified.js'), 'utf8');
const repeatedSource = fs.readFileSync(path.join(root, 'js/repeatedLayout.js'), 'utf8');
const adoptionStart = mainSource.indexOf('            // The approved customer drawing is the only current production');
const adoptionEnd = mainSource.indexOf('\n            if (result.unplaced.length > 0)', adoptionStart);
assert.ok(adoptionStart >= 0 && adoptionEnd > adoptionStart, 'pre-adoption app script fixture boundary changed');
const staleMain = mainSource.slice(0, adoptionStart) + mainSource.slice(adoptionEnd);
const staleRepeated = repeatedSource.replace(
    'const api = Object.freeze({ compareLayouts, approvedDefaultResult });',
    'const api = Object.freeze({ compareLayouts });'
);
assert.notEqual(staleRepeated, repeatedSource, 'pre-adoption repeated layout fixture boundary changed');
const staleHtml = currentHtml.replace(
    /<script src="(js\/(?:main-unified|repeatedLayout)\.js)\?v=[^"]+"><\/script>/g,
    '<script src="$1"></script>'
);
assert.notEqual(staleHtml, currentHtml, 'entry page must version both app scripts');

const staleAssetRequests = [], currentAssetRequests = [];
let firstDocument = true;
const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
        const body = firstDocument ? staleHtml : currentHtml;
        firstDocument = false;
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(body);
        return;
    }

    const appScript = /^\/js\/(main-unified|repeatedLayout)\.js$/.exec(requestUrl.pathname);
    if (appScript) {
        const name = `${appScript[1]}.js`;
        if (!requestUrl.searchParams.has('v')) {
            staleAssetRequests.push(requestUrl.pathname);
            response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
            response.end(name === 'main-unified.js' ? staleMain : staleRepeated);
            return;
        }
        currentAssetRequests.push({ path: requestUrl.pathname, version: requestUrl.searchParams.get('v') });
    }

    const filePath = path.resolve(root, `.${decodeURIComponent(requestUrl.pathname)}`);
    if (!filePath.startsWith(root + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404); response.end('Not found'); return;
    }
    const extension = path.extname(filePath);
    const type = extension === '.js' ? 'text/javascript; charset=utf-8'
        : extension === '.css' ? 'text/css; charset=utf-8'
            : extension === '.json' ? 'application/json; charset=utf-8' : 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' });
    fs.createReadStream(filePath).pipe(response);
});

async function calculateCase5(page) {
    await page.evaluate(() => {
        appState.reset();
        document.getElementById('boardWidth').value = '1220';
        document.getElementById('boardHeight').value = '2440';
        document.getElementById('boardThickness').value = '18';
        document.getElementById('considerGrain').checked = true;
        SettingsManager.applyToUI({ ...SettingsManager.DEFAULT_SETTINGS, kerf: 4.2,
            enableTrim: false, cutDirection: 'auto' });
        appState.updateBoardSpec({ width: 1220, height: 2440, thickness: 18, considerGrain: true });
        appState.addPart({ id: 'A', width: 260, height: 450, qty: 8, allowRotate: false, rotatable: false });
        appState.addPart({ id: 'B', width: 260, height: 350, qty: 8, allowRotate: false, rotatable: false });
    });
    await page.locator('#calculateBtn').click();
    await page.waitForFunction(() => appState.result && !document.getElementById('calculateBtn').disabled);
    return page.evaluate(() => ({
        engine: appState.result.engine,
        placed: appState.result.bins.reduce((count, bin) => count + bin.placed.length, 0),
        rows: (() => {
            const parts = appState.result.bins.flatMap(bin => bin.placed);
            const rowMap = new Map();
            for (const part of parts) {
                const y = Math.round(part.y * 10) / 10;
                if (!rowMap.has(y)) rowMap.set(y, []);
                rowMap.get(y).push({ x: Math.round(part.x * 10) / 10, width: part.width });
            }
            return [...rowMap].sort((a, b) => a[0] - b[0]).map(([y, row]) => ({
                y, parts: row.sort((a, b) => a.x - b.x)
            }));
        })(),
        cuts: appState.costInfo.totalCuts,
        cost: appState.costInfo.totalCuttingCost,
        displayedCuts: document.getElementById('totalCutCount').textContent
    }));
}

(async () => {
    await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
    const address = server.address();
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
        assert.equal(await page.evaluate(() => typeof RepeatedLayout.approvedDefaultResult), 'undefined',
            'initial stale cached build must not include the approved adoption hook');
        const staleResult = await calculateCase5(page);
        assert.equal(staleResult.cuts, 16, 'stale unversioned assets reproduce the old staggered baseline');

        await page.reload({ waitUntil: 'networkidle' });
        assert.deepEqual(staleAssetRequests.sort(), ['/js/main-unified.js', '/js/repeatedLayout.js']);
        assert.deepEqual(currentAssetRequests.map(item => item.path).sort(), ['/js/main-unified.js', '/js/repeatedLayout.js']);
        assert.ok(currentAssetRequests.every(item => item.version), 'current app scripts must carry version query parameters');
        assert.equal(new Set(currentAssetRequests.map(item => item.version)).size, 1,
            'calculation scripts should move to one coherent revision together');
        assert.equal(await page.evaluate(() => typeof RepeatedLayout.approvedDefaultResult), 'function');
        const currentResult = await calculateCase5(page);
        const expectedRows = [0, 264.2, 528.4, 792.6].map(y => ({ y, parts: [
            { x: 0, width: 450 }, { x: 454.2, width: 450 },
            { x: 908.4, width: 350 }, { x: 1262.6, width: 350 }
        ] }));
        assert.deepEqual(currentResult, {
            engine: 'REPEATED_LAYOUT', placed: 16, rows: expectedRows,
            cuts: 20, cost: 30000, displayedCuts: '20회'
        }, 'after reload the new asset URLs must apply the CASE5 default result');
        console.log(JSON.stringify({ staleAssets: staleAssetRequests, currentAssets: currentAssetRequests,
            staleResult, currentResult, reloadFixesCase5: true }, null, 2));
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
