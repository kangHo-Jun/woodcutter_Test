# context.md — 현재 진행 상황

## 최종 업데이트
2026-04-30

## 프로젝트 구조
- woodcutter_v4: 스마트폰용 완성본 (GitHub: kangHo-Jun/woodcutter_v4)
- woodcutter_v10: PC용 완성본 (GitHub: kangHo-Jun/woodcutter_v10)
- woodcutter_Test: 로직 개발/검증 전용 (로컬 git만, GitHub 푸시 없음)
- 경로: /Users/zart/Library/Mobile Documents/com~apple~CloudDocs/프로젝트/

## 작업 규칙
- v4 코드 수정 금지 (읽기 전용)
- 모든 로직 수정은 woodcutter_Test에서만
- 검증 완료 후 packer.js, costCalculator.js, main-unified.js만 v4/v10에 복사
- 코딩 전 반드시 git tag로 롤백 포인트 생성
- 지시된 파일 외 다른 파일 수정 금지

## 축 규칙 (절대 불변)
- boardWidth = 폭 (짧은 쪽)
- boardHeight = 길이 (긴 쪽)
- packerW = boardHeight, packerH = boardWidth
- trim = boardWidth에만 적용 (boardHeight 적용 안 함)
- effectiveBoardWidth = boardWidth - trimMargin

## 완료된 작업 (2026-04-30 기준)

### 버그 수정
- freeRects 오염 → placed 기반 잔여 영역 계산으로 교체
- cutDetails stale 버그 → 렌더링 직전 placed 기반 필터링
- 쭉절단 비용 판정 → fullSpan 의존 제거, 좌표 기준으로 교체
- A/B 선택 3순위 → cutDetails.length 추가
- 잔여재 절단선 누락 → rightResult.placed.length===0 조건 추가
- cuttingCount Y축 누락 → cutLinesX.size + cutLinesY.size로 수정 (packer.js:975)

### 이식 완료
- Test → v4 이식 완료 (태그: v0417_test이식전)
- Test → v10 이식 완료 (태그: v0417_test이식전)
- 2026-04-30 packer.js 추가 수정분 v4/v10 푸시 완료

## 현재 미해결 이슈
- 없음 (현재 기준)

## 콘솔 테스트 규칙
- await 사용 금지 (SyntaxError)
- app.handleCalculate().then(function(){ ... }) 형태 사용
- 브라우저 강제 새로고침: Cmd+Shift+R

## 비용 계산 규칙
- 쭉절단 판정: axis=Y, spanStart=0, spanEnd=판재길이 기준
- 일반 절단 단가: cutDetails 기준 cuttingCount × 단가
- cuttingCount = cutLinesX.size + cutLinesY.size (X+Y 모두 포함)

## 알고리즘 선택 우선순위
1. unplaced 적은 쪽
2. bins 적은 쪽
3. cutDetails.length 적은 쪽
4. 같으면 B

## 주요 파일
- js/packer.js: 핵심 배치 알고리즘
- js/costCalculator.js: 비용 계산
- js/main-unified.js: UI 연결, 렌더링
- js/settingsManager.js: 기본값 설정
- docs/AGENTS.md: 에이전시 행동 규칙
- docs/context.md: 현재 진행 상황 (이 파일)

## 다음 작업 후보
- TC-06 버그: 부품 폭이 판재 폭 초과 시 에러 팝업 없음 (미처리)
- 나무결 OFF + 판재 폭>길이 케이스 쭉절단 우선 선택 로직 개선 (보류)
