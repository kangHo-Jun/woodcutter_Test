'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const sample=require('./case12.json');
const out=path.resolve(__dirname,'../../output/playwright/cut-priority');
const url=process.env.TEST_URL || 'http://127.0.0.1:8894/woodcutter_Test/';
(async()=>{
    const browser=await chromium.launch({headless:true});
    const errors=[];
    try {
        const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
        page.on('pageerror',e=>errors.push(e.message));
        page.on('dialog',d=>d.accept());
        await page.goto(url,{waitUntil:'networkidle'});
        await page.evaluate(s=>{appState.updateBoardSpec({...s.board,considerGrain:false});s.items.forEach(p=>appState.addPart({...p}));},sample);
        await page.locator('#calculateBtn').click();
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const status=await page.locator('#cutPriorityStatus').boundingBox(),nav=await page.locator('.mobile-nav').boundingBox();
        assert(status.y>=nav.y+nav.height,'모바일 결과 안내가 고정 탭 아래에 보여야 함');
        await page.locator('[data-panel="left"]').click();
        await page.locator('#priorityVertical').check();
        assert(await page.locator('#cutPriorityPending').isVisible(),'입력 화면에서도 재계산 안내 표시');
        const previous=await page.evaluate(()=>({result:appState.result,cost:appState.costInfo}));
        // Actual planner limit, not a mocked engine failure.
        await page.evaluate(()=>{appState.cuttingList[0].qty=10001;});
        const dialog=page.waitForEvent('dialog');
        await page.locator('#calculateBtn').click();
        assert.match((await dialog).message(),/10,000/);
        assert.deepEqual(await page.evaluate(()=>({result:appState.result,cost:appState.costInfo})),previous,'실패 시 이전 결과·요금 보존');
        assert.equal(await page.locator('#calculateBtn').isEnabled(),true);
        await page.evaluate(()=>{appState.cuttingList[0].qty=1;});
        await page.locator('#calculateBtn').click();
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        assert.equal(await page.locator('#cutPriorityPending').isVisible(),false);
        await page.locator('[data-panel="left"]').click();
        await page.locator('#priorityVertical').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(out,'mobile-controls.png')});
        const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#saveBtn').click()]);
        const saved=path.join(out,'saved-vertical.json');await download.saveAs(saved);
        assert.equal(JSON.parse(fs.readFileSync(saved)).settings.cutDirection,'vertical');
        await page.reload({waitUntil:'networkidle'});
        assert(await page.locator('#priorityVertical').isChecked(),'선택 저장');
        await page.locator('#newBtn').click();
        assert(await page.locator('#priorityHorizontal').isChecked(),'새 프로젝트 가로 기본값');
        assert.equal(await page.evaluate(()=>appState.settings.cutDirection),'auto');
        async function load(file) {
            const chooser=page.waitForEvent('filechooser');
            await page.evaluate(()=>app.handleLoadProject());
            await (await chooser).setFiles(file);
            await page.waitForFunction(()=>appState.cuttingList.length===4);
        }
        await load(saved);
        assert(await page.locator('#priorityVertical').isChecked(),'프로젝트 파일의 선택 복원');
        await page.locator('#calculateBtn').click();
        assert.equal(await page.evaluate(()=>appState.result.mode),'vertical');
        const summary=await page.evaluate(async()=>{
            const state=structuredClone({boardSpec:appState.boardSpec,result:appState.result,costInfo:appState.costInfo,settings:appState.settings});
            state.labeledGroups=Array.from({length:24},(_,i)=>({label:`S${i+1}`,width:100+i,height:200,count:1}));
            const rows=[],original=CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){
                rows.push({text,y,bottom:y+this.measureText(text).actualBoundingBoxDescent,height:this.canvas.height});
                return original.call(this,text,x,y,...args);
            };
            try {
                const doc=new window.jspdf.jsPDF();
                await app.addSummaryPageAsImage(doc,{mimeType:'image/png',imageFormat:'PNG',imageCompression:'FAST'},state);
            }finally{CanvasRenderingContext2D.prototype.fillText=original;}
            return rows.filter(row=>/^S\d+:/.test(row.text));
        });
        assert.equal(summary.length,24);
        assert(summary.every(row=>row.y>0 && row.bottom<=row.height),'절단 방식 표시로 기존 24종 요약을 잘라내지 않음');
        const legacy=JSON.parse(fs.readFileSync(saved));delete legacy.settings.cutDirection;
        const legacyPath=path.join(out,'legacy-project.json');fs.writeFileSync(legacyPath,JSON.stringify(legacy));
        await page.locator('#newBtn').click();
        await load(legacyPath);
        assert(await page.locator('#priorityHorizontal').isChecked(),'방향 없는 과거 프로젝트는 가로');
        assert.deepEqual(errors,[]);
        console.log('PASS mobile visibility, real limit failure preservation, save/reload/new/load/legacy, 24-kind PDF summary; JS errors=0');
    }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
