# 잔재 실치수 표시 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> 실행 방식은 사용자 승인 범위를 따른다. 현재 요청은 영향 조사와 계획 수립이며 구현·다중 에이전트 실행 지시가 아니다. 제공된 실제 스킬 이름/경로를 확인하고 사용한다.

**Goal:** Test의 기존 재단 결과를 유지하면서 화면과 일반 PDF의 잔재 숫자를 톱날 손실 후 가용 치수로 표시한다.

**Architecture:** 계산 결과는 읽기 전용으로 다룬다. 표시 전용 변환에서 잔재의 실치수를 확보하고 Canvas 숫자만 교체한다. 잔재 데이터 누락을 잘못된 값 또는 빈 목록으로 덮지 않고 호환성 검증에서 검출한다.

**Tech Stack:** Vanilla JavaScript, Canvas, Node test/VM 하네스, 기존 브라우저/PDF 검증 도구.

**Spec:** 아래 범위/불변 조건 및 사용자 대화의 2026-10-08 표시 수정 요청. 기존10개 기준은 `harness/repeated-layout/cases.json`, `harness/bulk-performance/baselines/ten-cases.json`이다.

## Global Constraints

- Test에서만 개발·검증. V4/V10은 승인된 후속 이식까지 미수정.
- packer.js, repeatedLayout.js, costCalculator.js, settingsManager.js, state.js 및 결과 객체 수정 금지.
- 기존 배치·수량·회전·판재수·절단선·절단순서·절단횟수·이용률·요금 완전 보존.
- 원판/부품 치수 숫자, 부품 위치/색상/크기, 절단선, 전단 정책 변경 금지.
- 새 절단 후보·1장 최적화는 이번 범위에서 제외.
- 기존10개 기준값을 새 출력으로 덮어써서 통과시키지 않는다.
- 이번 계획 단계에서는 생산 코드 및 기존 CASE11 테스트 파일을 변경하지 않았다.

## 1. 확인한 원인과 영향 경로

`main-unified.js:1038`은 `bin.freeRects`를 쓰지 않고
`buildDisplayFreeRects(renderedPlaced, renderBoardWidth, renderBoardHeight)`를 호출한다.
이 함수(:1079)는 부품 경계 사이 빈칸을 합산하므로 톱날 소실 영역까지 포함한다.
:1063/:1073의 Math.round가 소수를 정수로 바꾼다.

실제 Test 엔진과 표시 함수를 같은 CASE11 입력에 실행한 결과:

| 잔재 | 현 화면 값 | 실제 freeRects |
|---|---|---|
| D 아래 | 654 × 190 | 649.4 × 185.8 |
| 맨 아래 띠 | 1820 × 70 | 1820 × 65.8 |
| 맨 오른쪽 | 56 × 650 | 51.8 × 650 |

재현 조건: 원판 X1820/Y910, 톱날4.2, 자동, 회전ON, 결OFF, 전단OFF.
A685×840/B300×840/C173×840 각1, D195×650 4개. 실제 사진 전체 설정의 확정은 아니며
위 조건에서 실제 Test 코드로 재현한 표시 결함이다. 진단 출력: `output/residual-label-audit/audit.jsonl`.

호출 관계:

- 기본 반응형 화면: renderAllGroups → drawBinToCanvas → 잔재 숫자.
- 일반PDF/미리보기: generatePdfBlob(:1259)가 groupCanvases를 복사하고 addDiagramPageAsImage에서 사용. PDF 재단 계산을 따로 바꿀 필요 없음.
- 반복배치 비교창/PDF: repeatedLayoutUI.js의 별도 drawBin. 잔재 치수 숫자를 표시하지 않으므로 이번 변경 불필요.
- renderer.js/app.js 구형 경로는 별도 구현. index.html은 main-unified.js로 현재 주 도면을 그림. 이름이 비슷하다는 이유로 구형 파일을 일괄 수정하지 않는다.
- getAxisMinResiduals/buildFreeRects는 현재 js 검색에서 외부 호출을 찾지 못함. 비대상 함수로 남긴다.
- 프로젝트 저장은 입력/설정만 저장한다. 표시 전용 수정을 위해 저장 포맷을 바꾸지 않는다.

## 2. 단순 치환을 막아야 하는 이유

