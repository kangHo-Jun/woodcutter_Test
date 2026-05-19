# idea_v3.md — Guillotine Partition Planner 재설계

## 작성일
2026-05-19

---

## 1. 문제 정의

현재 재단 엔진은 사실상 **row-first strip packing** 구조이다.

```text
전체 판재
  ↓
가로 관통 strip 생성
  ↓
strip 안에 부품 배치
```

이 방식은 배치 후 우측에 아래와 같은 계단형 잔여공간을 만든다.

```text
AAAAAAAAAA..
BBBBBBBB....
CCCCCCCCCC..
```

문제는 이 공간이 실제로는 남아 있어도, 관통 절단 조건에서는 다시 쓰기 어려운 비정형 공간이 된다는 점이다.

---

## 2. 절대 규칙

모든 절단은 반드시 **관통 절단(Guillotine Cut)** 이어야 한다.

허용:

```text
────────────
```

또는

```text
│
│
│
```

처럼 끝까지 자르는 절단.

금지:
- 중간에서 멈추는 절단
- ㄷ자 절단
- 도려내기
- non-guillotine cut

---

## 3. 최우선 명세: 회전 허용 여부

deep research 결과 가장 중요한 발견은 다음이다.

```text
회전 허용 여부가 feasibility를 결정한다
```

| 케이스 | 회전 ON | 회전 OFF |
|---|---|---|
| Case2 | 1장 가능 | 1장 불가 |
| Case3 | 1장 가능 | 1장 불가 |
| Case4 | 1장 가능 | 1장 불가 |

따라서 새 planner에서 각 부품은 반드시 다음 필드를 가진다.

```text
allowRotate: boolean
```

이 값은 보조 옵션이 아니라 **최우선 입력 명세**다.

즉 새 로직은 다음 두 문제를 명확히 구분해야 한다.

```text
RG (rotation allowed guillotine)
OG (orientation fixed guillotine)
```

Case2, Case3, Case4의 one-sheet witness는 모두 `allowRotate = true`일 때만 성립한다.

---

## 4. 기존 vertical-column 아이디어 재검토

초기 아이디어는 다음과 같았다.

```text
판재를 세로 컬럼으로 먼저 나눈다
→ 각 컬럼에 부품을 세로로 적층한다
```

하지만 Case2, Case3 검증 결과 **단순 vertical-column 방식만으로는 목표를 달성할 수 없음**이 확인되었다.

---

## 5. Case2 재검토

### 조건

```text
판재: 1220 × 2440
부품: 600 × 900 × 5개
```

### 잘못된 이전 가정

```text
컬럼1: 600폭 → 2개
컬럼2: 620폭 → 3개
총 5개 가능
```

### 실제 검증

600×900 부품을 세로로 적층하면 한 컬럼당 최대 개수는 다음과 같다.

```text
900 × 2 = 1800 ≤ 2440
900 × 3 = 2700 > 2440
```

따라서 한 컬럼에는 최대 2개만 들어간다.

판재 폭 1220에서는 600폭 컬럼을 최대 2개 만들 수 있다.

```text
600 + 600 = 1200 ≤ 1220
```

따라서 단순 vertical-column 결과는:

```text
2개 + 2개 = 4개
```

즉, 5개 배치 불가.

### 결론

Case2는 단순 vertical-column solver로 해결되지 않는다.

필요한 방향은:

```text
vertical 단독이 아니라
vertical + horizontal 혼합 guillotine partition 탐색
```

이다.

---

## 6. Case3 재검토

### 조건

```text
판재: 1220 × 2440
부품: 400 × 1000 × 7개
```

### 잘못된 이전 가정

```text
컬럼1: 400폭 → 2개
컬럼2: 400폭 → 2개
컬럼3: 420폭 → 3개
총 7개 가능
```

### 실제 검증

400×1000 부품을 세로로 적층하면 한 컬럼당 최대 개수는 다음과 같다.

```text
1000 × 2 = 2000 ≤ 2440
1000 × 3 = 3000 > 2440
```

