'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const scenarios=[...require('../repeated-layout/cases.json'),require('./case11.json')];
const {visibleResult,prepareCase,assertValid}=require('../repeated-layout/support');
const target=process.env.TARGET||'Test',phase=process.env.PHASE||'before';
const out=path.resolve('output/residual-labels',target,phase);fs.mkdirSync(out,{recursive:true});
const beforePath=path.join(__dirname,'baselines',target+'.json');
const baseline=phase==='after'?JSON.parse(fs.readFileSync(beforePath,'utf8')):null;
(async()=>{
 const browser=await chromium.launch({headless:true});const errors=[],cases=[];
 try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1,acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('BROWSER '+m.type()+': '+m.text());});
 await page.addInitScript(()=>{
  window.__labels=[];
  const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(...args){window.__labels.push({text:String(args[0]),style:this.fillStyle,canvas:this.canvas.id});return original.apply(this,args);};
 });
 await page.goto(process.env.URL||'http://127.0.0.1:8876/',{waitUntil:'networkidle'});
 for(const scenario of scenarios){
  await page.evaluate(d=>{
   appState.reset();window.__labels=[];
   for(const [id,value] of Object.entries({boardWidth:d.board.width,boardHeight:d.board.height,boardThickness:d.board.thickness}))document.getElementById(id).value=value;
   document.getElementById('considerGrain').checked=d.settings.considerGrain;
   SettingsManager.applyToUI({...SettingsManager.DEFAULT_SETTINGS,...d.settings,cutDirection:d.settings.mode});
   appState.updateBoardSpec({...d.board,considerGrain:d.settings.considerGrain});
   d.items.forEach(item=>appState.addPart({...item,rotatable:item.allowRotate}));
  },scenario);
  await page.locator('#calculateBtn').click();
  await page.waitForFunction(()=>appState.result&&!document.getElementById('calculateBtn').disabled);
  // displayResults schedules drawing on the next frame after calculation finishes.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const data=await page.evaluate(()=>({result:appState.result,cost:appState.costInfo,labels:window.__labels,settings:appState.settings}));
  const prepared=prepareCase(scenario);
  if(target==='v4'&&scenario.settings.enableTrim)prepared.board.width=scenario.board.width-14;
  assertValid({caseData:prepared,items:prepared.items,result:data.result});
  if(baseline){
   const old=baseline.cases.find(c=>c.id===scenario.id);
   assert.deepEqual(visibleResult(data.result),visibleResult(old.result),scenario.id+' layout/cuts changed');
   assert.deepEqual(data.cost,old.cost,scenario.id+' price changed');
   const labels=data.labels.filter(l=>l.style==='#6a4b2a').map(l=>l.text);
   if(!labels.length) fs.writeFileSync(path.join(out,scenario.id+'-diagnostic.json'),JSON.stringify({data,issues:await page.evaluate(()=>app.lastResidualLabelIssues)},null,2));
   assert(labels.length>0,scenario.id+' missing remnant labels');
   assert(labels.every(t=>!/[0-9]\.[0-9]/.test(t)),scenario.id+' decimals');
   if(scenario.id==='CASE11')for(const t of ['649 × 185','1820 × 65','51 × 650'])assert(labels.includes(t),t);
   if(scenario.id==='CASE4')for(const t of ['191 × 600','169 × 397'])assert.equal(labels.filter(x=>x===t).length,1,t);
   if(scenario.id==='CASE5')assert(labels.includes('823 × 260 · 4개'));
   assert.deepEqual(await page.evaluate(()=>app.lastResidualLabelIssues||[]),[],scenario.id+' unresolved');
  }
  await page.locator('#canvasScrollContainer').evaluate(e=>{e.style.maxHeight='none';e.style.height='auto';e.style.overflow='visible';});
  await page.locator('#canvasScrollContainer').screenshot({path:path.join(out,scenario.id+'.png')});
  if(phase==='after'){
   const pending=page.waitForEvent('download');await page.locator('#downloadPdfBtn').click();
   const dl=await pending;const file=path.join(out,scenario.id+'.pdf');await dl.saveAs(file);
   assert.equal(await dl.failure(),null);assert(fs.statSync(file).size<10_000_000);
   assert(fs.readFileSync(file).subarray(0,5).toString()==='%PDF-');
   const after=await page.evaluate(()=>({result:appState.result,cost:appState.costInfo}));
   assert.deepEqual(after,{result:data.result,cost:data.cost},'PDF mutated app');
  }
  cases.push({id:scenario.id,...data});console.log(target+' '+phase+' '+scenario.id+' OK');
 }
 if(phase==='after'){
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>app.isMobile===true);
  await page.evaluate(()=>app.switchPanel('center'));
  await page.locator('#groupCanvas-0').screenshot({path:path.join(out,'CASE11-mobile.png')});
  const old=await page.evaluate(()=>({result:appState.result,kerf:appState.settings.kerf}));
  await page.evaluate(()=>{
   const input=document.getElementById('kerfInput');if(input)input.value='0';
   appState.settings.kerf=0; // v4 has no kerf control; also exercise the state fallback.
  });
  await page.evaluate(()=>{window.__labels=[];app.drawBinToCanvas(document.getElementById('groupCanvas-0'),appState.result.bins[0],appState.labeledGroups);});
  const labels=await page.evaluate(()=>window.__labels.filter(l=>l.style==='#6a4b2a').map(l=>l.text));
  assert(labels.includes('649 × 185'),'display must use calculation-time kerf');
  assert.deepEqual(await page.evaluate(()=>appState.result),old.result);
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({target,phase,errors,cases},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
