# context.md — 현재 진행 상황

## 최종 업데이트
2026-05-19

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

## 앞으로 할 일
- TC-06: 부품 폭이 판재 폭 초과 시 에러 팝업 없음 (미처리)
- 나무결 OFF + 판재 폭>길이 케이스 쭉절단 우선 선택 로직 개선 (보류)
- CASE1~4 검증 완료 기준으로 v4, v10 이식 진행
- Test → v4, v10 JS 파일 이식 후 커밋 푸시