판재 폭 1220에서는 400폭 컬럼을 최대 3개 만들 수 있다.

```text
400 + 400 + 400 = 1200 ≤ 1220
```

따라서 단순 vertical-column 결과는:

```text
2개 + 2개 + 2개 = 6개
```

즉, 7개 배치 불가.

### 결론

Case3도 단순 vertical-column solver로 해결되지 않는다.

필요한 방향은:

```text
첫 절단 이후 남은 직사각형에
다시 가로/세로 partition을 재귀적으로 시도하는 구조
```

이다.

---

## 7. exact witness 패턴

deep research에서 확인된 실제 1장 witness는 다음과 같다.

### 7.1 Case2

```text
상단 가로 band 1개
+ 하단 2컬럼 각 2개
```

즉:

```text
900×600 회전 부품 1개
+ 600×900 컬럼 2개
+ 각 컬럼에 2적층
```

### 7.2 Case3

```text
상단 가로 band 1개
+ 하단 3컬럼 각 2개
```

즉:

```text
1000×400 회전 부품 1개
+ 400×1000 컬럼 3개
+ 각 컬럼에 2적층
```

### 7.3 Case4

```text
좌측 A 컬럼
+ 우측 재귀 band / column 조합
```

즉 고정 2-stage가 아니라:

```text
V → H → V
```

교대 절단이 가능한 **shallow recursive guillotine** 구조가 필요하다.

### 7.4 구현 의미

위 세 witness는 모두 깊은 범용 탐색 없이도 다음 수준에서 설명된다.

```text
depth 4 이내 shallow recursive guillotine
```

따라서 초기 구현의 목표는 deep exhaustive search가 아니라:

```text
얕은 재귀 + 강한 후보 생성 + 안전한 fallback
```

이다.

---

## 8. 핵심 결론

기존 표현인:

```text
vertical-column solver
```

는 부정확하다.

새로운 로직의 정확한 이름은:

```text
Guillotine Partition Planner
```

이다.

즉, 단순히 세로 컬럼을 만드는 것이 아니라:

```text
1. 첫 절단 후보를 만든다
2. 가로 절단과 세로 절단을 모두 검토한다
3. 절단 후 남는 직사각형의 품질을 평가한다
4. 각 직사각형에 다시 재귀적으로 배치한다
5. 모든 절단은 관통 절단만 허용한다
```

---

## 9. 첫 절단 선택 기준

중요한 기준은 단순히 큰 부품을 먼저 넣는 것이 아니다.

핵심은:

```text
첫 절단 후 남는 공간을 망치지 않는가?
```

이다.

좋은 첫 절단은 다음 조건을 만족해야 한다.

- 현재 선택한 부품 또는 그룹이 잘 들어간다
- 남은 공간이 직사각형으로 유지된다
- 남은 공간의 폭/높이가 다른 부품들을 수용할 수 있다
- 계단형 dead space를 만들지 않는다
- 관통 절단 규칙을 위반하지 않는다

---

## 10. 컬럼/partition 후보 생성 규칙

초기 아이디어의 문제:

```text
컬럼 폭 = 부품 폭 치수만 사용
```

이 방식은 불완전하다.

실제 후보에는 다음이 포함되어야 한다.

### 10.1 단일 치수 후보

```text
부품 폭
부품 높이
회전 허용 시 회전 후 폭/높이
```

### 10.2 조합 치수 후보

부품 2개 이상을 같은 partition 안에 나란히 넣을 수 있으므로, 합산 폭도 후보가 되어야 한다.

예:

```text
295 + 295 = 590
400 + 400 = 800
600 + 600 = 1200
397 + 771 = 1168
```

즉 후보 폭은:

```text
single width
+ rotated width
+ pair/group width sum
```

을 포함해야 한다.

---

## 11. 컬럼 내부 그룹핑 로직

단순히 같은 폭 부품을 세로로 쌓는 방식만으로는 부족하다.

