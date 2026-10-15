# 절단 우선 방향 Implementation Plan

**Goal:** Test 기본 배치를 보존하면서 가로/세로 절단 우선 선택 UI와 독립 세로 스트립 계산을 제공한다.
**Architecture:** UI의 가로 선택은 기존 auto 경로를 그대로 호출한다. 세로 선택만 `VerticalStripPacker.pack({board, kerf, items})`를 사용한다. 입력 items는 기존 결/회전 정규화를 거친 값이며 이 모듈은 방향 제한을 완화하지 않는다.
**Tech Stack:** 기존 vanilla JavaScript, Node test runner, Playwright, jsPDF.
**Spec:** 현재 대화의 확정 요구 및 상위 HANDOFF.md. Test 완성/사용자 확인 전 v4/v10 수정·배포 금지.

## 확정된 검증 경계 및 제약

- 기존 계산 결과(11개 저장 기준), 새 방식 계산 결과, UI 전환/표시 및 PDF가 공개 검증 경계다. 사용자의 진행 지시로 실행한다.
- 기본값 가로 절단 우선은 내부 auto와 기존 CASE5 승인 선택을 보존한다. 내부 horizontal 모드로 바꾸지 않는다.
- 세로는 X 방향으로 구역을 분리한 뒤 해당 구역을 Y 방향으로 자르는 스트립 배치. 입력에 없는 회전은 불가.
- B의 D부품은 기존 결 ON 방향과 다르다. CASE12의 결 ON은 방향 보존을 검사하고, 결 OFF/회전 허용에서는 B형 1장을 검사한다. 동일결 조건에서 B형1장을 강제하지 않는다.
- 새 탐색은 수량 기반, 제한된 beam 탐색. 작업량/부품수 상한을 넘으면 명확한 오류를 표시하고 기존 결과 보존. 조용히 다른 방식으로 바꾸지 않는다.
- 신규 비용은 기존 CostCalculator를 그대로 사용. 기존 결과 객체·기준 JSON 수정 금지.

## Task 1: 독립 세로 스트립 계산

Files: 새 `js/verticalStripPacker.js`, `harness/cut-priority/vertical.test.js`, `case12.json`.
API: `pack({board:{width,height},kerf,items:[{id,width,height,qty,allowRotate}]})` → 기존 bins/placed/freeRects/cutDetails 형태, mode=vertical.

- [x] 첫 RED: 허용회전 CASE12에서 15개/1장, 첫 절단 axis=X, 순차 절단 재실행 및 수량·간격 검증.
- [x] 최소 구현: 동일 X폭 스트립 후보를 생성, 각 스트립 내 Y 쌓기. 제한 beam으로 판재당 최대 면적 선택 후 나머지는 다음 판재. 원본 입력 복사 및 원본 인덱스 유지.
- [x] 다음 RED→GREEN: 결 ON 방향 보존, 회전금지, 전단 유효폭, 정확한 가장자리/톱날 부족, 미배치, 입력불변, 탐색상한을 각각 추가.
- [x] 기존 11개 및 성능 회귀 실행: `node --test harness/cut-priority/*.test.js harness/residual-labels/*.test.js harness/repeated-layout/*.test.js harness/pdf-size/*.test.js harness/bulk-performance/*.test.js harness/partition-budget/partition-budget.test.js`.

## Task 2: 선택 UI·결과·PDF

Files: `index.html`, 새 `css/cut-priority.css`, `js/main-unified.js`, `js/settingsManager.js`, 새 `harness/cut-priority/browser-check.cjs`.

- [x] 브라우저 RED: 가로 기본 라디오 확인, 세로 선택→재계산→mode=vertical, 가로 복귀→저장 기준과 동일. 모바일 실제 클릭도 검사.
- [x] 구현: 숨김 cutDirection 값과 native radio 연결. 기존 설정 읽기/저장/불러오기와 새 프로젝트 초기화에 동기화.
- [x] 선택 변경 시 재계산 안내 및 이전 결과의 계산 방식 표기. PDF는 현재 선택 대신 결과를 생성한 방식 표기. 새 계산 실패 시 기존 도면 유지.
- [x] 실제 기존 11개 UI 계산/JSON 비교/PDF 다운로드 및 새 PC/모바일 CASE12, 결 ON/OFF, 전단, 설정 저장·초기화 검증.

## Task 3: 완료 검토

- [x] 도면/설정/PDF 화면을 직접 확인하고 필요 수정.
- [x] `git diff --check`, 기본 엔진/비용 및 v4/v10 해시 보존 확인.
- [x] README, docs/context.md, 상위 HANDOFF.md에 실제 결과·한계·다음 단계 기록. Test 로컬 결과 제공. 이식/배포는 후속 사용자 확인 이후.
