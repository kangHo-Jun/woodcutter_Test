# PDF 10MB 이하 저장 — Luna 개발 계획서

작성일: 2026-09-28 · 설계: Astra · 구현 담당: Luna · 상태: 계획 작성 완료, 구현 미착수

## 목표와 사용자 요구

기본 재단계획 PDF와 반복배치 비교 PDF를 10MB 이하로 다운로드하도록 개선한다. 기존 재단 배치, 절단 횟수, 요금, 나뭇결, 회전, 전단 규칙을 보존한다. Test에서 TDD로 개발하고 검증한다. **v4와 v10은 모든 수정이 끝난 뒤 함께 반영한다. 이번 PDF 개발 완료만으로 이식을 시작하지 않는다.**

이 문서가 구현 명세다. 개발은 Luna가 수행한다. Astra의 현재 작업은 계획 작성이며 구현 실행이나 다른 작업 자동 생성은 포함하지 않는다.

10MB는 보수적으로 **10,000,000바이트 이하(경계 포함)**로 정의한다. 파일 크기는 최종 PDF Blob.size로 판정한다. 이미지 크기 합계나 base64 길이로 판정하지 않는다.

## 구조와 기술

기존 Canvas 도면 작성 코드는 유지하고, PDF 문서 생성·압축·최종 용량 검사를 공통 `PdfExport` 모듈로 분리한다. 현재 기술인 브라우저 JavaScript, Canvas, jsPDF 2.5.1, Node 내장 test, 기존 Playwright 검증 방식을 유지한다. 라이브러리 업그레이드와 서버 업로드는 범위 밖이다.

### 현재 코드에서 확인한 수정 지점

| 파일 | 현재 동작 | 수정 범위 |
|---|---|---|
| `js/main-unified.js` | `generatePdfBlob()`이 기본 PDF 생성. preview/download 모두 호출. 압축·최종 용량 검사 없음 | PDF 생성과 이미지 삽입 부분 및 오류 처리 |
| `js/repeatedLayoutUI.js` | `downloadPdf()`가 compress:true와 PNG FAST 사용 후 doc.save 직접 호출 | 공통 생성/저장 경로 연결, 비동기 오류·중복 클릭 처리 |
| `index.html` | jsPDF와 위 모듈 로드 | 공통 모듈을 두 호출자보다 먼저 로드 |
| `js/pdfGenerator.js` | 별도 구형 구현 존재. 현재 main-unified.js에서 참조하지 않음 | 실제 호출 여부 확인만. 사용하지 않는 파일만 고쳐 완료 처리하지 말 것 |

기본 페이지 Canvas는 794×1123, 비교 페이지는 1654×2339이다. A4 210×297mm, 페이지 순서, 글자·치수·도면 위치는 유지한다. 기존 비교 스냅샷은 결과 bin의 실제 width/height를 사용한다. 이를 입력치 재계산으로 바꾸면 버전별 전단 차이가 깨질 수 있다.

### 변경 금지 조건

- packer, costCalculator, state, settingsManager, repeatedLayout 후보 알고리즘을 수정하지 않는다.
- boardHeight=길이=X, boardWidth=폭=Y 축 규칙을 유지한다.
- 비교 후보를 자동 채택하거나 요금에 반영하지 않는다.
- 기존 CASE1~4 기대 결과와 10개 회귀 fixture를 변경하여 테스트를 통과시키지 않는다.
- 페이지 삭제, 치수 생략, 자동 분할, Canvas 축소를 하지 않는다.
- v4/v10 코드·문서·태그를 이번 구현 중 수정하지 않는다. 기존 미커밋 작업도 보존한다.

## 공통 모듈 계약

새 파일 `js/pdfExport.js`는 브라우저 `window.PdfExport`와 Node CommonJS export를 제공한다. DOM과 jsPDF 의존은 함수 인자로 전달하여 용량 판단을 실제 브라우저 없이 검사할 수 있게 한다.

```js
MAX_PDF_BYTES = 10_000_000
buildWithinLimit({ buildDocument, maxBytes = MAX_PDF_BYTES })
// Promise<{ blob, profileId, attempts }>
// buildDocument(profile)는 매 시도 새 jsPDF 문서를 반환한다.
assertWithinLimit(blob, maxBytes = MAX_PDF_BYTES)
// 초과 시 code === 'PDF_SIZE_LIMIT' 오류
downloadBlob({ blob, filename, document, URL })
// 저장 직전에 운영 상한으로 재검사 후 anchor 다운로드, URL 정리
```