컬럼 또는 partition 내부에서는 다음 그룹핑을 검토해야 한다.

### 11.1 단일 열 적층

```text
│ A │
│ A │
│ A │
```

### 11.2 2열 병렬 그룹

```text
│ A │ A │
│ A │ A │
```

예:

```text
295 + 295 = 590폭 그룹
```

### 11.3 혼합 높이 그룹

```text
│ B │
├───┤
│ C │
├───┤
│ D │
```

### 11.4 남은 직사각형 재귀 배치

하나의 partition 내부 배치 후 남는 공간이 직사각형이면, 그 공간에 다시 기존 strip 엔진 또는 partition planner를 적용한다.

---

## 12. Case별 개발 방향 수정

| Case | 기존 판단 | 수정 판단 |
|---|---|---|
| Case1 | 기존 AREA_TARGET_HYBRID 유지 | 유지 |
| Case2 | vertical-column으로 해결 | 오류. 회전 ON shallow recursive guillotine 필요 |
| Case3 | vertical-column으로 해결 | 오류. 회전 ON shallow recursive guillotine 필요 |
| Case4 | 2-stage partition 필요 | 부분 유지. 회전 ON `V→H→V` 재귀 필요 |

---

## 13. 탐색 파라미터 확정

deep research 기준 초기 구현 파라미터는 다음으로 고정한다.

| 파라미터 | 권장값 |
|---|---:|
| `MAX_RECURSION_DEPTH` | 4 |
| `beamWidth` | 4 |
| `cutCandidates` | 12 |
| `nodeBudgetPerBoard` | 500 |
| `targetTimeMs` | 300 |
| `hardTimeoutMs` | 1000 |

### 13.1 의미

- `MAX_RECURSION_DEPTH = 4`
  shallow witness를 커버하는 상한
- `beamWidth = 4`
  상위 4개 상태만 유지
- `cutCandidates = 12`
  각 rect에서 평가할 절단 후보 수 상한
- `nodeBudgetPerBoard = 500`
  판재 1장당 탐색 노드 총량 제한
- `targetTimeMs = 300`
  일반 응답 목표 시간
- `hardTimeoutMs = 1000`
  강제 fallback 시간 한계

### 13.2 현재 AREA_TARGET_HYBRID와의 차이

현재 구현은 beam width가 지나치게 넓고, 대신 상태 평가가 불안정하다.

idea_v3에서는 방향을 바꾼다.

```text
얕은 깊이
+ 작은 beam
+ 강한 cut candidate pruning
+ node/time budget 명시
```

---

## 14. 최종 개발 방향

### 1순위: Guillotine Partition Planner 기초 구현

목표:
- 첫 절단 후보 생성
- horizontal / vertical 둘 다 평가
- 절단 후 남은 공간 품질 평가
- 관통 절단 규칙 유지
- 부품별 `allowRotate` 명시 반영

---

### 2순위: partition 후보 폭 확장

기존:

```text
부품 폭만 후보
```

수정:

```text
부품 폭
회전 폭
부품 2개 합산 폭
반복 그룹 폭
micro-group exact box
```

까지 후보에 포함.

---

### 3순위: Case2, Case3 exact witness 구현

Case2, Case3은 더 이상 vertical-column 성공 케이스가 아니다.

검증 목표:

```text
회전 ON exact witness를 shallow recursive planner로 재현
```

---

### 4순위: Case4 2-stage partition 검증

Case4는 다음 방향으로 검증한다.

```text
1차 vertical split
→ 우측 horizontal band 생성
→ 내부 vertical subcolumn 생성
→ `V → H → V` shallow recursion 재현
```

---

### 5순위: Case1은 기존 로직 유지

Case1은 이미 AREA_TARGET_HYBRID로 목표 판재수 2장을 달성했으므로 새 로직 적용 대상에서 제외한다.

---

## 15. 목적함수

새 planner의 비교 기준은 단일 점수가 아니라 사전식 비교로 정의한다.

우선순위:

