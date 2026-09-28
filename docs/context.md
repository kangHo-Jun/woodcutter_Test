# context.md — 현재 진행 상황

## 최종 업데이트
2026-09-28

## 2026-09-28 — CASE5 구버전 스크립트 캐시 방어
- 사용자가 보고한 오래된 16회 엇갈린 결과를 확인. 현재 코드로 새로고침 후 같은 UI 입력을 계산하면 CASE5 기본 결과가 4줄450/450/350/350, 20회로 생성된다. 관찰된 문제는 새로고침 전 이미 열린 페이지 상태였으며, 서버가 새로고침 중 구 JS를 반환했다는 직접 증거는 확인되지 않았다.
- Test 진입 HTML은 `index.html` 하나이며 `main-unified.js`/`repeatedLayout.js`에 안정적인 버전 없는 URL을 사용하고 있었다. Service Worker/Cache API 사용 없음. 두 계산 스크립트 URL에 같은 `v=` revision을 추가해 HTML 재로드가 이전 안정 URL 캐시를 재사용하지 않도록 했다.
- `harness/repeated-layout/cache-version.browser.cjs`는 채택 코드가 빠진 구버전 JS를 이전 무버전 URL에서 먼저 제공해 CASE5 16회 출력을 재현한 뒤, 현재 HTML 재로드가 버전 쿼리가 있는 두 새 URL을 요청하고 CASE5를 4줄/20회/30,000원으로 계산하는지 검증한다. 새 URL에서 각 행 450/450/350/350 폭과 좌표도 확인한다.
- query bust는 이후 HTML을 다시 불러오는 페이지에 적용된다. 이미 열린 문서의 JS와 메모리 결과는 자동 교체되지 않으므로 사용자는 새로고침/재계산해야 한다. 현재 조치는 Test에만 적용하고 v4/v10은 변경하지 않았다.
- 되돌림 태그 `case5-cache-version-before-20260928`.

## 2026-09-28 — CASE5 기본 결과 정렬 적용
- `RepeatedLayout.approvedDefaultResult`를 main.handleCalculate에 연결. 승인된 CASE5 조건에만 정렬 후보를 실제 result로 채택하여 기본 화면과 일반 PDF에 반영한다. 다른 치수/수량/설정에는 원본 유지.
- 실제 UI10개 검증: CASE5만 의도한4줄450/450/350/350 배치, 나머지9개 배치·절단·잔재·요금 정확히 동일. 신규11/11, repeated-layout39/39, 기존회귀8/8, PDF10/10 통과.
- CASE5는 실제 개별 절단20회/30,000원(기존16회/24,000원). 묶음 절단 가정 없음. 일반PDF167,499바이트/A4 2쪽, 화면/PDF 렌더 확인.
- `output/case5-default/after/results.json`과 도면/PDF 보관. `output/ten-case-results/` CASE5 도면도 실제UI결과로 갱신. 엔진회귀 baseline은 원본 유지. v4/v10 미수정.

## 2026-09-28 — 대량 재단 성능 개선 완료
- Luna가 packer의 AREA_TARGET_HYBRID에서 변경 bin만 복사, 후보 점수 재사용, 동일 정렬 순서 중복 탐색 제거를 적용했다. 기존 선택 기준/탐색 폭/배치 규칙은 유지한다.
- 기존10개 사례의 전체 배치·절단·요금이 수정 전 기준과 정확히 동일. 신규 bulk4/4, 반복배치28/28, 기존 회귀8/8 통과.
- 995×901 230개/465×901 460개(1220×2440, kerf4.2, 회전ON, 결/전단OFF): 기존15초 제한 내 미완료 → 약7초 완료. 207장/2패턴/690개 전량/유효한 절단. 실제 화면과 PDF(185,209B, 요약+도면2쪽) 확인.
- 결ON·전단ON 추가시험 약3.6초/230장/2패턴, 전량 배치 및 절단 검사 통과. 사용자 실제 설정은 미확정이므로 수치는 명시된 시험 조건에 한정한다.
- 결과 `output/bulk-performance/results.json`, 고정 기준 `harness/bulk-performance/baselines/ten-cases.json`. v4/v10은 미수정, 전체 수정 완료 후 일괄 이식 원칙 유지.

