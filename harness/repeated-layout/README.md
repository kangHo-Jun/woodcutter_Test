# 반복 배치 TDD — 비교 모듈 및 CASE5 기본 채택 (GREEN)

별도 `js/repeatedLayout.js`와 `js/repeatedLayoutUI.js`를 구현하고 Test index.html에
비교 버튼/창/PDF 다운로드를 연결했다. 비교 API는 기존 상태를 교체하지 않는다.
2026-09-28부터 Test main-unified의 기본 계산 경로는 승인된 CASE5 입력에 한해서
`approvedDefaultResult`로 4줄 정렬 후보를 채택한다. 일반 PDF도 같은 결과를 사용한다.
원판1220×2440×18/톱날4.2/자동/결ON/전단OFF/회전OFF/260×4508개+260×3508개만
적용 대상이며 다른 입력은 기존 결과를 유지한다. CASE5는 실제 개별 절단20회,
단가1,500원 기준30,000원이다. 비용 계산식 자체는 수정하지 않는다.
현재 기본채택 변경은 Test에만 적용했고 v4/v10은 이번에 수정하지 않았다.

## 실행

```bash
# 현재 프로그램: 10개 시나리오 × 3회, 모두 통과해야 함
node --test harness/repeated-layout/baseline.test.js

# 새 비교 기능 및 나무결 예외 검증
node --test harness/repeated-layout/comparison.test.js

# 전체 (모두 통과해야 함)
node --test harness/repeated-layout/*.test.js
```

10개 시나리오에 현재 프로그램 검증 10개, 새 비교 기능 검증 10개가 있다.
나무결 예외 1개, 톱날/끝단 경계 3개, UI 데이터 복사/정규화/버전별 전단 4개 및
기본채택11개를 더해 총39개 테스트다. 엔진 기준은 그대로 보존하고, 실제 UI의 CASE5
의도된 변경은 `default-adoption.test.js`와 `default-adoption-browser.cjs`로 별도 검증한다.
이 폴더의 CASE5~10은 새 반복 배치 시나리오이며, 기존 `harness/cases/case5.json`
(600×900 및 400×1000 혼합 2장 보호 사례)은 그대로 별도로 유지한다.
CASE1~4의 기준은 앞서 사용자에게 제시한 그림의 원본 JSON이다.
현재 코드를 실행할 때마다 기준 파일을 덮어쓰는 기능은 제공하지 않는다.
기준 채택 전 각 20회 실행하여 1개 결과만 나왔고 제시한 그림과 일치했다.
이 결과는 동일 환경/입력 순서에 관한 것이며 모든 환경에서의 결정성을 보장하지 않는다.

## 고정 시나리오

모든 치수는 UI 입력의 가로×세로, mm. 기본 원판 1220×2440×18,
톱날 4.2, 전단 OFF, 자동 모드. CASE1~4는 회전 ON/결 OFF,
CASE5~10은 회전 OFF/결 ON. 정확한 전체 BOM은 `cases.json`에 고정.

| 사례 | 입력 | 새 비교 기능의 기대 결과 |
|---|---|---|
| CASE1 | 사용자 지정 A~G 19개 | 기존 2장 배치·절단·요금 보존, 후보 없음 |
| CASE2 | 600×900 5개 | 기존 1장 배치·절단·요금 보존, 후보 없음 |
| CASE3 | 400×1000 7개 | 기존 1장 배치·절단·요금 보존, 후보 없음 |
| CASE4 | 사용자 지정 A~D 14개 | 기존 1장 배치·절단·요금 보존, 후보 없음 |
| CASE5 | 260×450 8개 + 260×350 8개 | 450/450/350/350 동일 4줄 후보 |
| CASE6 | 260×450 16개 | 450/450/450/450 동일 4줄 후보 |
| CASE7 | 260×450, 260×350, 260×500 각 4개 | 500/450/350 동일 4줄 후보 |
| CASE8 | 260×450 7개 + 260×350 9개 | 완전 반복 불가: 후보 없음, 기존 결과 유지 |
| CASE9 | 260×450 8개 + 280×350 8개 | 폭 혼합: 후보 없음, 기존 결과 유지 |
| CASE10 | CASE5 BOM, 원판 1070×2440, 전단 ON/여백 9 | 유효 폭 1043.6: 4줄 최소 폭 1052.6보다 작으므로 후보 없음 |

CASE10의 1043.6은 현재 UI 식 1070−2×(9+4.2)이다. 전단과 톱날을
무시하면 들어가는 것처럼 보이는 경계다. 남은 공간을 여러 패턴으로
메우는 최적화는 초기 범위에 넣지 않고 기존 배치로 돌아간다.

## 검증 경계와 공개 계약