```text
1. 판재수 최소화
2. 미배치 부품 수 최소화
3. 폐기 면적 최소화
```

즉 두 해 `A`, `B` 비교는 다음 규칙을 따른다.

- 먼저 사용 판재 수가 더 적은 해를 선택
- 판재 수가 같으면 미배치 부품 수가 더 적은 해를 선택
- 둘 다 같으면 총 폐기 면적이 더 작은 해를 선택

폐기 면적은 다음으로 계산한다.

```text
총 폐기 면적
= 사용 판재 총면적 - 배치된 부품 총면적
```

이 정의는 기존 fallback 정책과도 일치한다.

```text
기존보다 판재수가 많으면 무조건 탈락
판재수가 같더라도 미배치가 늘면 탈락
둘 다 같을 때만 폐기 면적으로 비교
```

---

## 16. 탐색 제어

재귀 기반 guillotine 탐색은 경우의 수가 빠르게 폭증하므로 제어 조건이 필요하다.

### 16.1 최대 재귀 깊이

기본 상한은 deep research 권장값으로 고정한다.

```text
MAX_RECURSION_DEPTH = 4
```

실행 중 실제 depth는 다음으로 계산한다.

```text
maxDepth = min(남은 부품 수, MAX_RECURSION_DEPTH)
```

### 16.2 beam width

```text
beamWidth = 4
```

### 16.3 candidate budget

```text
cutCandidates = 12 per rect
```

### 16.4 node / time budget

```text
nodeBudgetPerBoard = 500
targetTimeMs = 300
hardTimeoutMs = 1000
```

### 16.5 pruning 조건

다음 상태는 즉시 가지치기한다.

- 남은 어떤 부품도 현재 rect에 물리적으로 들어가지 않는 경우
- 현재 사용 판재 수가 이미 기존 최적 판재 수보다 많은 경우
- 현재 미배치 수 하한이 기존 결과보다 나빠지는 경우
- 남은 부품 총면적이 남은 rect 총면적보다 큰 경우
- 생성된 child rect들이 모두 최소 부품 크기보다 작아 후속 배치가 불가능한 경우
- 동일한 `rect + remainingPartsSignature` 상태를 더 나쁜 비용으로 다시 방문한 경우
- depth가 `MAX_RECURSION_DEPTH`에 도달한 경우
- node budget 또는 time budget을 초과한 경우 legacy fallback으로 전환

Beam search를 사용할 경우에는 pruning 이후 상위 후보만 유지한다.

```text
후보 정렬 → 상위 beamWidth개 유지
```

---

## 17. 종료 조건

탐색 종료는 단순히 배치 성공/실패만이 아니라, 더 진행할 가치가 없는 상태를 조기에 중단하는 조건까지 포함한다.

deep research 기준 종료 조건은 총 8개로 확정한다.

1. `depth >= MAX_RECURSION_DEPTH` 이면 legacy fallback
2. 남은 수요가 0이면 성공 종료
3. 현재 어떤 orientation으로도 들어갈 부품이 없으면 종료
4. 남은 부품 총면적이 열린 직사각형 총면적보다 크면 종료
5. 후보 cut set이 비면 종료
6. time budget 초과 시 종료
7. node budget 초과 시 종료
8. 동일 state 재방문이면 prune

### 17.1 성공 종료

- 남은 부품이 0개이면 성공 종료

### 17.2 실패 종료

- 현재 rect 폭/높이에 어떤 부품도 들어가지 않으면 종료
- 남은 rect 집합 전체로도 남은 부품 총면적을 수용할 수 없으면 종료
- 후보 cut set이 비어 있으면 종료
- depth / time / node budget 초과 시 종료 후 legacy fallback

### 17.3 공간 기반 조기 중단

남은 공간이 최소 부품 크기보다 작으면 더 내려가지 않는다.

정의:

```text
minPartWidth  = 남은 부품들 중 최소 폭 후보
minPartHeight = 남은 부품들 중 최소 높이 후보
```