1. CASE2(GPP)의 freeRects는 빈 배열인데 실제 빈 영역은 존재한다. 배열 존재 여부만으로 완전한 목록이라고 판단하면 기존 숫자가 사라진다.
2. CASE2의 cutDetails는 일부 최종 부품 분리 절단을 기록하지 않는다. 절단 기록 재생만으로 모든 잔재를 확정했다고 주장할 수 없다.
3. horizontal 결과에는 freeRects/cutDetails/판재 width·height가 없을 수 있다.
4. 1820mm와650mm처럼 톱날을 추가로 빼면 안 되는 치수도 있다. 모든 값에서4.2를 빼는 처리는 금지.
5. 서로 절단된 잔재를 한 직사각형으로 합치면 존재하지 않는 큰 잔재가 표시된다.
6. 계산 후 입력창 kerf만 바뀌어도 기존 결과를 새 kerf로 해석하면 안 된다. 계산 당시 조건과 결과의 대응을 검사해야 한다.

## 3. 수정 경계와 인터페이스

생산 변경 후보:

- Create `js/residualLabels.js`: 표시 전용 값 계산/검증/숫자 포맷. 결과 객체 수정 없음.
- Modify `js/main-unified.js`: 잔재 숫자 생성 구간만 연결. 기존 도형/절단선 렌더는 유지.
- Modify `index.html`: 모듈 로드 및 관련 main 자산 버전만 갱신.
- Tests `harness/residual-labels/*.test.js`, `browser-check.cjs`: 신규 표시 계약과 기존 결과 불변 검증.

표시 모듈 계약:

```js
// X=길이, Y=폭. board와kerf는 계산 결과 생성 당시 조건.
// labels: [{x, y, width, height, widthText, heightText}]
// unresolved: [{reason, region}] — 추측 없이 계산 불가능한 표시 영역.
ResidualLabels.build({bin, board: {width, height}, kerf});
ResidualLabels.formatMm(value); // 649.3999999999999 → '649.4', 1820 → '1820'
```

값의 근거:

- 검증된 bin.freeRects를 우선 활용하고 같은 영역에서 톱날을 다시 차감하지 않는다.
- 비어 있거나 불완전한 freeRects는 부품·원판·절단 영역과 대조해 누락을 검출한다.
- 누락 영역은 기존 배치와 기록된 절단 조건으로 가용 치수를 유일하게 확정할 수 있는 경우만 표시용으로 보완한다. 기존 위치·절단 정책은 바꾸지 않는다.
- 확정할 수 없는 경우 unresolved로 남기고 테스트를 실패시킨다. 기존 잘못된 값으로 fallback하거나 숫자를 숨겨 완료 처리하지 않는다.
- CASE2/horizontal의 미기록 최종 절단으로 의미가 불명확하면 이를 별도 조사 결과로 보고한다. 표시만 수정한다는 범위를 넘어 엔진을 몰래 변경하지 않는다. 해당 호환성 문제가 해소되기 전 배포하지 않는다.
- 원판 경계/회전/전단을 다시 적용하지 않는다. 유효 판재 크기를 이용한다.
- 숫자는 UI 입력 정밀도0.1mm를 보존하고 부동소수 오차만 제거한다. 더 정밀한 불러오기 데이터는 임의로 크게 반올림하지 않도록 별도 포맷 테스트로 보호한다.
- 표시 필터 MIN_AREA=20000, 축50mm 기준은 유지하되 실치수 적용으로 경계 사례에서 표기가 달라지는 경우를 명시적으로 테스트한다. 숨김을 누락 해결책으로 쓰지 않는다.
- 도형은 그대로. 숫자의 앵커는 해당 실제 잔재와 대응하도록 확인한다. 새로운 색/해칭/선 추가는 이번 범위가 아니다.

## 4. TDD 실행 순서

### Task 1: CASE11 표시 RED 확보

Files: `harness/residual-labels/display.test.js`, `case11.json`, `canvas-probe.cjs`.

- [ ] 기존 4.2mm CASE11 입력으로 실제 pack → main drawBinToCanvas를 실행한다. VM에서 앱 초기화 이벤트만 억제하고 Canvas context의 fillText 호출과 도형 호출을 기록한다. 내부 배치 함수는 mock하지 않는다.
- [ ] 부품 라벨/원판 숫자와 구분하여 잔재 fillText만 검사한다(스타일과 호출 위치/좌표 기록). 폭·높이를 문자열 집합으로만 검사해 다른 부품 숫자로 거짓 통과하지 않도록 한다.
- [ ] 실제 잔재 위치의 기대 문자열을 고정한다.