`buildWithinLimit`은 다음 순서로 최대 5회 시도한다. 매 시도 새 문서를 만들고 **전체 페이지**를 그린 뒤 `doc.output('blob')`을 검사한다. 처음 기준을 만족한 결과에서 종료한다. 프로파일은 공통 모듈이 소유하며 호출자가 별도 품질 정책을 만들지 않는다.

| profileId | Canvas 인코딩 | addImage 형식/압축 | 문서 설정 |
|---|---|---|---|
| png-fast | image/png | PNG / FAST | compress:true |
| png-medium | image/png | PNG / MEDIUM | compress:true |
| png-slow | image/png | PNG / SLOW | compress:true |
| jpeg-92 | image/jpeg, quality 0.92 | JPEG | compress:true |
| jpeg-85 | image/jpeg, quality 0.85 | JPEG | compress:true |

PNG는 무손실 우선 경로다. JPEG는 PNG가 모두 용량을 초과할 때만 사용하는 제한된 대안이다. JPEG는 픽셀 동일성을 보장하지 않으므로 별도 가독성 검증을 반드시 통과해야 한다. 흰 배경을 그린 기존 Canvas와 원래 해상도를 유지하며 품질 0.85 미만으로 내리지 않는다. 압축 단계별 용량이 반드시 단조 감소한다고 가정하지 않는다.

모두 초과하면 `PDF_SIZE_LIMIT` 오류에 `smallestBytes`, `attempts`를 포함하고 다운로드하지 않는다. 사용자 문구: “PDF를 10MB 이하로 만들지 못했습니다. 도면 품질을 유지하기 위해 저장을 중단했습니다.” 저장 실패는 정상 성공으로 보고하지 않는다. 무제한 페이지를 가독성 유지와 단일 파일 10MB 조건 아래 항상 저장할 수 있다는 보장은 하지 않는다. 실제 지원 사례에서 이 오류가 발생하면 해당 사례는 완료 기준 미달이며 추가 설계를 보고한다.

기본 미리보기도 같은 검증된 Blob을 사용한다. 기존 doc.save 우회 경로를 제거한다. preview에는 다운로드를 붙이지 않는다. Object URL은 다운로드 또는 미리보기 사용이 끝나기 전에 해제하지 않는다.

## 작업 1 — 현재 상태와 회귀 기준 확보

- [ ] 전역 안내, Test의 `docs/AGENTS.md`, `docs/context.md`, 상위 `HANDOFF.md`를 읽는다.
- [ ] 세 저장소의 git status/diff 및 보호 파일 SHA-256을 `output/pdf-size/before/`에 기록한다. untracked 파일도 목록과 필요한 사본을 보관한다. 복원 태그만으로 미커밋 변경이 백업되었다고 간주하지 않는다.
- [ ] Test에만 코딩 전 복원 태그를 만든다. 같은 이름이 있으면 덮어쓰지 않는다.
- [ ] 아래 기존 검사를 실행해 기준 상태를 기록한다. 실패 시 새 변경에 의한 실패와 구분한다.

```sh
node --test harness/repeated-layout/*.test.js
node harness/regression.js
```

기존 기록은 28개 테스트 및 기존 regression 8개 통과다. 이번 실행 결과를 다시 기록한다. `known-issues/three-length-300.json`의 기존 절단선 문제는 별도 이슈이며 이번 변경으로 수정했다고 보고하지 않는다.

- [ ] 현재 CASE1/CASE5 기본·비교 PDF를 저장해 bytes, 페이지 수와 렌더 이미지를 보관한다. 2026-09-22의 기본 CASE5 7,137,798바이트, 비교 CASE5 287,353바이트는 참고 기록이며 현재 측정을 대체하지 않는다.

## 작업 2 — 용량 정책부터 RED → GREEN

새 테스트 `harness/pdf-size/pdf-export.test.js`를 먼저 작성한다. 실제 구현 파일이 없어 실패하는 것을 확인하고 최소 구현을 추가한다. 각 기능별 실패 → 구현 → 통과 순서로 진행한다.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWithinLimit, assertWithinLimit } = require('../../js/pdfExport.js');

test('10MB 경계를 포함한다', () => {
  assert.doesNotThrow(() => assertWithinLimit({ size: 9_999_999 }));
  assert.doesNotThrow(() => assertWithinLimit({ size: 10_000_000 }));
  assert.throws(() => assertWithinLimit({ size: 10_000_001 }),
    { code: 'PDF_SIZE_LIMIT' });
});

