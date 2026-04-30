# context.md — 현재 진행 상황

## 최종 업데이트
2026-04-27

## 현재 상태
- woodcutter_Test: 신버전 로직 완성
- v4: Test 로직 이식 완료 (커밋: feat: Test 신버전 로직 이식)
- v10: Test 로직 이식 완료
- woodcutter_Test 폴더: 휴지통에서 복원 완료

## 완료된 작업
- freeRects 오염 → placed 기반 잔여 영역 계산으로 교체
- cutDetails stale 버그 → 렌더링 직전 placed 기반 필터링
- 쭉절단 비용 판정 → fullSpan 의존 제거, 좌표 기준으로 교체
- A/B 선택 3순위 → cutDetails.length 추가
- v4, v10 이식 완료 (태그: v0417_test이식전)

## 현재 이슈 (미해결)
- 부품 폭=판재 폭(1220×965 + 1220×840)일 때 2판재로 분리되는 버그
- 원인 분석 중

## 다음 작업
- 위 버그 원인 분석 → 수정 방향 확정 → 감독자 승인 → 코딩