```js
assert.deepEqual(residualLabels.map(r => [r.widthText, r.heightText]).sort(),
  [['649.4', '185.8'], ['1820', '65.8'], ['51.8', '650']].sort());
assert.equal(run.result.bins.length, 2);
assert.deepEqual(runAfterRender.result, runBeforeRender.result);
assert.deepEqual(runAfterRender.cost, runBeforeRender.cost);
```

- [ ] `node --test harness/residual-labels/display.test.js`로 현재654/190/70/56 출력에 대해 RED 확인.
- [ ] 기존 residual-cut-order CASE11의1장 목표는 현재 표시버그의 완료 조건에서 제외하고 해당 README에 사용자에 의한 범위 변경을 명시한다. 그 진단 기록 자체를 삭제하거나1장 기대값을 조용히 바꾸지 않는다.

### Task 2: 최소 표시 수정 GREEN

Files: 위 생산 변경 후보3개와 `harness/residual-labels/format.test.js`.

- [ ] bin/freeRects 입력을 deepFreeze해 표시 모듈이 원본을 수정하지 못하도록 테스트.
- [ ] 검증된 잔재 치수 추출과 다음 포맷 기대를 먼저 테스트하고 최소 구현.

```js
assert.equal(ResidualLabels.formatMm(649.3999999999999), '649.4');
assert.equal(ResidualLabels.formatMm(185.79999999999995), '185.8');
assert.equal(ResidualLabels.formatMm(65.79999999999995), '65.8');
assert.equal(ResidualLabels.formatMm(51.79999999999973), '51.8');
assert.equal(ResidualLabels.formatMm(1820), '1820');
assert.equal(ResidualLabels.formatMm(650), '650');
assert.equal(ResidualLabels.formatMm(649.35), '649.35');
```

- [ ] drawBinToCanvas의 잔재 숫자 경로만 연결. Math.round를 원판·부품까지 전역 치환하지 않는다.
- [ ] CASE11 RED가 GREEN으로 바뀌고 나머지 Canvas 도형 호출은 완전히 같은지 확인.

### Task 3: 기존10개와 호환성 보호

Files: `harness/residual-labels/eleven-cases.test.js`, `compatibility.test.js`.

- [ ] 기존10개 저장된 엔진 baseline과 CASE5 승인4줄 기본선택 경계를 재사용. CASE11은 기존2장 결과를 기준으로 확보. 신규 기준은 구현 전에 저장.
- [ ] 11개 모두 배치/절단/잔재 데이터/요금 변경 없음, 표시 전후 result 상태 동일 검사.
- [ ] CASE2의 잔재 누락과 horizontal 결과의 메타데이터 누락을 별도 회귀로 검사. 빈 배열이면 잔재 없음이라는 가정 금지. unresolved가 있으면 완료 불가.
- [ ] kerf0/4/4.2, 딱맞는 부품, 소수입력, 전단ON(CASE10), 회전ON/OFF, 결ON/OFF, 여러 판, 결과 없는 초기화면을 각각 실행. 원판모서리의 불필요한 차감/음수/NaN/중복표시 없음.
- [ ] 계산 후 설정만 변경했을 때 재계산 전 숫자가 잘못 갱신되지 않는지 검사.
- [ ] 실행:

```sh
node --test harness/residual-labels/*.test.js
node --test harness/repeated-layout/*.test.js harness/pdf-size/*.test.js harness/bulk-performance/*.test.js
node harness/regression.js
```

### Task 4: 화면·PDF 확인 및 배포 판단

Files: `harness/residual-labels/browser-check.cjs`, `output/residual-labels/`.

- [ ] 실제 Test index.html에서11개 입력→계산, CASE5의 승인기본결과까지 캡처.
- [ ] PC/모바일 CASE11의649.4/185.8/65.8/51.8 가독성과 겹침 확인.
- [ ] 같은 Canvas로 생성된 일반PDF와 미리보기의 숫자를 렌더해 확인. PDF10MB 제한 유지.
- [ ] 숫자 영역을 제외한 도면 픽셀/도형 호출 동일, 비교창/PDF 기존동작 동일, 브라우저 오류0.
- [ ] 보호파일 해시·git diff 확인. 미해결호환성/실패/미검증 경로가 하나라도 있으면 완료/배포 선언 금지.
- [ ] Test 결과를 보고하고 승인된 뒤에만 V4/V10의 해당 표시 diff를 이식. 저장소 전체 파일 교체 금지.