test('초과하면 새 문서로 다시 만들고 첫 적합 결과에서 끝낸다', async () => {
  const calls = [];
  const result = await buildWithinLimit({
    maxBytes: 100,
    buildDocument: async profile => {
      calls.push(profile.id);
      const size = calls.length === 1 ? 101 : 100;
      return { output: type => {
        assert.equal(type, 'blob');
        return new Blob([new Uint8Array(size)]);
      } };
    }
  });
  assert.equal(result.blob.size, 100);
  assert.deepEqual(calls, ['png-fast', 'png-medium']);
  assert.equal(result.attempts, 2);
});
```

추가 필수 검사:

- [ ] 첫 PNG 통과 시 한 번만 생성하고 JPEG를 호출하지 않는다.
- [ ] 모든 단계 초과 시 정확히 5회 후 실패하고 smallestBytes가 실제 최소값이다.
- [ ] 중간 생성 오류는 용량 초과와 구분하여 전파한다. 무한 재시도하지 않는다.
- [ ] downloadBlob은 초과 Blob에서 anchor.click/createObjectURL을 호출하지 않는다.
- [ ] 정상 저장은 한 번만 클릭하고 filename 보존 및 URL 정리를 수행한다.

```sh
node --test harness/pdf-size/pdf-export.test.js
```

GREEN 후 리팩터링은 이 모듈 내부에서만 한다. 테스트의 작은 maxBytes는 정책 검사 전용이며 운영 UI에 상한 변경 옵션을 노출하지 않는다.

## 작업 3 — 기본 PDF 연결

- [ ] `harness/pdf-size/integration.test.js`에 기본 다운로드/미리보기가 공통 정책을 통과하는지 검사하는 실패 테스트를 추가한다.
- [ ] `index.html`에 `js/pdfExport.js`를 jsPDF 이후, main-unified 및 비교 모듈 이전에 추가한다.
- [ ] `generatePdfBlob()`이 `buildWithinLimit`을 호출하고 결과의 blob을 반환하도록 수정한다. 생성자에는 기존 A4 설정과 compress:true를 사용한다.
- [ ] `addSummaryPageAsImage`와 `addDiagramPageAsImage`에 profile과 내보내기 스냅샷을 전달한다. 변경은 데이터 참조·마지막 인코딩/addImage에 한정하고 그리기 좌표와 문구는 유지한다.
- [ ] 시작 시 필요한 설정/요금/결과와 groupCanvases 목록을 고정한다. 기존 그리기 함수가 AppState를 다시 읽어 재시도별 내용이 바뀌지 않게 한다. 원본 Canvas를 재사용 중 다른 렌더가 수정할 수 있으면 페이지 소스 사본을 확보한다.
- [ ] 기본 다운로드는 검증된 blob을 `downloadBlob`으로 저장한다. 미리보기는 검증 성공 후만 연다. 오류 종류별 사용자 문구를 연결한다.
- [ ] 생성 중 PDF 버튼을 비활성화하고 finally에서 복구한다. 앱 재단 상태를 수정하지 않는다.

## 작업 4 — 비교 PDF 연결

- [ ] 비교 경로가 같은 용량 정책을 사용하며 doc.save로 우회하지 않는 실패 테스트를 추가한다.
- [ ] `downloadPdf()`를 async로 바꾸고 기존 페이지 생성 루프를 buildDocument(profile) 안으로 옮긴다. 버전 표기, 비용 면책 문구, 절단 순서, 페이지 수/순서를 보존한다.
- [ ] 현재 `safe(fn)`은 동기 try/catch이므로 async rejection을 놓친다. PDF 이벤트에서 await/catch/finally를 사용하거나 safe가 Promise rejection도 처리하도록 범위를 제한해 수정한다.
- [ ] 버튼 중복 클릭은 작업 한 건으로 제한한다. 비교 입력 변경으로 snapshot이 무효화되면 진행 중인 결과를 저장하지 않는다. generation token으로 검사하고 finally에서 최신 버튼 상태를 덮어쓰지 않는다.
- [ ] 원본/후보 페이지 Canvas 및 스냅샷을 작업 시작 시 고정한다. 재시도 문서마다 원본/후보의 같은 페이지를 사용한다.
- [ ] 기본/비교 공통으로 순차 페이지 생성 후 임시 Canvas 참조를 해제한다. 여러 압축 시도의 문서와 전체 페이지 사본을 계속 누적하지 않는다.

## 작업 5 — 실제 파일과 회귀 검증

새 `harness/pdf-size/browser-check.cjs`는 기존 Playwright 스크립트의 실행 방식을 따른다. `WOODCUTTER_URL` 기본값은 Test URL, `WOODCUTTER_OUTPUT` 기본값은 `output/pdf-size/after`로 둔다. 설치된 런타임을 확인해 사용하고 패키지를 임의 업그레이드하지 않는다.

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

서버는 Test 디렉터리에서 별도 세션으로 실행한다. 기존 포트 사용 중이면 기존 서버가 Test를 제공하는지 확인한다.

```sh
node --test harness/pdf-size/*.test.js
node --test harness/repeated-layout/*.test.js
node harness/regression.js
WOODCUTTER_URL=http://127.0.0.1:8765 node harness/pdf-size/browser-check.cjs
WOODCUTTER_URL=http://127.0.0.1:8765 node harness/repeated-layout/browser-check.cjs
```

필수 시험 표:

| 시험 | 합격 기준 |
|---|---|
| 기존 CASE1~10 기본/비교 PDF | 모든 다운로드가 10,000,000바이트 이하, PDF 열림, 페이지 누락 없음 |
| CASE1~4 | 기존 배치 좌표·수량·절단·요금 기준과 동일 |
| CASE5 정렬 비교 | 후보 ON/OFF 및 PDF 생성 후 원본 결과·요금 불변 |
| 30페이지·80페이지 생성 fixture | 서로 다른 도면으로 구성해 그룹 중복 제거를 피함. 실제 용량·시간·선택 profile 기록 |
| PNG 초과 → JPEG 진입 | 테스트 주입으로 낮은 상한을 적용하여 분기 확인. 운영 상한은 불변 |
| 모든 단계 초과 | 다운로드/미리보기 없음, 명확한 오류, 버튼 복구, 재시도 가능 |
| 연속 클릭·생성 중 입력 변경 | 중복 파일/오래된 비교 파일/미처리 Promise rejection 없음 |
| 최초 모바일 390×844 | 입력→계산→기본 PDF→비교 PDF 성공, 도면·비용 불변 |

30/80페이지는 PDF 계층 부하 시험이며 가상의 재단 결과를 실제 알고리즘 성능 검증으로 주장하지 않는다. 이 부하에서 저장 실패하면 페이지·내용별 제한을 기록하고 지원 범위를 결정하기 전 완료로 선언하지 않는다.

각 실제 PDF는 `pdfinfo`로 A4/페이지 수를 확인하고 `pdftoppm -png -r 150`으로 렌더링한다. PNG 경로는 같은 해상도로 렌더한 변경 전후 페이지 픽셀을 비교한다. JPEG 경로는 손실 압축이므로 픽셀 동일성을 요구하지 않고, 가장 작은 치수 숫자·한글·가는 절단선·회전 도면을 확대 확인한다. 숫자 구별 실패, 글자 번짐, 절단선 소실은 불합격이다. 모든 페이지의 순서/내용 검증과 대표 페이지 시각 검증을 함께 수행한다.

`output/pdf-size/after/results.json`에 caseId, 종류, profileId, attempts, bytes, pageCount, elapsedMs, 오류, 회귀 결과를 기록한다. 성공 파일만 저장해 실패 사례를 숨기지 않는다. 전후 실제 PDF와 대표 렌더 PNG도 보관한다.

## 작업 6 — 검토와 최종 일괄 반영 준비

- [ ] diff를 확인하여 보호된 계산 파일의 해시가 동일함을 증명한다. v4/v10 상태도 시작 기록과 비교한다.
- [ ] 공통 용량 검사와 다운로드 호출 사이 우회가 없는지 검색한다: `rg -n 'doc\.save|output\(.blob|createObjectURL|addImage' js`.
- [ ] 사용자 사례에서 10MB 저장, 품질, 페이지 보존, 회귀가 모두 통과해야 PDF 수정 완료로 보고한다. 초과 차단 테스트만 통과한 것을 요구 충족으로 보고하지 않는다.
- [ ] Test `docs/context.md`와 상위 `HANDOFF.md`에 수정 파일, 실제 결과, 남은 문제를 기록한다.
- [ ] v4/v10은 계속 동결한다. 사용자의 모든 수정 완료 시점에 검증된 변경 목록을 묶어 버전별 설정 차이를 보존하며 이식하고 각 버전 회귀를 다시 실행한다. 파일 전체 덮어쓰기로 버전 차이를 지우지 않는다.

## Luna에게 전달할 실행 지시

> 이 계획서를 따라 Test에서만 PDF 10MB 제한을 TDD로 구현하라. 기존 미커밋 작업을 보존하고 기본 PDF와 비교 PDF 모두 실제 파일로 검증하라. 재단 알고리즘·요금·CASE1~4 기준 결과를 바꾸지 말라. v4/v10은 모든 수정이 끝난 뒤 일괄 반영할 예정이므로 지금 수정하지 말라. 실제 다운로드 용량, 페이지 수, 가독성, 기존 회귀 결과와 남은 제한을 보고하라. 이번 구현 완료를 이유로 자동 배포하거나 다음 버전에 복사하지 말라.
