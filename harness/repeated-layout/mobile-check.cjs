'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const version of ['v4','v10']) {
   const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:8766/woodcutter_${version}/`,{waitUntil:'networkidle'});
   await page.locator('#considerGrain').check();
   for(const length of [450,350]) {
    await page.locator('#partWidth').fill('260');
    await page.locator('#partHeight').fill(String(length));
    await page.locator('#partQty').fill('8');
    await page.locator('#addPartBtn').click();
   }
   await page.locator('#calculateBtn').click();
   const before=await page.evaluate(()=>JSON.stringify({result:appState.result,cost:appState.costInfo}));
   await page.locator('#compareLayoutBtn').click();
   assert.equal(await page.locator('#repeatedLayoutCandidate canvas').count(),1);
   assert.equal(await page.locator('#repeatedLayoutDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1),true);
   const out=path.resolve(__dirname,`../../output/playwright/rollout-${version}`);
   await page.locator('#repeatedLayoutDialog').screenshot({path:path.join(out,'mobile-start.png')});
   await page.locator('#repeatedLayoutEnabled').uncheck();
   assert.equal(await page.locator('#repeatedLayoutCandidate canvas').count(),0);
   await page.locator('#repeatedLayoutEnabled').check();
   const pending=page.waitForEvent('download');
   await page.locator('#downloadComparisonPdf').click();
   const download=await pending;await download.saveAs(path.join(out,'mobile-start.pdf'));
   assert.equal(await download.failure(),null);
   assert.equal(await page.evaluate(()=>JSON.stringify({result:appState.result,cost:appState.costInfo})),before);
   await page.locator('#closeRepeatedLayout').click();
   await page.locator('.mobile-nav-tab[data-panel="left"]').click();
   await page.locator('#boardWidth').fill('1200');
   assert.equal(await page.locator('#compareLayoutBtn').isDisabled(),true);
   assert.deepEqual(errors,[]);
   fs.writeFileSync(path.join(out,'mobile-results.json'),JSON.stringify({version,viewport:{width:390,height:844},entry:'PASS',pdf:'PASS',unchanged:true,errors},null,2));
   console.log(version,'mobile initial-entry, comparison, PDF, state preservation: PASS');
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
