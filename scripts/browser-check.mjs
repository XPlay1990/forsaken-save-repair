/** Local-only full browser check. Private save fixtures are never part of dist. */
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {inspectSave} from '../dist/repair.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'.local-tests');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1080}});
const page=await context.newPage();const requests=[],errors=[];
page.on('request',req=>requests.push({url:req.url(),method:req.method()}));
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.goto('http://127.0.0.1:4173/');
  assert.equal(await page.locator('#roadmap, .map-panel, .map-ledger, #zip-input, #zip-button, .zip-option').count(),0);
  assert.equal(await page.locator('#bundle-location').isVisible(),true);
  assert.match(await page.locator('#bundle-location').textContent(),/Documents\\Warcraft III\\BattleNet\\<account-number>\\Campaigns\\ForsakenKingdom/);
  assert.match(await page.locator('#bundle-location').textContent(),/OneDrive/);
  const locationBox=await page.locator('#bundle-location').boundingBox(),uploadBox=await page.locator('#folder-button').boundingBox();
  assert.ok(locationBox.y+locationBox.height<uploadBox.y,'Folder location must appear above upload controls');
  assert.equal(await page.locator('#instructions-title').isVisible(),true);
  const todo=await readFile(path.join(root,'todo.md'),'utf8');assert.match(todo,/Arcane Sanctuary/);assert.match(todo,/Act Two/);assert.match(todo,/Act Three/);
  await assert.rejects(readFile(path.join(root,'dist','todo.md')),{code:'ENOENT'});
  await assert.rejects(readFile(path.join(root,'dist','roadmap.mjs')),{code:'ENOENT'});
  await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile page overflows');
  await page.setViewportSize({width:320,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Small mobile page overflows');
  await page.setViewportSize({width:1440,height:1080});
  const campaign=process.env.FORSAKEN_CAMPAIGN_ROOT;
  if(campaign){
    await page.locator('#folder-input').evaluate(input=>input.addEventListener('change',()=>{window.testFolderMetadata={bytes:Array.from(input.files).reduce((sum,file)=>sum+file.size,0),files:input.files.length};},{capture:true,once:true}));
    await page.locator('#folder-input').setInputFiles(campaign);
    await page.locator('#save-picker').waitFor({state:'visible',timeout:30000});
    assert.equal(await page.locator('#error').isVisible(),false);
    const metadata=await page.evaluate(()=>window.testFolderMetadata);
    assert.ok(metadata.files>10,'Campaign regression requires multiple checkpoints');
    await page.locator('#save-search').fill('no_such_checkpoint');assert.equal(await page.locator('#no-search-results').isVisible(),true);
    await page.locator('#save-search').fill('after_baron');
    const chosen=page.locator('.checkpoint-choice').filter({has:page.locator('span',{hasText:/^after_baron$/})});
    const selectedPath=await chosen.getAttribute('data-path');
    await page.screenshot({path:path.join(output,'save-picker.png'),fullPage:true});
    await chosen.click();await page.locator('#results').waitFor({state:'visible',timeout:120000});
    assert.equal(await page.locator('#error').isVisible(),false,await page.locator('#error').textContent());
    assert.match(await page.locator('#stats').textContent(),/1 checkpoint \+ [1-9]/);
    assert.equal(await page.locator('#missing-note').isVisible(),false);
    await page.setViewportSize({width:320,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Checkpoint results overflow at 320 px');await page.setViewportSize({width:1440,height:1080});
    await context.setOffline(true);
    const checkpointDownload=page.waitForEvent('download');await page.locator('#export').click();
    const downloaded=await checkpointDownload;const destination=path.join(output,'checkpoint-download.zip');await downloaded.saveAs(destination);
    assert.match(downloaded.suggestedFilename(),/^after_baron_repaired_\d+-bundle.zip$/,'Output must avoid the existing repaired save');
    const converted=unzipSync(new Uint8Array(await readFile(destination)));
    const report=JSON.parse(new TextDecoder().decode(converted['forsaken-repair-report.json']));
    assert.equal(report.checkpoint.path,selectedPath);assert.equal(report.checkpoint.companionCount,3);
    const mainOutput=report.renamed.find(item=>item.from===selectedPath).to;
    assert.equal(inspectSave(converted[mainOutput]).status,'current');
    const sourceMain=new Uint8Array(await readFile(path.join(campaign,'after_baron.w3z'))),sourceInfo=inspectSave(sourceMain),outInfo=inspectSave(converted[mainOutput]);
    assert.deepEqual(converted[mainOutput].subarray(outInfo.firstEnd),sourceMain.subarray(sourceInfo.firstEnd),'Saved reference strings and other compressed blocks changed');
    assert.equal(mainOutput.includes('/'),false,'Checkpoint ZIP should contain campaign contents directly');
    const snapshots=Object.keys(converted).filter(name=>name.endsWith('.w3z')&&name!==mainOutput);
    assert.equal(snapshots.length,report.checkpoint.companionCount);
    for(const name of snapshots)assert.ok(name.startsWith('Blizzard/after_baron/'),'Another checkpoint folder leaked into export');
    assert.equal(Object.keys(converted).some(name=>/\/Zones\/|Campaigns\.w3v|ForsakenKingdom\.w3p/i.test(name)),false);
    await context.setOffline(false);await page.locator('#another-save').click();await page.locator('#save-picker').waitFor({state:'visible'});
    await page.locator('#save-search').fill('beforebaron');
    const before=page.locator('.checkpoint-choice').filter({has:page.locator('span',{hasText:/^beforebaron$/})});
    if(await before.count()){
      await before.click();await page.locator('#results').waitFor({state:'visible',timeout:120000});
      assert.equal(await page.locator('#error').isVisible(),false,await page.locator('#error').textContent());
      assert.match(await page.locator('#stats').textContent(),/1 checkpoint \+ 3 companion saves/);
      const rows=await page.locator('#file-list .file-path').allTextContents();
      assert.equal(rows.length,4);assert.ok(rows.every(name=>name.endsWith('/beforebaron.w3z')||name.includes('/Blizzard/beforebaron/')));
      await page.locator('#another-save').click();
    }
    await page.locator('#save-search').fill('Act Two - Undercity');
    const unsupported=page.locator('.checkpoint-choice').filter({has:page.locator('span',{hasText:/^Act Two - Undercity$/})});
    if(await unsupported.count()){
      await unsupported.click();await page.locator('#error').waitFor({state:'visible',timeout:120000});
      assert.match(await page.locator('#error').textContent(),/not supported/);assert.equal(await page.locator('#export').isEnabled(),false);
    }
    console.log(`Checkpoint flow passed for a ${(metadata.bytes/1024**3).toFixed(2)} GB collection: selected save and its ${snapshots.length} same-folder companions only; after_baron and beforebaron scopes checked; existing names, search, unsupported-save blocking and offline download passed.`);
  }
  assert.equal(requests.every(req=>new URL(req.url).hostname==='127.0.0.1'&&req.method==='GET'),true,'Unexpected external or upload request');
  assert.deepEqual(errors,[],'Browser errors');
  console.log('Desktop/mobile layout checked. All observed requests were GETs for this local site; no save upload requests.');
}finally{await browser.close();}
