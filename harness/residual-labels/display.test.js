'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {runScenario,deepFreeze}=require('../repeated-layout/support');
const scenario=require('./case11.json');

test('CASE11: 기존2장 배치에서 실제 잔재를 정수로 한 번씩 표시한다',()=>{
 const display=require('../../js/residualLabels');
 const run=runScenario(scenario),before=structuredClone(run.result);
 const bin=deepFreeze(run.result.bins[0]);
 const result=display.build({bin,board:{width:1820,height:910},kerf:4.2});
 assert.deepEqual(result.unresolved,[]);
 assert.deepEqual(result.labels.map(l=>l.text).sort(),['649 × 185','1820 × 65','51 × 650'].sort());
 assert.equal(run.result.bins.length,2);
 assert.deepEqual(run.result,before);
});

for(const [id,text] of [['CASE2','600 × 315'],['CASE3','400 × 215']]){
 test(id+': 엔진의 잔재목록이 누락돼도 최종 부품 분리 후의 실치수를 표시한다',()=>{
  const d=require('../repeated-layout/cases.json').find(c=>c.id===id),run=runScenario(d);
  const bin=deepFreeze(run.result.bins[0]);
  const result=require('../../js/residualLabels').build({bin,board:{width:2440,height:1220},kerf:4.2});
  assert.deepEqual(result.unresolved,[]);
  assert(result.labels.some(l=>l.text===text));
 });
}

test('정수는 버림, 계산 오차만 정리하고 서로 다른 실치수는 합치지 않는다',()=>{
 const d=require('../../js/residualLabels');
 assert.equal(d.formatMm(649.3999999999),'649');
 assert.equal(d.formatMm(649.999),'649');
 assert.equal(d.formatMm(649.9999999999999),'650');
 assert.equal(d.formatMm(0),'0');
 const bin={placed:[],freeRects:[{x:0,y:0,width:649.1,height:100},{x:653.3,y:0,width:649.9,height:100}]};
 const r=d.build({bin,board:{width:1303.2,height:100},kerf:4.2});
 assert.equal(r.labels.length,2);assert(r.labels.every(l=>l.regions.length===1));
});

test('CASE4 오른쪽은 실제 두 잔재만 표기하고 CASE5 동일 네 조각은 수량으로 묶는다',()=>{
 const d=require('../../js/residualLabels'),cases=require('../repeated-layout/cases.json');
 const {approvedDefaultResult}=require('../../js/repeatedLayout');
 for(const id of ['CASE4','CASE5']){
  const c=cases.find(c=>c.id===id),run=runScenario(c);
  const selected=approvedDefaultResult({board:{width:2440,height:1220},kerf:4.2,items:run.items,baseline:run.result,settings:{...c.settings,cutDirection:'auto'},boardSpec:{...c.board,considerGrain:c.settings.considerGrain},cuttingList:c.items});
  const r=d.build({bin:selected.bins[0],board:{width:2440,height:1220},kerf:4.2});
  assert.deepEqual(r.unresolved,[]);
  if(id==='CASE4')assert.deepEqual(r.labels.map(l=>l.text).sort(),['771 × 59','191 × 600','169 × 397'].sort());
  else assert.deepEqual(r.labels.map(l=>l.text).sort(),['823 × 260 · 4개','2440 × 163'].sort());
 }
});

test('kerf0·딱맞음·가로모드·얇은 끝단·빈 판재를 계산 결과 변경 없이 처리한다',()=>{
 const d=require('../../js/residualLabels');
 assert.deepEqual(d.build({bin:{placed:[{x:0,y:0,width:100,height:100}]},board:{width:100,height:100},kerf:4.2}).rectangles,[]);
 assert.deepEqual(d.build({bin:{placed:[{x:0,y:0,width:98,height:100}]},board:{width:100,height:100},kerf:4.2}).rectangles,[]);
 assert.deepEqual(d.build({bin:{placed:[]},board:{width:100,height:100},kerf:0}).rectangles,[{x:0,y:0,width:100,height:100}]);
 for(const kerf of [0,4,4.2]){
  const c=structuredClone(scenario);c.settings.kerf=kerf;c.settings.mode='horizontal';
  const run=runScenario(c),snapshot=structuredClone(run.result);
  for(const bin of run.result.bins){
   const r=d.build({bin,board:{width:1820,height:910},kerf});
   assert.deepEqual(r.unresolved,[]);
   for(const rect of r.rectangles){assert(rect.width>0&&rect.height>0);assert(rect.x+rect.width<=1820+1e-6);assert(rect.y+rect.height<=910+1e-6);}
  }
  assert.deepEqual(run.result,snapshot);
 }
});
