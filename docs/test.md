# Woodcutter 최종 검증 보고서

- 실행일시: 2026-04-17 09:28:49 KST
- 대상: `woodcutter_Test`
- 실행 방식: Chrome DevTools 콘솔 자동 실행
- 스크린샷 저장 위치: `/tmp/woodcutter_final_validation_after_tc10`
- 결과 원본: `/tmp/woodcutter_final_validation_after_tc10/results.json`
- 총 결과: 11건 중 11건 PASS

| TC | 케이스명 | 판정 | 사유 |
|----|---------|------|------|
| TC-01 | 기본 배치 (1판재 완성) | PASS | bins=1, unplaced=0, displayFreeRects=[{"x":0,"y":400,"width":2440,"height":815}] |
| TC-02 | 다판재 (2판재 이상) | PASS | bins=3, unplaced=0, staleCuts=0 |
| TC-03 | 나무결 ON - 폭/길이 정방향 | PASS | 모든 부품 900x300, rotated=false |
| TC-04 | 나무결 ON - 폭/길이 뒤집어 입력 | PASS | TC-03과 동일하게 모든 부품 900x300, rotated=false |
| TC-05 | 판재 폭/길이 뒤집어 입력 | PASS | bins=1, unplaced=0, placed=6 |
| TC-06 | 부품이 판재보다 큰 경우 | PASS | alerts=["판재 크기를 초과하는 부품이 1종 있습니다. 치수를 확인하세요."], bins=1, unplaced=0 |
| TC-07 | 부품 수량 0 또는 미입력 | PASS | alerts=[], bins=0, placed=0 |
| TC-08 | 비용 계산 검증 | PASS | 패턴1 절단횟수:7 예상비용:10500원, UI totalCuts=7, UI cost=10500, expected=10500 |
| TC-09 | 극소 부품 다수 | PASS | bins=1, unplaced=0, staleCuts=0 |
| TC-10 | 혼합 (까다로운 최종) | PASS | bins=2, unplaced=0, staleCuts=0, freeRectsByPattern=3/2 |
| TC-11 | 복합 혼합 (실무 케이스) | PASS | bins=1, unplaced=0, staleCuts=0, has1270x50=true |

## 스크린샷

| TC | 스크린샷 |
|----|----------|
| TC-01 | [/tmp/woodcutter_final_validation_after_tc10/TC-01.png](/tmp/woodcutter_final_validation_after_tc10/TC-01.png) |
| TC-02 | [/tmp/woodcutter_final_validation_after_tc10/TC-02.png](/tmp/woodcutter_final_validation_after_tc10/TC-02.png) |
| TC-03 | [/tmp/woodcutter_final_validation_after_tc10/TC-03.png](/tmp/woodcutter_final_validation_after_tc10/TC-03.png) |
| TC-04 | [/tmp/woodcutter_final_validation_after_tc10/TC-04.png](/tmp/woodcutter_final_validation_after_tc10/TC-04.png) |
| TC-05 | [/tmp/woodcutter_final_validation_after_tc10/TC-05.png](/tmp/woodcutter_final_validation_after_tc10/TC-05.png) |
| TC-06 | [/tmp/woodcutter_final_validation_after_tc10/TC-06.png](/tmp/woodcutter_final_validation_after_tc10/TC-06.png) |
| TC-07 | [/tmp/woodcutter_final_validation_after_tc10/TC-07.png](/tmp/woodcutter_final_validation_after_tc10/TC-07.png) |
| TC-08 | [/tmp/woodcutter_final_validation_after_tc10/TC-08.png](/tmp/woodcutter_final_validation_after_tc10/TC-08.png) |
| TC-09 | [/tmp/woodcutter_final_validation_after_tc10/TC-09.png](/tmp/woodcutter_final_validation_after_tc10/TC-09.png) |
| TC-10 | [/tmp/woodcutter_final_validation_after_tc10/TC-10.png](/tmp/woodcutter_final_validation_after_tc10/TC-10.png) |
| TC-11 | [/tmp/woodcutter_final_validation_after_tc10/TC-11.png](/tmp/woodcutter_final_validation_after_tc10/TC-11.png) |

## 콘솔 로그 요약

```text
TC-01: PASS - bins=1, unplaced=0, displayFreeRects=[{"x":0,"y":400,"width":2440,"height":815}]
TC-02: PASS - bins=3, unplaced=0, staleCuts=0
TC-03: PASS - placed=900x300,rot=false; 900x300,rot=false; 900x300,rot=false; 900x300,rot=false; 900x300,rot=false
TC-04: PASS - placed=900x300,rot=false; 900x300,rot=false; 900x300,rot=false; 900x300,rot=false; 900x300,rot=false
TC-05: PASS - bins=1, unplaced=0, placed=6
TC-06: PASS - alerts=["판재 크기를 초과하는 부품이 1종 있습니다. 치수를 확인하세요."], bins=1, unplaced=0
TC-07: PASS - alerts=[], bins=0, placed=0
TC-08: PASS - 패턴1 절단횟수:7 예상비용:10500원, UI totalCuts=7, UI cost=10500, expected=10500
TC-09: PASS - bins=1, unplaced=0, staleCuts=0
TC-10: PASS - bins=2, unplaced=0, staleCuts=0, freeRectsByPattern=3/2
TC-11: PASS - bins=1, unplaced=0, staleCuts=0, has1270x50=true
```

## 수정 확인 항목

### TC-06 입력 검증

- 입력: `1300×800`, `rotatable:false`, 판재 `1220×2440`
- 기대: 판재 폭 초과 경고
- 결과: `판재 크기를 초과하는 부품이 1종 있습니다. 치수를 확인하세요.`
- 판정: PASS

### TC-10 stale cutDetails

- 기대: raw `cutDetails`에 stale 절단선 없음
- 결과: `staleCuts=0`
- 판정: PASS

## 비고

- TC-03, TC-04는 케이스명이 “나무결 ON”이므로 테스트 실행 시 `considerGrain` 체크박스를 ON으로 설정한 뒤 실행했다.
- 각 스크린샷에는 도면과 테스트 로그 오버레이가 함께 포함되어 있다.
