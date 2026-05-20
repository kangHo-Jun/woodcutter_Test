# context.md — 현재 진행 상황

## 최종 업데이트
2026-05-20

## 오늘 완료된 작업 (2026-05-20)
- `js/packer.js` 기준점을 `2176a9d` 구조로 복원
  - `AREA_TARGET_HYBRID` 복원
  - `GPP(guillotinePartitionPlanner)` 복원
- `CASE4` 해결용 `SKINNY_ANCHOR` candidate 추가
  - skinny 반복 부품을 코너에 먼저 anchor 배치
  - 남은 영역은 기존 flexible pack으로 채움
  - **기존 결과보다 좋을 때만 채택**
- `CASE1` 퇴행 원인 확인
  - baseline A/B 문제가 아니라
  - `2176a9d`에 있던 `AREA_TARGET_HYBRID/GPP` 후보가 빠지면서 3장으로 돌아간 것
- 현재 최종 검증 결과
  - `CASE1: 2장` (`AREA_TARGET_HYBRID`)
  - `CASE2: 1장` (`GPP`)
  - `CASE3: 1장` (`GPP`)
  - `CASE4: 1장` (`SKINNY_ANCHOR`)
  - `CASE5: 2장` (`GROUP_SPLIT_2BIN`)
- `CASE5` 혼합 입력 버그 해결
  - `A(900×600)×5 + B(400×1000)×7`
  - 섞으면 3장, 그룹 분리하면 2장인 케이스
  - `GROUP_SPLIT_2BIN` candidate 추가로 해결
- 브라우저 경로 보완
  - `main-unified.js`에서 packer 입력 매핑 시 `id: part.id` 전달
  - `GROUP_SPLIT_2BIN`은 `id` 기준 그룹 분리가 필요하므로 필수 수정
- 문서 업데이트
  - `docs/알고리즘2개.md` 현재 로직 기준으로 재정리
  - 초보자도 이해할 수 있도록 엔진 구조 / 후보 선택 / CASE1~5 해결 원리 정리

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
- TC-06: 부품 폭이 판재 폭 초과 시 에러 팝업 없음 (미처리)
- 나무결 OFF + 판재 폭>길이 케이스 쭉절단 우선 선택 로직 개선 (보류)
- CASE1~4 검증 완료 기준으로 v4, v10 이식 진행
- Test → v4, v10 JS 파일 이식 후 커밋 푸시
