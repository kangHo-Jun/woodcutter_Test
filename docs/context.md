# context.md — 현재 진행 상황

## 최종 업데이트
2026-05-20

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