어떤 free rect에 대해:

```text
rect.width  < minPartWidth
and
rect.height < minPartHeight
```

이면 그 rect는 dead space로 간주하고 재귀를 중단한다.

보다 실용적으로는 회전 가능성까지 포함해 다음처럼 판정한다.

```text
해당 rect에 normal/rotated 어떤 방향으로도 들어갈 수 있는 부품이 없으면 중단
```

---

## 18. 상태 표현

새 planner의 내부 표현은 guillotine cut tree로 정의한다.

### 18.1 노드 구조

```text
Node {
  rect: { x, y, width, height }
  remainingPartsSignature
  placedParts[]
  cutOrientation: 'H' | 'V' | null
  cutPos: number | null
  leftChild: Node | null
  rightChild: Node | null
  waste: boolean
}
```

### 18.2 의미

- `rect`: 현재 노드가 담당하는 직사각형 영역
- `remainingPartsSignature`: 아직 배치되지 않은 부품 멀티셋 서명
- `placedParts[]`: 리프에서 직접 배치된 부품 목록
- `cutOrientation`: 이 노드에서 수행한 관통 절단 방향
- `cutPos`: 절단 위치
- `leftChild`, `rightChild`: 절단 후 생성된 두 자식 직사각형
- `waste`: 더 이상 사용할 수 없는 폐기 리프인지 여부

### 18.3 노드 종류

리프 노드:

```text
1. part leaf   → 부품이 직접 배치된 리프
2. waste leaf  → 남은 공간이지만 더 이상 배치 불가한 리프
```

내부 노드:

```text
cut node → H 또는 V 관통 절단을 한 노드
```

### 18.4 검증 규칙

유효한 cut tree는 다음을 만족해야 한다.

- 각 내부 노드는 정확히 한 번의 관통 절단만 가진다
- 자식 노드 2개는 부모 rect를 겹침 없이 완전히 분할한다
- 모든 리프의 부품은 rect 내부에 완전히 포함된다
- 어떤 두 리프 부품도 서로 겹치지 않는다
- 전체 트리를 순회하면 모든 절단이 guillotine 절단 순서로 재생성 가능해야 한다

---

## 19. 구현 원칙

- 기존 `guillotineCutA()`, `guillotineCutB()` 수정 금지
- 새 로직은 완전 별도 함수로 구현
- 기존 결과보다 나쁘면 기존 결과 채택
- 동일 결과도 기존 결과 우선
- 새 결과가 더 좋을 때만 채택
- 구현 전 git tag 생성 필수
- Case2/3은 기존 성공 가정 제거
- 후보 폭에 부품 합산 폭 포함 필수
- 부품별 `allowRotate` 명세 필수
- `MAX_RECURSION_DEPTH = 4` 초과 탐색 금지
- budget 초과 시 강제 legacy fallback

---

## 20. 현재 상태

- [x] 기존 row-first strip 구조 문제 확인
- [x] 관통 절단 절대 규칙 확인
- [x] Case2 vertical-column 오류 확인
- [x] Case3 vertical-column 오류 확인
- [x] Case2 rotation ON exact witness 확인
- [x] Case3 rotation ON exact witness 확인
- [x] Case4 rotation ON exact witness 확인
- [x] 회전 OFF에서는 Case2/3/4 모두 1장 불가 확인
- [x] 컬럼 폭 후보 불완전성 확인
- [x] 부품 2개 이상 합산 폭 후보 필요성 확인
- [x] vertical-column solver 표현 폐기
- [x] Guillotine Partition Planner로 방향 수정
- [x] shallow recursion depth 4 목표 확정
- [x] beam width 4 / candidate 12 / node budget 500 확정
- [x] 종료 조건 8개 확정
- [ ] first-cut candidate generator 설계
- [ ] partition width 후보 생성기 설계
- [ ] micro-group exact box generator 설계
- [ ] shallow recursive cut tree solver 설계
- [ ] Case2/3/4 witness 재현 구현
- [ ] regression benchmark