## 2026-09-28 — PDF 10MB 제한 Test 구현 완료
- Luna가 계획서에 따라 공통 PDF 용량 검사 모듈, 기본 PDF 다운로드/미리보기, 비교 PDF 다운로드를 Test에 연결. 최종 Blob 10,000,000바이트 이하만 저장한다. PNG 무손실 우선, 필요할 때 JPEG 품질 0.92/0.85까지 시도한다. 모두 초과하면 저장 중단과 명확한 오류를 표시한다.
- 신규 PDF 테스트 10/10, 반복배치 28/28, 기존 회귀 8/8 통과. Chromium에서 CASE1~10 기본/비교 PDF 20개와 CASE5 모바일 2개 다운로드 성공. 모두 A4/10MB 이하, 최대 313,282바이트. 생성 후 기존 재단 결과·요금 불변.
- 30/80쪽 PDF 계층 부하 결과 463,196/1,252,012바이트. 미리보기 새 창 동작 확인. 기존 CASE5 기본 도면 페이지와 비교 PDF 렌더 픽셀 동일. 출력 `output/pdf-size/after/results.json`.
- 보호된 packer/cost/state/settings/repeatedLayout 해시 동일. v4/v10 미수정. 향후 모든 수정 완료 시에만 함께 이식한다.
- 임의로 복잡한 다페이지 PDF는 용량·품질을 동시에 무조건 보장할 수 없어 상한 초과 시 파일을 저장하지 않는다. 추가 요구가 생기면 Test에서 먼저 검증한다.

## 2026-09-28 — Luna용 PDF 용량 제한 개발 계획
- 사용자 요청에 따라 `docs/superpowers/plans/2026-09-28-pdf-size-limit-luna.md` 작성. 구현 미착수, 코드 변경 없음.
- 기본/비교 PDF 모두 최종 10,000,000바이트 이하를 검사하며 기존 배치·요금·페이지 내용을 보존하도록 설계. TDD, 실제 파일 크기 및 가독성 검증 포함.
- 앞으로 모든 수정은 Test에서 진행하며 모든 수정 종료 후 v4/v10에 일괄 반영한다. 이번 계획 작성에서는 두 버전을 수정하지 않았다.
- 다음: Luna가 계획서에 따라 현재 기준/미커밋 변경을 보존한 뒤 구현 및 검증.

## 2026-09-22 — Test 승인 후 v4/v10 이식
- 비교 스냅샷이 실제 bin 크기를 사용하도록 TDD 보완하여 버전별 전단 규칙 보존. 28/28 자동 검사, Test 브라우저10개 재검증 통과.
- v4/v10 기본 반응형 index.html에 같은 비교 모듈/CSS 이식. 모든 기존 JS 파일 유지.
- 각 버전 적용 전/후10개 결과 정확히 일치, 직접 입력 및 최초 모바일 접속/PDF 검사 통과.
- 테스트 스크립트 browser-check.cjs에 버전별 출력/사전 기준 캡처 옵션 추가. mobile-check.cjs 추가.
- 산출물 output/playwright/rollout-v4, rollout-v10. 상세는 루트 및 각 버전 HANDOFF 참조. 로컬만 적용, 웹 배포 미수행.

## 2026-09-22 — Test 비교 UI/PDF 검증 완료
- index.html과 별도 repeatedLayoutUI.js/repeated-layout.css로 비교 버튼/대화상자/후보 ON/OFF/비교 PDF 연결.
- 기존 상태 알림을 읽기만 하며 결과 복사본 사용. 기존 계산/요금/main/state 파일 수정 없음. 입력 변경 시 비교 무효화, 모바일 가로 스크롤 지원.
- Node 27/27 PASS. 실제 Chromium 10개 사례 및 폼 직접 입력 PASS, CASE1~4 기존 기준 유지.
- 비교 PDF CASE1(2쪽)/CASE5(1쪽) 및 기존 CASE5 PDF(2쪽) 다운로드·렌더 검증. 압축 전후 도면 동일.
- 산출물 output/playwright/, 로컬 http://127.0.0.1:8765. 재현 스크립트 harness/repeated-layout/browser-check.cjs.
- v4/v10 미변경. 다음은 현장 검토 및 묶음 절단 조건 확정이며 자동 선택/요금 적용은 아직 하지 않음.