승인된 계획의 두 경계인 기존 패킹 결과와 별도 배치 비교 결과를 검증한다.
기존 `GuillotinePacker.pack()`/비용 계산은 실제 코드로 실행하고 내부 메서드를
mock하거나 호출 횟수로 검증하지 않는다. 기존 UI 변환(축/결/전단)은
`support.prepareCase()`에 명시했으며 브라우저 통합 검증은 이후 별도로 한다.

구현 파일은 `js/repeatedLayout.js`, 공개 함수는 다음 계약을 사용한다.
Node에서는 require, 브라우저에서는 RepeatedLayout.compareLayouts로 사용할 수 있다.

```js
compareLayouts({ board, kerf, items, baseline }, { enabled })
// -> { baseline, candidate }
```

- `board.width`는 X(길이), `board.height`는 전단 후 Y(폭).
- `items`는 기존 UI와 동일하게 정규화한 품목 목록(수량 포함).
- `baseline`은 기존 pack 결과. 반환 baseline과 입력은 그대로 유지한다.
- 후보는 기존 pack 결과처럼 `bins`, `unplaced` 등을 제공하거나 `null`이다.
- 옵션 OFF에서는 후보 없음. ON에서도 기존 결과를 자동 교체하지 않는다.
- 후보는 기존보다 많은 판재를 쓰지 않고, 미배치/겹침/톱날 간격 부족/결 위반이 없어야 한다.
- CASE5~7은 반복 줄 개수·부품 순서·절단 위치 정렬까지 검증한다.
- 기존 요금은 후보에 맞춰 재계산하거나 대체하지 않는다.
- 새로운 함수 호출 후 기존 엔진을 다시 실행해 지속되는 부작용도 확인한다.
- 기존 geometry/cutDetails/guillotine 검증에 부품 사이 톱날 간격 검증을 추가했다.

## 보존 및 제한

`baseline-manifest.json`에 기준 소스 해시와 반복 검증 횟수를 기록했다.
보호 테스트는 배치, 방향, 수량, 잔재, 절단 정보, 표시 횟수, 재단비를 비교한다.
엔진 이름/실행 시간/검색 진단은 보호 대상에 넣지 않는다.
소스 해시는 이번 단계에서 기존 코드가 바뀌지 않았다는 증거이며 향후 구현의
합격 여부를 소스 해시로 판정하지 않는다.

복원 기준 Git 태그: `tdd-repeated-layout-before-20260922`.
태그는 커밋 기준이며 기존 미커밋 문서 변경까지 담는 백업은 아니다.

이전 RED 단계에서 모듈 미구현 실패를 확인한 뒤 구현했다. 현재는 기능 본문과
실제 절단 순서까지 검증한다. Test 전용 화면 비교 및 PDF 확인도 완료했다.

## 2026-09-22 이전 RED 단계 실행 결과

- 현재 기준 테스트: 10/10 PASS, 각 3회 실행.
- 새 비교 기능 테스트: 0/10 PASS, 10/10 예상 RED. 모두 미구현 모듈에 대한
  명시적인 assertion으로 실패했고 문법/환경 오류 또는 skip은 없다.
- 기존 `harness/regression.js`: 8/8 PASS.
- 배치 위치/수량/절단 정보/재단비를 각각 변조한 사본을 기존 기준과 비교해
  보호 검사가 네 종류의 변경을 모두 감지하는지 확인.
- packer/costCalculator/main-unified/settingsManager 파일 해시 변경 없음.
- v4/v10 작업 트리 변경 없음.

## GREEN 단계 구현 및 발견 사항

- 같은 높이(정규화된 폭)의 부품이 같은 순서로 반복되는 단일 판재 후보만 생성.
- 수량의 공약수인 줄 개수를 큰 값부터 검토하고, 톱날과 끝단 절단 여유까지 확인.
- 입력 객체 변경/회전 추가/자동 선택/요금 변경 없음. 기존 baseline은 원래 참조 그대로 반환.
- 스트립 분리 후 각 스트립을 자르는 실제 순서와 sourceRect를 생성. 테스트에서
  매 절단을 원판부터 재실행하여 최종 부품과 잔재가 정확히 만들어지는지 검증.
- 후보 cuttingCount는 개별 스트립을 따로 자르는 횟수. CASE5는 20회이며
  묶음 절단 추정 8회나 기존 표시/청구 16회와 같은 지표가 아니다. 비용 계산에 연결하지 않음.
- CASE7의 처음 260×200 입력은 결 ON에서 폭이 200으로 정규화되어 성공 조건과 모순이었다.
  이 조건은 예외 테스트로 보존하고, 세 길이 성공 사례는 500/450/350 각4개로 바로잡음.
- 450/350/300 각4개로 검토하는 중 기존 B 엔진 절단선 하나가 부품을 관통하는 기록 오류를 발견.
  새로운 모듈과 무관하며 기존 코드를 변경하지 않고 아래 재현 파일로 보존함.

