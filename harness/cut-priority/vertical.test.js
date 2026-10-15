'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareCase, assertValid, assertSequentialCuts, deepFreeze } = require('../repeated-layout/support');
const case12 = require('./case12.json');

test('CASE12: 회전 허용 시 B형 세로 구역으로 15개를 1장에 절단한다', () => {
    const planner = require('../../js/verticalStripPacker');
    const data = prepareCase(case12);
    const input = deepFreeze({ board: { width: 2440, height: 1220 }, kerf: 4.2, items: data.items });
    const result = planner.pack(input);
    assert.equal(result.mode, 'vertical');
    assert.equal(result.bins.length, 1);
    assert.equal(result.bins[0].placed.length, 15);
    assert.equal(result.bins[0].cutDetails[0].axis, 'X');
    assertValid({ caseData: data, items: data.items, result });
    assertSequentialCuts(result, 4.2);
    const stripWidths = [...new Map(result.bins[0].placed.map(p => [p.x, p.width])).values()].sort((a,b) => a-b);
    assert.equal(stripWidths.length, 5);
    assert.ok(stripWidths.includes(850));
    assert.ok(stripWidths.reduce((sum,w) => sum+w, 0)+4*4.2 <= 2434.8+1e-6,
        '회전이 허용되므로 도면 B의 점유길이보다 작아도 유효하다');
});

test('잘못된 치수·수량·톱날 값은 계산 전에 거부한다', () => {
    const planner = require('../../js/verticalStripPacker');
    const input = { board: {width:2440,height:1220}, kerf:4.2, items:[{width:400,height:396,qty:0}] };
    assert.throws(() => planner.pack(input), /입력/);
    assert.throws(() => planner.pack({...input, kerf:-1}), /입력/);
});

test('탐색 한도에 도달하면 부분 결과 대신 명시적 오류를 반환하고 원본을 보존한다', () => {
    const planner = require('../../js/verticalStripPacker');
    const input = deepFreeze({ board:{width:2440,height:1220}, kerf:4.2, items:case12.items });
    assert.throws(() => planner.pack(input, {maxOperations:1}), e => e.code === 'VERTICAL_SEARCH_LIMIT');
    assert.throws(() => planner.pack({...input, items:[{width:1,height:1,qty:10001}]}), /10,000/);
});

for (const grain of [false, true]) for (const trim of [false, true]) {
    test(`CASE12 결=${grain} 전단=${trim}: 수량·방향·순차절단·입력불변`, () => {
        const scenario = structuredClone(case12);
        scenario.settings.considerGrain = grain;
        scenario.settings.enableTrim = trim;
        const data = prepareCase(scenario);
        const input = deepFreeze({ board:{width:data.board.height,height:data.board.width}, kerf:4.2, items:data.items });
        const planner = require('../../js/verticalStripPacker');
        const result = planner.pack(input);
        assertValid({caseData:data, items:data.items, result});
        assertSequentialCuts(result, 4.2);
        assert.deepEqual(planner.pack(input), result, '동일 입력의 결과는 일정해야 함');
        if (grain) assert.ok(result.bins.flatMap(b=>b.placed).every(p=>!p.rotated && p.width>=p.height));
    });
}

test('B 도면 방향 고정 시 1장, 톱날 여유 부족·초과 부품은 미배치', () => {
    const pack = require('../../js/verticalStripPacker').pack;
    const result = pack({board:{width:2440,height:1220},kerf:4.2,items:[
        {width:850,height:546,qty:1,allowRotate:false}, {width:850,height:260,qty:2,allowRotate:false},
        {width:400,height:396,qty:6,allowRotate:false}, {width:364,height:396,qty:6,allowRotate:false}
    ]});
    assert.equal(result.bins.length, 1);
    assert.equal(result.unplaced.length, 0);
    assertSequentialCuts(result,4.2);
    for (const [width, expected] of [[100,0],[96,1],[95.8,0],[110,1]]) {
        const edge = pack({board:{width:100,height:100},kerf:4.2,items:[{width,height:100,qty:1,allowRotate:false}]});
        assert.equal(edge.unplaced.length,expected);
        assertSequentialCuts(edge,4.2);
    }
});

test('기존 11개 입력도 세로 모드에서 부품과 유효 절단을 보존한다', () => {
    const planner = require('../../js/verticalStripPacker');
    for (const s of [...require('../repeated-layout/cases.json'),require('../residual-labels/case11.json')]) {
        const data = prepareCase(s);
        const result = planner.pack({board:{width:data.board.height,height:data.board.width},kerf:data.settings.kerf,items:data.items});
        assertValid({caseData:data,items:data.items,result});
        assertSequentialCuts(result,data.settings.kerf);
    }
});
