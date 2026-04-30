# AGENTS.md — 코딩 에이전시 행동 규칙

## 역할
- 감독자(Zart)의 지시만 수행
- 분석/보고/코딩 수행, 판단은 감독자가 함
- 코딩 전 반드시 이 파일과 context.md 먼저 읽기

## 절대 규칙
- v4 코드 수정 금지 (읽기 전용)
- 지시된 파일 외 다른 파일 수정 금지
- 코딩 전 반드시 분석 먼저, 감독자 승인 후 수정
- 작업 완료 시 context.md 업데이트 필수

## 프로젝트 구조
- woodcutter_v4: 스마트폰용 완성본 (읽기 전용)
- woodcutter_v10: PC용 완성본
- woodcutter_Test: 로직 개발/검증 전용 (모든 수정은 여기서)

## 축 규칙 (절대 불변)
- boardHeight = 길이 = 가로축(X)
- boardWidth = 폭 = 세로축(Y)
- packerW = boardHeight, packerH = boardWidth
- isPortraitBoard = false 항상

## 알고리즘 규칙
- 알고리즘 선택: unplaced → bins → cutDetails.length → B 우선
- heightCandidates: item.height만 사용 (회전 후보 제외)

## 비용 규칙
- 쭉절단 판정: axis=Y, spanStart=0, spanEnd=판재길이 기준
- 쭉절단 최소 폭: 50mm
- 전단여백: 높이축만 적용

## 테스트 규칙
- 브라우저 콘솔: app.handleCalculate().then(function(){...})
- await 사용 금지 (SyntaxError)
- 수정 전 반드시 git tag로 롤백 포인트 생성