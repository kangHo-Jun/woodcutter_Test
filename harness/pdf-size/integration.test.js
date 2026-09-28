'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '../../', file), 'utf8');

test('기본 다운로드와 미리보기가 같은 용량 검증된 Blob을 사용한다', () => {
  const main = read('js/main-unified.js');
  assert.match(main, /PdfExport\.buildWithinLimit/);
  assert.match(main, /PdfExport\.downloadBlob\(\{ blob: pdfBlob/);
  assert.match(main, /const preview = window\.open\('about:blank', '_blank'\)/);
  assert.match(main, /frame\.src = url/);
  assert.match(main, /error\.code === 'PDF_SIZE_LIMIT'/);
});

test('비교 PDF도 공통 빌더/저장 경로를 사용하고 직접 저장하지 않는다', () => {
  const ui = read('js/repeatedLayoutUI.js');
  assert.match(ui, /await root\.PdfExport\.buildWithinLimit/);
  assert.match(ui, /root\.PdfExport\.downloadBlob/);
  assert.doesNotMatch(ui, /doc\.save\(/);
  assert.match(ui, /if \(generation !== token\) return/);
});

test('공통 모듈은 jsPDF 뒤에, 앱 호출자들 앞에 로드된다', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('jspdf.umd.min.js') < html.indexOf('js/pdfExport.js'));
  assert.ok(html.indexOf('js/pdfExport.js') < html.indexOf('js/main-unified.js'));
  assert.ok(html.indexOf('js/pdfExport.js') < html.indexOf('js/repeatedLayoutUI.js'));
});
