'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const cases = require('../repeated-layout/cases.json');
const { visibleResult } = require('../repeated-layout/support');
const output = path.resolve(process.env.WOODCUTTER_OUTPUT || path.join(__dirname, '../../output/pdf-size/after'));
const pdfinfo = process.env.PDFINFO || '/Users/zart/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdfinfo';
fs.mkdirSync(output, { recursive: true });
const snapshot = page => page.evaluate(() => JSON.stringify({ result: appState.result, cost: appState.costInfo, parts: appState.cuttingList }));
async function savePdf(page, selector, name) {
  const pending = page.waitForEvent('download'); await page.locator(selector).click();
  const download = await pending, file = path.join(output, name); await download.saveAs(file);
  if (await download.failure()) throw new Error(`${name} 다운로드 실패: ${await download.failure()}`);
  const bytes = fs.statSync(file).size;
  if (bytes > 10_000_000) throw new Error(`${name} 크기 초과: ${bytes}`);
  const info = execFileSync(pdfinfo, [file], { encoding: 'utf8' });
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!pages || !/Page size:\s+595\.28 x 841\.89 pts \(A4\)/.test(info)) throw new Error(`${name} PDF/A4 확인 실패`);
  return { bytes, pages, pdfinfo: info };
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [], pageErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(process.env.WOODCUTTER_URL || 'http://127.0.0.1:8765', { waitUntil: 'networkidle' });
    for (const data of cases) {
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
      const before = await snapshot(page);
      if (/^CASE[1-4]$/.test(data.id)) {
        const actual = JSON.parse(before), fixed = require(`../repeated-layout/baselines/${data.id.toLowerCase()}.json`);
        if (JSON.stringify(visibleResult(actual.result)) !== JSON.stringify(visibleResult(fixed.result))) throw new Error(`${data.id} 배치 기준 변경`);
        if (JSON.stringify(actual.cost) !== JSON.stringify(fixed.cost)) throw new Error(`${data.id} 비용 기준 변경`);
      }
      const original = await savePdf(page, '#downloadPdfBtn', `${data.id}-original.pdf`);
      if (data.id === 'CASE1') {
        const popupEvent = page.waitForEvent('popup');
        await page.locator('#previewPdfBtn').click();
        const popup = await popupEvent;
        await popup.locator('iframe[title="PDF 미리보기"]').waitFor({ state: 'attached', timeout: 15_000 });
        if (!(await popup.locator('iframe[title="PDF 미리보기"]').getAttribute('src')).startsWith('blob:')) throw new Error('기본 PDF 미리보기 Blob 연결 실패');
        await popup.close();
      }
      await page.locator('#compareLayoutBtn').click();
      await page.locator('#repeatedLayoutDialog').waitFor({ state: 'visible' });
      const comparison = await savePdf(page, '#downloadComparisonPdf', `${data.id}-comparison.pdf`);
      if (await snapshot(page) !== before) throw new Error(`${data.id} PDF 생성 뒤 앱 결과가 변경됨`);
      await page.locator('#closeRepeatedLayout').click();
      results.push({ caseId: data.id, original, comparison, unchanged: true });
      if (data.id === 'CASE5') {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.mobile-nav-tab[data-panel="center"]').click();
        const mobileOriginal = await savePdf(page, '#downloadPdfBtn', 'CASE5-mobile-original.pdf');
        await page.locator('#compareLayoutBtn').click();
        const mobileComparison = await savePdf(page, '#downloadComparisonPdf', 'CASE5-mobile-comparison.pdf');
        await page.locator('#closeRepeatedLayout').click();
        if (await snapshot(page) !== before) throw new Error('모바일 PDF 생성 뒤 앱 결과가 변경됨');
        results[results.length - 1].mobile = { original: mobileOriginal, comparison: mobileComparison };
        await page.setViewportSize({ width: 1600, height: 1050 });
      }
    }
    // Exercise page assembly with distinct Canvas content and save those exact generated PDFs.
    const stress = [];
    for (const pageCount of [30, 80]) {
      const pending = page.waitForEvent('download');
      const entry = await page.evaluate(async pageCount => {
        const started = performance.now();
        const result = await PdfExport.buildWithinLimit({ buildDocument: async profile => {
          const doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: profile.compress });
          for (let i = 0; i < pageCount; i++) {
            const canvas = document.createElement('canvas'); canvas.width = 794; canvas.height = 1123;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 794, 1123);
            ctx.fillStyle = '#123'; ctx.font = '20px sans-serif'; ctx.fillText(`fixture ${pageCount} page ${i + 1}`, 50, 80);
            for (let j = 0; j < 70; j++) { ctx.fillRect((i * 17 + j * 31) % 760, (j * 97) % 1080, 8 + (j % 20), 5 + (i % 17)); }
            if (i) doc.addPage();
            doc.addImage(canvas.toDataURL(profile.mimeType, profile.quality), profile.imageFormat, 0, 0, 210, 297, undefined, profile.imageCompression);
          }
          return doc;
        }});
        PdfExport.downloadBlob({ blob: result.blob, filename: `stress-${pageCount}.pdf`, document, URL });
        return { profileId: result.profileId, attempts: result.attempts, bytes: result.blob.size, elapsedMs: Math.round(performance.now() - started) };
      }, pageCount);
      const download = await pending, file = path.join(output, `stress-${pageCount}.pdf`);
      await download.saveAs(file);
      if (await download.failure()) throw new Error(`stress-${pageCount} 다운로드 실패`);
      const info = execFileSync(pdfinfo, [file], { encoding: 'utf8' });
      entry.pageCount = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
      entry.savedBytes = fs.statSync(file).size;
      if (entry.savedBytes !== entry.bytes || entry.pageCount !== pageCount || entry.savedBytes > 10_000_000) throw new Error(`stress-${pageCount} PDF 확인 실패`);
      entry.fixtureNote = 'PDF 계층 다중 페이지 부하 검사, 각 페이지에 서로 다른 도형';
      stress.push(entry);
    }
    const fallback = await page.evaluate(async () => {
      const profiles = [];
      try {
        await PdfExport.buildWithinLimit({ maxBytes: 0, buildDocument: async profile => {
          profiles.push(profile.id);
          const doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: profile.compress });
          doc.text(profile.id, 20, 20); return doc;
        }});
      } catch (error) {
        if (error.code !== 'PDF_SIZE_LIMIT' || error.attempts !== 5) throw error;
        return { profiles, code: error.code, attempts: error.attempts, smallestBytes: error.smallestBytes };
      }
      throw new Error('0바이트 주입 제한에서 예상한 PDF_SIZE_LIMIT 오류가 없었습니다.');
    });
    if (JSON.stringify(fallback.profiles) !== JSON.stringify(['png-fast', 'png-medium', 'png-slow', 'jpeg-92', 'jpeg-85'])) throw new Error('JPEG fallback 순서 오류');
    if (pageErrors.length) throw new Error(`브라우저 오류: ${pageErrors.join('; ')}`);
    const report = { generatedAt: new Date().toISOString(), cases: results, stress, injectedFallback: fallback, browserErrors: pageErrors };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
