# Test 절단 우선 방향 검증

## 동작 계약

- 화면의 **가로 절단 우선**은 기존 `auto` 경로와 승인된 CASE5 선택을 그대로 실행한다. 기존 내부 `horizontal` 모드로 교체하지 않는다.
- **세로 절단 우선**만 `VerticalStripPacker.pack({board, kerf, items})`를 호출한다. X 방향 스트립을 먼저 분리하고 그 안의 부품을 Y 방향으로 절단한다.
- items는 기존 UI의 결/회전 정규화 결과다. 결 ON에서는 긴 변→판재 길이, 회전 금지 규칙을 그대로 지킨다.
- 동일 X폭의 부품을 모아 높이순/역순 후보를 만들고 64개 상태 beam으로 판재당 배치 면적을 비교한다. 방향/장수의 전역 최적성을 보장하지 않으며 가로보다 장수가 많을 수 있다.
- 최대 10,000개/256종, 총 작업 예산 200,000회와 내부 64회마다 1초 확인. 한도 초과는 명시적 오류이며 이전 화면 결과·요금을 유지한다. 다른 방식으로 조용히 대체하지 않는다.
- 기본 packer/cost/state/repeatedLayout 파일 및 기존 11개 기준 JSON은 수정하지 않았다. 선택 변경만으로 기존 결과를 덮어쓰지 않으며 재계산 시 선택한 방식으로 결과를 교체한다. PDF에는 실제 결과의 방식이 표시된다.

## CASE12

원판 1220×2440×18, 톱날4.2, 전단OFF. 546×850 1개 + 260×850 2개 + 396×400 6개 + 396×364 6개.

- 결 OFF/회전 허용: 세로 모드 1장, 15개, 미배치0. 구역폭 850/396/396/364/364. B형 도면보다 작은 점유길이도 허용하므로 최초 테스트의 정확한 구역폭400 요구는 제거하고 장수·수량·물리검증과 B 점유길이 이하를 검사했다. 기존11개 기준은 변경 없음.
- 결 ON: 2장. 396×364의 긴 변396을 X축에 두는 기존 규칙 보존. 고객 B의 해당 부품은 반대 방향이므로 결 ON에서1장을 강제하지 않는다.
- B의 각 방향을 별도 고정한 정규화 입력(400×396/364×396/850×546/850×260)은1장임을 독립 테스트로 검증.

## 실행

```sh
node --test harness/cut-priority/*.test.js
node --test harness/residual-labels/*.test.js harness/repeated-layout/*.test.js harness/pdf-size/*.test.js harness/bulk-performance/*.test.js harness/partition-budget/partition-budget.test.js
node harness/regression.js
```

재단 상위 폴더에서 `python3 -m http.server 8894 --bind 127.0.0.1` 실행 후, 설치된 Playwright 경로를 NODE_PATH로 지정:

```sh
node harness/cut-priority/browser-check.cjs
node harness/cut-priority/lifecycle-check.cjs
```

`TEST_URL`로 Test 로컬 URL 변경 가능. 브라우저는 저장된11개 결과를 비교한 후 세로 계산·가로 복귀, 실제 PC/모바일 폼입력,17개PDF, 계산방식 표시, 실패 시 원본 보존, 저장/새로고침/초기화/불러오기/과거파일, 모바일 안내 가림 여부,24종PDF 요약 범위를 검증한다.

## 2026-10-15 검증 결과

- TDD RED: 새 엔진 없음, 입력 검증 없음, 탐색 예산 없음, UI 선택 없음, 모바일 안내 가림을 각각 확인 후 구현. 기록 `output/cut-priority/red-*.txt`.
- Node102/102(기존93+신규9), regression8/8 PASS.
- 실제 Chromium: 기존11개 배치·요금 완전일치, 모두 세로모드 유효절단 및 가로복귀 확인. PC/모바일 CASE12 결OFF1장/결ON2장. PDF17개 10MB이하·상태보존, JS예외0.
- lifecycle-check PASS: 실제10,001개 입력 제한으로 오류 발생 후 이전 결과·요금 보존, 선택 저장·복원, 새 프로젝트 가로, 과거파일 가로, 모바일 안내,24종 요약 보존.
- PDF2쪽 및 PC/모바일 화면 직접 확인. 리뷰 발견 요약24종 누락은 방식표시를 기존 결 표시행 우측으로 옮겨 기존 텍스트좌표를 보존해 해결. 독립 리뷰 추가500입력 물리검증 통과, 남은 차단사항 없음.
- 증거 `output/playwright/cut-priority/`, 로그 `output/cut-priority/`. 복원 태그 `before-cut-priority-20261015` (02f37df).
- v4/v10 JS/index 수정 전후 SHA-256 모두 동일. 이번 작업은 Test 로컬 구현만 완료, 커밋/푸시/공개배포/이식 없음.
- 다음: 사용자 Test 확인 후 후속 이식 범위 확정. 기존 다종PDF 요약 페이지분할 부재와 B엔진 three-length-300 이슈는 별도 기존 제한으로 유지.