```bash
# 알려진 기존 오류: cutDetailsValid FAIL, 종료 코드 1 예상
node harness/run.js --case harness/repeated-layout/known-issues/three-length-300.json
```

해당 알려진 오류는 통과했다고 보고하지 않으며 별도 기존 엔진 수정 작업이 필요하다.
사용자가 지정한 CASE1~4는 입력/기준 파일 그대로 유지했다.

검증 결과: 기본/비교/나무결 21개 PASS, boundary.test.js 3개 PASS (합계24개).
기존 회귀 8/8 PASS. 기존 js 4종 해시 유지. 비교 JSON과 PNG는
`harness/output/repeated-layout-case5.json`, `harness/output/repeated-layout-case5-comparison.png`에 저장했다.

## Test 화면/PDF 통합 검증 완료

- 최적화 계산 후 `반복 배치 비교 · Test` 버튼으로 연다. 후보 보기 ON/OFF,
  조건 밖 안내, 기존/후보 나란히 보기, 별도 `비교 PDF 다운로드` 제공.
- 기존 AppState의 costInfo 알림에서 입력/결과/비용 복사본을 저장한다.
  입력/설정/부품/결과 변경 및 아직 확정하지 않은 폼 편집도 비교 결과를 무효화한다.
- 새 리스너 오류는 별도로 처리해 기존 계산 호출로 전파하지 않는다.
- 모바일에서는 도면을 줄여 치수가 읽히지 않는 문제를 막기 위해 도면별 가로 스크롤 제공.
- Node 테스트 27/27 PASS. 실제 Chromium에서 10개 사례의 계산→비교 ON/OFF→결과 유지→
  입력 변경 무효화 검증 통과. CASE5는 폼으로 직접 부품을 추가하는 경로도 통과.
- CASE1~4는 브라우저 실행 결과도 최초 기준 배치/절단/요금과 일치.
- 실제 비교 PDF(CASE1 2페이지/CASE5 1페이지) 및 기존 PDF(CASE5 2페이지) 다운로드 확인.
  Poppler로 렌더해 한글/치수/다중 페이지/도면 잘림 확인. 기존 PDF의 세로 회전 표시도 그대로 유지.
- 비교 PDF는 무손실 압축 적용. CASE5 약287KB, CASE1 약313KB. CASE5는 압축 전후
  렌더 픽셀 완전 일치 확인. 브라우저 pageerror 없음.
- 산출물은 `output/playwright/`에 저장하고 Git 제외. browser-results.json 및 화면/PDF 포함.
- Playwright CLI 설치는 npm DNS 제한으로 실패하여 사전 설치된 Playwright 라이브러리로 검증.
  Chromium 시작은 샌드박스 프로세스 제한 때문에 승인된 확장 권한으로 실행했다.

```bash
# 터미널 1: woodcutter_Test 디렉터리에서 로컬 실행
python3 -m http.server 8765 --bind 127.0.0.1
# 터미널 2: playwright가 설치된 Node 환경에서
node harness/repeated-layout/browser-check.cjs
```

다른 Node 런타임을 사용할 때는 NODE_PATH를 해당 node_modules 위치로 설정한다.
현장 묶음 절단 조건/후보 자동 채택/요금 변경은 수행하지 않았다.

## v4/v10 로컬 이식 검증

- Test 통과 승인 후 같은 비교 모듈과 CSS를 v4/v10에 이식하고 기본 index.html에 연결했다.
- 버전별 전단 방식이 달라 createSnapshot은 기존 엔진이 계산한 bin.width/height를 그대로 사용한다.
  이 변경은 Test에서 먼저 실패/통과 확인했고 공통 자동 검사 28/28 PASS.
- browser-check.cjs의 WOODCUTTER_URL/WOODCUTTER_OUTPUT으로 대상 페이지와 산출물 위치 지정.
- WOODCUTTER_BASELINE_ONLY=1과 WOODCUTTER_BEFORE_FILE로 적용 전 각10개 기준을 저장하고,
  적용 후 WOODCUTTER_BEFORE_FILE만 지정해 해당 버전의 전체 결과/비용/부품을 정확히 대조.
- 두 버전 모두 10개 PASS, 기존 JS 해시 동일. Test 브라우저도 10개 재검증.
- mobile-check.cjs는 로컬8766 상위 루트 서버에서 v4/v10을 최초390×844로 열어 폼 입력,
  비교ON/OFF, PDF, 기존 상태 유지, 입력 변경 무효화를 검증한다. 두 버전 PASS.
- 산출물 output/playwright/rollout-v4 및 rollout-v10. 구형 index-mobile/index-pc-old는 수정하지 않았다.
- 로컬 코드 적용이며 원격 푸시/배포는 하지 않았다.