## 5. 이번 조사 결론과 제한

CASE11의 표시 결함과 영향 경로는 실제 Test 코드 실행으로 확인했다.
안전한 방향은 표시 계층의 데이터·포맷 수정이며, 새 배치 알고리즘이 아니다.
다만 모든 엔진의 잔재 출력이 완전하지 않아 단순 freeRects 치환만으로 전체 안전성을
확보할 수 없다. 이 호환성 검증이 선행되어야 한다. 이번에는 계획만 작성했고 수정 완료나
무결함을 주장하지 않는다.

## 6. 사용자 시각 피드백 반영 — 2026-10-08

- 같은 잔재를 다른 부품 경계에 따라 분할해 수치를 반복 표시하지 않는다.
- 잔재당 가로×세로 한문구, 폭이 좁으면 회전해 글자충돌을 방지하는 검토안을 생성했다.
- 실제 동일규격 잔재가 여러개면 `823.2 × 260 · 4개`처럼 한 번 표시하며 하나의큰잔재로 합산하지 않는다.
- CASE4 오른쪽191.6×600/169.8×397 각각한문구. 픽셀상 겹침/영역이탈을 테스트한다.
- 검토안은 `output/playwright/residual-preview-20261008/index.html`. CASE2/3 좌하단은 미기록 최종절단을 가정한 검토값임을 표기했다. 생산표시의 완전한 호환성구현/검증을 대신하지 않는다.

## 7. 최신 사용자 수정 — 소수점 제외

이 항목은 위 소수점 표시/formatMm 예시보다 우선한다. 내부 치수는 유지하고 표기만 소수점 이하 버림(부동소수 오차 보정 포함)으로 바꾼다. formatMm 기대값은649/185/65/51/1820/650/649로 바뀐다. 잔재 그룹핑에는 정수표시가 아닌 원래 정밀치수를 사용한다. 검토도면5개는 이 방식으로 갱신했다.

## 8. 2026-10-08 실행 결과

## 2026-10-08 — 잔재 치수 표시 수정 및 Test → V4/V10 이식 완료

- 사용자 지시: GitHub 수정전 백업 → Test TDD/11사례 검증 → V4/V10 이식. 세 저장소에 `2026-10-08_잔재표시_수정전` annotated tag 원격 보관 완료(Test2eaeb9a, v4 34c989f, v10 210e07a).
- 표시 전용 js/residualLabels.js 추가. 실제 톱날 차감 잔재, 소수점 이하 버림, 잔재당 가로×세로 한 문구, 동일 규격은 수량으로 묶음. 실제 분리 조각의 물리적 병합 없음. 기존 면적 표시 기준 유지.
- main-unified 연결은 계산 시점 치수를 WeakMap에 보관하고 잔재 표기만 교체. packer/cost/state/settings/repeatedLayout/repeatedLayoutUI/pdfExport 해시 수정 전과 동일. 각 버전 고유 전단·회전 유지. index에 새 모듈과 자산버전20261008-residual-1 반영.
- Test Node70/70, 기존 회귀8/8 PASS. 실제 브라우저 Test/v4/v10 각각11/11 PASS: 수정 전 전체 배치·잔재·절단·요금 동일, 실제PDF11개씩 다운로드/10MB 이하/상태 보존, 모바일CASE11 및 계산 후 설정변경에도 기존잔재표시 유지. JS 예외0. CASE4/5/11 화면과 CASE11 PDF 렌더 육안 확인. 독립 리뷰 확인된 회귀 없음.
- CASE11 기존2장/8+2회 유지, 표시649×185/1820×65/51×650. CASE4 오른쪽191×600/169×397. CASE5 4줄·20회·30,000원 유지,823×260·4개/2440×163.
- 재현: Test/harness/residual-labels/README.md, 고정 브라우저 기준3개 포함. 결과는 Test/output/residual-labels/. 과거1장 기대 CASE11은 범위변경 사유 명시 후 보관skip; 현행11사례에는skip 없음.
- 미해결: 기존 B 엔진 three-length-300 절단선 기록 이슈는 이번 표시 변경과 별개로 유지. 기본 반응형 페이지 대상이며 구형 별도 페이지는 미수정.
- 다음: 새로고침 후 재계산해 변경된 스크립트를 로드한다. 추가 재단 알고리즘 변경은 이번 범위에 포함되지 않는다.
