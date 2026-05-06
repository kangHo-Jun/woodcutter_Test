# context.md — 현재 진행 상황

## 최종 업데이트
2026-05-06

## 프로젝트 구조
- woodcutter_v4: 스마트폰용 완성본 (GitHub: kangHo-Jun/woodcutter_v4)
- woodcutter_v10: PC용 완성본 (GitHub: kangHo-Jun/woodcutter_v10)
- woodcutter_Test: 로직 개발/검증 전용 (로컬 git만, GitHub 푸시 없음)
- 경로: /Users/zart/Library/Mobile Documents/com~apple~CloudDocs/프로젝트/

## v4 vs v10 차이
| 항목 | v4 | v10 |
|------|-----|-----|
| 대상 | 스마트폰 | PC |
| 쭉절단 단가 UI | 없음 (기본값 고정) | 있음 |
| 원가설정 UI | 없음 | 있음 |
| 고급설정 UI | 없음 | 있음 |
| 전단 유효폭 계산 | 고정 -14mm | (trimMargin+kerfSize)×2 |
| 전단여부 경고 문구 | 있음 | 없음 |
| 로직 (packer/cost) | Test와 동일 | Test와 동일 |

## 작업 규칙
- v4 코드 수정 금지 (읽기 전용 참고)
- 모든 로직 수정은 woodcutter_Test에서만
- 검증 완료 후 packer.js, costCalculator.js, main-unified.js만 v4/v10에 복사
- index.html, settingsManager.js는 버전별 별도 관리
- 코딩 전 반드시 git tag로 롤백 포인트 생성
- 지시된 파일 외 다른 파일 수정 금지
- Test 커밋/푸시는 감독자 승인 후 진행

## 축 규칙 (절대 불변)
- boardWidth = 폭 (짧은 쪽)
- boardHeight = 길이 (긴 쪽)
- packerW = boardHeight, packerH = boardWidth
- trim = boardWidth에만 적용 (boardHeight 적용 안 함)

## 유효폭 계산
- v4: effectiveBoardWidth = boardWidth - 14 (전단 ON 시)
- v10/Test: effectiveBoardWidth = boardWidth - (trimMargin + kerfSize) × 2 (전단 ON 시)
- 전단 OFF 시: effectiveBoardWidth = boardWidth

## 완료된 작업 (2026-05-06 기준)

### 버그 수정
- freeRects 오염 → placed 기반 잔여 영역 계산으로 교체
- cutDetails stale 버그 → 렌더링 직전 placed 기반 필터링
- 쭉절단 비용 판정 → fullSpan 의존 제거, 좌표 기준으로 교체
- A/B 선택 3순위 → cutDetails.length 추가
- 잔여재 절단선 누락 → rightResult.placed.length===0 조건 추가
- cuttingCount → cutLinesX.size + cutLinesY.size (X+Y 모두 포함)
- 전단여부 기본값 → false (v4/v10/Test 모두)
- 전단여부 체크 시 경고 문구 표시 (v4만)
- 유효폭 계산 공식 수정 (v4: -14 고정, v10/Test: -(trimMargin+kerfSize)×2)

### 이식 완료
- Test → v4 이식 완료
- Test → v10 이식 완료
- 각 버전별 index.html, settingsManager.js 별도 관리

## 현재 미해결 이슈
- TC-06: 부품 폭이 판재 폭 초과 시 에러 팝업 없음
- 나무결 OFF + 판재 폭>길이 케이스 쭉절단 우선 선택 로직 개선 (보류)

## 콘솔 테스트 규칙
- await 사용 금지 (SyntaxError)
- app.handleCalculate().then(function(){ ... }) 형태 사용
- 브라우저 강제 새로고침: Cmd+Shift+R
- 시크릿 모드 확인: Cmd+Shift+N

## 비용 계산 규칙
- 쭉절단 판정: axis=Y, spanStart=0, spanEnd=판재길이 기준
- 일반 절단 단가: cutDetails 기준 cuttingCount × 단가
- cuttingCount = cutLinesX.size + cutLinesY.size

## 알고리즘 선택 우선순위
1. unplaced 적은 쪽
2. bins 적은 쪽
3. cutDetails.length 적은 쪽
4. 같으면 B

## 이식 대상 파일 (Test → v4/v10)
- js/packer.js ✅
- js/costCalculator.js ✅
- js/main-unified.js ✅

## 버전별 독립 관리 파일
- index.html (UI 구조 다름)
- js/settingsManager.js (설정 항목 다름)
