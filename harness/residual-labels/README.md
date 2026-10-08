# 잔재 치수 표시 회귀 검사

기존 재단 배치·절단·요금을 변경하지 않고, 표시 잔재의 톱날 손실·정수 버림·중복 표기를 검증한다.

## 표시 계약

- `ResidualLabels.build({bin, board, kerf})`는 원본을 수정하지 않는다. X=가로(길이), Y=세로(폭).
- 엔진의 유효 잔재 영역을 보호하고 기록된 절단을 우선 적용한다. 누락된 마지막 분리는 고정된 부품 경계에서 표시용으로 복구한다. 복구 불가능한 영역은 `unresolved`로 반환하고 임의 치수를 표시하지 않는다.
- 20,000mm² 이상 잔재만 기존 기준대로 표시한다. 치수는 소수점 이하 버림; 부동소수점 계산 오차만 보정한다.
- 실제 규격이 같은 분리 잔재는 `가로 × 세로 · N개`로 한 번 표기한다. 물리적으로 합치지 않는다. 서로 다른 실치수를 같은 정수로 보인다는 이유로 합치지 않는다.
- `draw`는 잔재 내부에 한 문구를 배치하고 좁은 세로 영역은 회전한다. 겹치거나 공간이 없는 경우 issues로 보고한다.
- main은 계산 시점의 톱날·유효 판재 치수를 WeakMap에 보관한다. 결과 객체/엔진/요금에는 필드를 추가하지 않는다.

## 실행

Test 루트에서:

```sh
node --test harness/residual-labels/*.test.js harness/repeated-layout/*.test.js harness/pdf-size/*.test.js harness/bulk-performance/*.test.js
node harness/regression.js
```

결과: 70/70 및 기존 회귀 8/8 PASS. 기존 10사례+CASE11 = 11사례 보호. CASE5 승인 4줄/20회/30,000원 유지. CASE11은 톱날4.2 조건의 기존2장을 유지하며 649×185/1820×65/51×650 표기를 검사한다. 이전 1장 기대 진단은 residual-cut-order 폴더에 보관하며 현재 완료 목표가 아니다.

## 실제 브라우저·PDF

Playwright 설치 환경에서 재단 상위 폴더를 HTTP 제공한 뒤:

```sh
PHASE=after TARGET=Test URL=http://127.0.0.1:8877/woodcutter_Test/ node harness/residual-labels/browser-check.cjs
PHASE=after TARGET=v4 URL=http://127.0.0.1:8877/woodcutter_v4/ node harness/residual-labels/browser-check.cjs
PHASE=after TARGET=v10 URL=http://127.0.0.1:8877/woodcutter_v10/ node harness/residual-labels/browser-check.cjs
```

번들 Playwright를 사용할 경우 NODE_PATH를 해당 node_modules로 지정한다.
`baselines/{Test,v4,v10}.json`은 각 버전 수정 전 실제 브라우저 결과/요금만 추출한 고정 기준이다. 출처 태그 `2026-10-08_잔재표시_수정전`. 자동 갱신하지 않는다.

세 버전 각각 11/11 PASS. 매 사례 UI 계산 → 수정 전 전체 결과·비용 비교 → 실제 화면 캡처 → PDF 다운로드/10MB 제한/상태 불변 검사. 마지막에는 CASE11 모바일 표시 및 계산 후 kerf 변경에도 기존 도면 치수 유지 검사를 수행한다. 화면은 계산 완료 후 다음 프레임에 그려지므로 렌더 프레임까지 기다린다. v4에는 kerf 입력창이 없어 상태를 직접 변경해 동일 불변성을 검사한다.

산출물은 `output/residual-labels/{Test,v4,v10}/{before,after}/`. 결과 JSON, 11개 PNG·PDF, 모바일 PNG를 보관한다. CASE4/5/11 화면 및 CASE11 PDF 렌더 육안 확인. 출력 파일은 커밋 대상이 아니다.

## 범위와 알려진 제한

기본 반응형 index.html/일반 PDF 경로 대상. 구형 별도 페이지는 제외한다. 배치/절단선/요금/회전·결/전단 규칙은 변경하지 않는다. v4 고정14mm, Test/v10 여백+톱날 규칙 보존. 기존 B 엔진 three-length-300의 절단선 기록 문제는 별도 기존 이슈로 남아 있다. 잔재 복구는 표시용이며 새로운 절단 공정의 최적성 또는 모든 입력의 해법을 증명하지 않는다.