## 2026-09-22 — 독립 반복 배치 구현 및 GREEN
- `js/repeatedLayout.js` 신규 추가. 기존 엔진/비용/UI/HTML 변경 없음, 아직 화면에 연결하지 않음. 기존 결과 보존하며 완전 반복 1장 후보만 생성.
- 기존/비교/나무결 21개 + 끝단 경계 3개 = 24개 통과. 기존 회귀 8/8 PASS. CASE1~4 기준 그대로, v4/v10 변경 없음.
- CASE7은 결 규칙 모순을 수정하여 260×500/450/350 각4개로 변경. 이전 260×200 조건은 후보 제외 테스트로 보존.
- 알려진 기존 문제 발견: 260×450/350/300 각4개에서 B 엔진 cutDetails가 부품을 관통. `harness/repeated-layout/known-issues/three-length-300.json`에서 별도 FAIL 재현 가능. 새 모듈과 무관하며 수정하지 않음.
- CASE5 비교 이미지/JSON은 `harness/output/repeated-layout-case5-comparison.png`, `repeated-layout-case5.json`. 후보 순차 개별 절단은20회이며 기존 청구16회를 대체하지 않음.
- 다음: Test 전용 비교 화면 연결 및 브라우저/PDF 확인. 상세는 루트 HANDOFF 및 테스트 README 참조.

## 2026-09-22 — 10개 사례 테스트 먼저 작성
- `harness/repeated-layout/` 추가. CASE1~4 각각 20회 기존 출력 일치 확인 및 앞서 그린 배치 JSON을 보호 기준으로 고정.
- 입력 10개와 별도 비교 API 계약 확정. 기존 결과 보호/기하·톱날 간격 검증 10개 PASS(각3회), 새 비교 테스트 10개는 모듈 미구현으로 의도한 RED. 기존 회귀 8/8 PASS.
- 위치/수량/절단/요금 변조 감지 확인. 기존 프로그램 js 파일 해시 그대로, v4/v10 수정 없음.
- 복원 태그 `tdd-repeated-layout-before-20260922`. 상세 명령/계약/입력/제한은 `harness/repeated-layout/README.md` 참조.
- 다음: 별도 반복 배치 비교 모듈 최소 구현으로 RED→GREEN. 자동 채택/요금 변경/UI 연결은 아직 하지 않음.

## 2026-09-22 — 현재 CASE1~4 배치도
- 기존 엔진 실행 결과를 `harness/output/current-case-layouts/`에 PNG 및 원본 JSON으로 저장. 프로그램 코드 변경 없음.
- 회전 ON/결 OFF/전단 OFF/kerf 4.2mm, 1220×2440mm. 판재수 2/1/1/1장, 프로그램 표시 절단수 26/4/10/17회. 네 사례 모두 기존 하네스 검증 통과.
- 사용자 요청에 따라 배치도 확인을 먼저 수행했으며 10개 사례 TDD 구현은 아직 시작하지 않음.

## 2026-09-22 — 반복 정렬 배치 개선안 분석
- 사용자 요청에 따라 분석·제안만 수행. Test 검증 후 v4/v10 이식 순서 유지, 프로그램 코드 수정 없음.
- 1220×2440, 260×450 8개 + 260×350 8개, 결 ON/전단 OFF/톱날 4.2mm 조건을 UI 좌표로 변환해 재현: A, 1장, 표시 16회, 24,000원. 내부 cutDetails는 19개여서 표시 횟수와 실제 공정 횟수를 구분해야 함.
- 제안: 기존 결과를 보존하면서 동일 폭 260mm의 450+450+350+350 반복 4줄 후보를 Test 옵션으로 추가하고, 실제 절단 순서/묶음 가능 조건으로 별도 평가. 기존 비용 산정은 우선 유지.
- 기존 Node 회귀 검증 8/8 PASS (각 1회). 기존 미추적 `추가개발가이드.md` 보존.
- 자세한 제안·미해결 조건·다음 작업은 프로젝트 루트 `../../HANDOFF.md` 참조.

## 오늘 완료된 작업 (2026-07-29)

### PDF 부품 범례 잘림 수정
- 대상: `js/main-unified.js`의 `addDiagramPageAsImage()`
- `wrapPartsLegend()` 헬퍼 추가
  - `ctx.measureText()`로 항목과 구분자 폭을 누적 측정
  - 최대 4줄 자동 줄바꿈
  - 최대 줄 초과 시 마지막 줄을 `외 N종`으로 축약
