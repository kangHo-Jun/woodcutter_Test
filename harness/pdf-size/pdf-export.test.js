'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWithinLimit, assertWithinLimit, downloadBlob } = require('../../js/pdfExport.js');

test('10MB 경계를 포함한다', () => {
  assert.doesNotThrow(() => assertWithinLimit({ size: 9_999_999 }));
  assert.doesNotThrow(() => assertWithinLimit({ size: 10_000_000 }));
  assert.throws(() => assertWithinLimit({ size: 10_000_001 }), { code: 'PDF_SIZE_LIMIT' });
});

test('초과하면 새 문서로 다시 만들고 첫 적합 결과에서 끝낸다', async () => {
  const calls = [];
  const result = await buildWithinLimit({ maxBytes: 100, buildDocument: async profile => {
    calls.push(profile.id);
    const size = calls.length === 1 ? 101 : 100;
    return { output: type => { assert.equal(type, 'blob'); return new Blob([new Uint8Array(size)]); } };
  }});
  assert.equal(result.blob.size, 100);
  assert.deepEqual(calls, ['png-fast', 'png-medium']);
  assert.equal(result.attempts, 2);
});

test('첫 PNG 적합 시 JPEG를 시도하지 않는다', async () => {
  const calls = [];
  const result = await buildWithinLimit({ buildDocument: async profile => {
    calls.push(profile.id); return { output: () => new Blob(['ok']) };
  }});
  assert.equal(result.profileId, 'png-fast'); assert.equal(result.attempts, 1);
  assert.deepEqual(calls, ['png-fast']);
});

test('모든 단계 초과 시 5회 후 실제 최소 바이트를 오류로 반환한다', async () => {
  const sizes = [40, 60, 21, 35, 50]; let i = 0;
  await assert.rejects(buildWithinLimit({ maxBytes: 20, buildDocument: async () => ({ output: () => new Blob([new Uint8Array(sizes[i++])]) }) }),
    error => error.code === 'PDF_SIZE_LIMIT' && error.smallestBytes === 21 && error.attempts === 5);
  assert.equal(i, 5);
});

test('문서 생성 오류는 재시도하지 않고 전파한다', async () => {
  let calls = 0; const failure = new Error('render failed');
  await assert.rejects(buildWithinLimit({ buildDocument: async () => { calls++; throw failure; } }), failure);
  assert.equal(calls, 1);
});

test('초과 Blob은 다운로드를 시작하지 않는다', () => {
  let created = 0, clicked = 0;
  const URL = { createObjectURL() { created++; return 'blob:test'; }, revokeObjectURL() {} };
  const document = { createElement() { return { click() { clicked++; } }; } };
  assert.throws(() => downloadBlob({ blob: { size: 10_000_001 }, filename: 'x.pdf', document, URL }), { code: 'PDF_SIZE_LIMIT' });
  assert.equal(created, 0); assert.equal(clicked, 0);
});

test('정상 저장은 filename을 유지하고 한 번 클릭 후 URL을 정리한다', () => {
  let clicked = 0, revoked = 0, created = 0; let anchor;
  const URL = { createObjectURL() { created++; return 'blob:test'; }, revokeObjectURL(url) { assert.equal(url, 'blob:test'); revoked++; } };
  const document = { createElement(tag) { assert.equal(tag, 'a'); return anchor = { click() { clicked++; } }; } };
  downloadBlob({ blob: { size: 10 }, filename: 'sample.pdf', document, URL, schedule: callback => callback() });
  assert.equal(anchor.download, 'sample.pdf'); assert.equal(anchor.href, 'blob:test');
  assert.equal(created, 1); assert.equal(clicked, 1); assert.equal(revoked, 1);
});
