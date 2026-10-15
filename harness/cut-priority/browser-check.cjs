'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { prepareCase, visibleResult, assertValid, assertSequentialCuts } = require('../repeated-layout/support');
const sample = require('./case12.json');
const baseline = require('../residual-labels/baselines/Test.json');
const out = path.resolve(__dirname, '../../output/playwright/cut-priority');
fs.mkdirSync(out,{recursive:true});
const url = process.env.TEST_URL || 'http://127.0.0.1:8894/woodcutter_Test/';
(async () => {
    const browser = await chromium.launch({headless:true});
    const errors = [], results = [];
    try {
        async function open(mobile = false) {
            const page = await browser.newPage({viewport: mobile ? {width:390,height:844} : {width:1600,height:1100},acceptDownloads:true});
            page.on('pageerror',e=>errors.push(e.message));
            page.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
            await page.goto(url,{waitUntil:'networkidle'});
            assert(await page.evaluate(()=>!!window.jspdf),'실제 PDF 라이브러리');
            assert.equal(await page.locator('#priorityHorizontal:checked').count(),1,'가로 절단 우선이 기본 선택');
            return page;
        }
        async function seed(page,s) {
            await page.evaluate(d=>{
                appState.reset();
                for (const [id,v] of Object.entries({boardWidth:d.board.width,boardHeight:d.board.height,boardThickness:d.board.thickness})) document.getElementById(id).value=v;
                document.getElementById('considerGrain').checked=d.settings.considerGrain;
                SettingsManager.applyToUI({...SettingsManager.DEFAULT_SETTINGS,...d.settings,cutDirection:'auto'});
                appState.updateBoardSpec({...d.board,considerGrain:d.settings.considerGrain});
                d.items.forEach(p=>appState.addPart({...p,rotatable:p.allowRotate}));
            },s);
        }
        async function calculate(page,mobile=false) {
            if(mobile) await page.locator('[data-panel="left"]').click();
            await page.locator('#calculateBtn').click();
            await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
            return page.evaluate(()=>({result:appState.result,cost:appState.costInfo}));
        }
        async function choose(page,value,mobile=false) {
            if(mobile) await page.locator('[data-panel="left"]').click();
            await page.locator(value==='vertical'?'#priorityVertical':'#priorityHorizontal').check();
        }
        async function pdf(page,name,expectedLabel,mobile=false) {
            if(mobile) await page.locator('[data-panel="center"]').click();
            const before=await page.evaluate(()=>JSON.stringify({result:appState.result,cost:appState.costInfo}));
            await page.evaluate(()=>{
                window.__pdfText=[];
                const original=CanvasRenderingContext2D.prototype.fillText;
                window.__restoreText=()=>{CanvasRenderingContext2D.prototype.fillText=original;};
                CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__pdfText.push(text);return original.call(this,text,...args);};
            });
            const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#downloadPdfBtn').click()]);
            const file=path.join(out,name+'.pdf');await download.saveAs(file);
            const text=await page.evaluate(()=>{window.__restoreText();return window.__pdfText;});
            assert(text.some(t=>t.includes(expectedLabel)), 'PDF에 계산 당시 절단 방식 표시');
            assert.equal(await page.evaluate(()=>JSON.stringify({result:appState.result,cost:appState.costInfo})),before);
            const bytes=fs.readFileSync(file);assert(bytes.length<=10000000 && bytes.subarray(0,5).toString()==='%PDF-');
            return bytes.length;
        }
        const page=await open();
        for(const s of [...require('../repeated-layout/cases.json'),require('../residual-labels/case11.json')]) {
            await seed(page,s);
            const actual=await calculate(page), old=baseline.cases.find(c=>c.id===s.id);
            assert.deepEqual(visibleResult(actual.result),visibleResult(old.result),s.id+' 기존 배치');
            assert.deepEqual(actual.cost,old.cost,s.id+' 기존 요금');
            const bytes=await pdf(page,s.id,'가로 절단 우선');
            await choose(page,'vertical');
            assert.match(await page.locator('#cutPriorityStatus').textContent(),/재계산/);
            assert.deepEqual(await page.evaluate(()=>appState.result),actual.result,'선택만으로 결과를 바꾸지 않음');
            const vertical=await calculate(page),data=prepareCase(s);
            assert.equal(vertical.result.mode,'vertical');
            assertValid({caseData:data,items:data.items,result:vertical.result});assertSequentialCuts(vertical.result,data.settings.kerf);
            await choose(page,'auto');
            const restored=await calculate(page);
            assert.deepEqual(restored,actual,s.id+' 가로 복귀');
            results.push({id:s.id,baseline:true,roundTrip:true,pdfBytes:bytes,verticalPanels:vertical.result.bins.length});
            console.log(s.id,'기존/세로/복귀/PDF PASS');
        }
        await page.close();
        for(const mobile of [false,true]) {
            const p=await open(mobile);
            // Actual form entry, including rotation checkbox.
            await p.locator('#enableTrim').uncheck();await p.locator('#considerGrain').uncheck();await p.locator('#partRotatable').check();
            for(const part of sample.items) {
                await p.locator('#partWidth').fill(String(part.width));await p.locator('#partHeight').fill(String(part.height));
                await p.locator('#partQty').fill(String(part.qty));await p.locator('#addPartBtn').click();
            }
            const horizontal=await calculate(p,mobile);
            await choose(p,'vertical',mobile);
            const actual=await calculate(p,mobile);
            assert.equal(actual.result.bins.length,1);
            const data=prepareCase(sample);assertValid({caseData:data,items:data.items,result:actual.result});assertSequentialCuts(actual.result,4.2);
            const name='CASE12-'+(mobile?'mobile':'desktop');
            await pdf(p,name,'세로 절단 우선',mobile);
            await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});
            await choose(p,'auto',mobile);
            await pdf(p,name+'-pending','세로 절단 우선',mobile);
            assert.deepEqual(await calculate(p,mobile),horizontal,'가로 복귀');
            await choose(p,'vertical',mobile);
            await p.locator('#considerGrain').check();
            const grainResult=await calculate(p,mobile);
            assert.ok(grainResult.result.bins.flatMap(b=>b.placed).every(part=>!part.rotated && part.width>=part.height));
            const grain=structuredClone(sample);grain.settings.considerGrain=true;
            const prepared=prepareCase(grain);assertValid({caseData:prepared,items:prepared.items,result:grainResult.result});
            await pdf(p,name+'-grain','세로 절단 우선',mobile);
            results.push({id:name,freePanels:actual.result.bins.length,grainPanels:grainResult.result.bins.length});
            await p.close();
        }
        assert.deepEqual(errors,[]);
        fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));
        console.log('PASS',results.length,'scenarios; JS errors=0');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