- 범례 줄 수에 맞춰 텍스트 전용 영역을 예약하고 도면 scale/offset 재계산
- 범례와 도면 사이 최소 여백 확보

### 검증 결과
- CASE1: 2장 ✅ (`AREA_TARGET_HYBRID`)
- CASE2: 1장 ✅ (`GPP`)
- CASE3: 1장 ✅ (`GPP`)
- CASE4: 1장 ✅ (`SKINNY_ANCHOR`)
- CASE5: 2장 ✅ (`GROUP_SPLIT_2BIN`)
- 기존 `test_packer.js`: 전체 통과 ✅
- PDF 3종: 1줄, 축약 없음 ✅
- PDF 8종: 2줄, 잘림 없음 ✅
- PDF 30종(Z1~Z4 포함): 4줄, `외 3종` 안전장치 작동 ✅
- 실제 A4 PDF 출력 및 도면/범례 비겹침 육안 확인 ✅

### Git 기준점
- 수정 전 태그: `Test_범례잘림_수정전`
- 수정 후 태그: `Test_범례잘림_자동줄바꿈`

## 오늘 완료된 작업 (2026-05-20)

### 버그 수정
- AREA_TARGET_HYBRID/GPP 복원 (64315a0에서 제거됐던 것 복원)
- SKINNY_ANCHOR 추가: skinny 반복 부품(ratio>5, qty>=2) 공간 보존
- GROUP_SPLIT_2BIN 추가: 2개 그룹 각각 1장 가능 시 분리 배치
- UI 부품 추가 시 id 누락 버그 수정 → 자동 알파벳 id 부여

### 검증 완료 케이스
- CASE1 (복합 19개): 2장 ✅ (AREA_TARGET_HYBRID)
- CASE2 (600×900 ×5): 1장 ✅ (GPP)
- CASE3 (400×1000 ×7): 1장 ✅ (GPP)
- CASE4 (혼합 skinny): 1장 ✅ (SKINNY_ANCHOR)
- CASE5 (CASE2+3 혼합): 2장 ✅ (GROUP_SPLIT_2BIN)

### 핵심 원칙 추가
- UI 입력 부품에 id 없으면 GROUP_SPLIT_2BIN 미발동
- 부품 추가 시 반드시 id 자동 생성 필요

## 오늘 완료된 작업 (2026-05-19)
- CASE1~4 콘솔 테스트 통과 확인
- allowRotate:true 누락 버그 발견 및 확인
  - 콘솔 테스트 시 rotatable:true 만으로는 회전 OFF 처리됨
  - 반드시 allowRotate:true 함께 사용해야 함
- CASE1: 2장 ✅
- CASE2: 1장 ✅
- CASE3: 1장 ✅
- CASE4: 2장 ✅
- v0519_baseline 태그 생성

## 콘솔 테스트 필수 규칙 (추가)
- rotatable:true 만으로는 회전 OFF 처리됨
- 반드시 allowRotate:true 함께 포함:
  { id:'A', width:000, height:000, qty:0, rotatable:true, allowRotate:true }

## 현재 auto 엔진 구조 (2026-05-20)
- 기본 비교:
  - `A`
  - `B`
- 추가 후보:
  - `RIP`
  - `MIXED_RIP`
  - `AREA_TARGET_HYBRID`
  - `GPP`
  - `SKINNY_ANCHOR`
  - `GROUP_SPLIT_2BIN`
- 채택 원칙:
  - 미배치 없어야 함
  - 판재 수가 더 적어야 함
  - 같거나 나쁘면 기존 결과 유지

## CASE별 현재 담당 엔진
- `CASE1` → `AREA_TARGET_HYBRID`
- `CASE2` → `GPP`
- `CASE3` → `GPP`
- `CASE4` → `SKINNY_ANCHOR`
- `CASE5` → `GROUP_SPLIT_2BIN`

## 앞으로 할 일
- TC-06: 부품 폭이 판재 폭 초과 시 에러 팝업 없음
- Test → v4, v10 이식 (packer.js, main-unified.js)
- 혼합 3개 이상 그룹 케이스 최적화 검토
