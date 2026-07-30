# Woodcutter Node 검증 하네스

프로덕션의 `js/packer.js`, `js/costCalculator.js`,
`js/settingsManager.js`를 수정하지 않고 Node에서 함께 로드한다.

## 실행

```bash
node harness/run.js --case case1.json
node harness/run.js --case dataset-b-548.json --repeat 10 --shuffle
node harness/run.js --case case2.json --svg harness/output/case2.svg
node harness/regression.js
node harness/regression.js --repeat 10 --shuffle
```

`run.js`는 매 반복마다 새 `GuillotinePacker` 인스턴스를 생성한다.
`--shuffle`은 부품 그룹 순서를 매번 섞어 GPP의 시간 제한과 입력 순서
의존성을 함께 측정한다.

## 판정

- `geometryValid`: 판재 경계, 부품 겹침, 입력 수량과 치수 확인
- `cutDetailsValid`: 절단선 범위, 부품 내부 통과 여부와 선택적
  `sourceRect` 일관성 확인
- `guillotineSequenceValid`: 좌표 배치를 재귀적으로 두 비어 있지 않은
  직사각형 집합으로 분리할 수 있는 관통 절단 순서가 존재하는지 확인

세 검증 중 하나라도 실패하면 해당 실행은 실패한다. `required` 케이스는
판재 수가 JSON의 `expected.maxBins` 이하인지도 확인한다. 엔진 이름은
기록만 하며 합격 조건으로 사용하지 않는다. `reference` 케이스의 판재
수는 정보로만 표시한다.

현재 `cutDetails`에는 엔진에 따라 `sourceRect`가 없는 레거시 절단선도
있다. 이때 범위와 부품 관통 여부를 검증하고, `sourceRect`가 제공된
절단선에는 추가 일관성 검사를 적용한다.

## 케이스 출처

- CASE1~5: `docs/알고리즘2개.md`의 canonical 명세
- 데이터셋A-1/A-2: Phase 0 작업 지시서의 고정 BOM
- 데이터셋B: 548 시리즈 참고 데이터

CASE1과 데이터셋A-2는 BOM이 같지만 회귀 이름과 지시서 데이터셋 역할을
각각 보존하기 위해 별도 파일로 유지한다.

## JSON 형식

```json
{
  "name": "CASE2",
  "classification": "required",
  "board": { "width": 1220, "height": 2440, "thickness": 18 },
  "settings": { "kerf": 4.2, "mode": "auto", "considerGrain": false },
  "expected": { "maxBins": 1, "engineReference": "GPP" },
  "items": [
    { "id": "A", "width": 600, "height": 900, "qty": 5, "allowRotate": true }
  ]
}
```

SVG는 선택 기능이며 외부 패키지가 필요 없다. 생성된 `harness/output/`
파일은 커밋 대상이 아니다.
