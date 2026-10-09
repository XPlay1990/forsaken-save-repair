import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {PROFILE,DOWNGRADE_PROFILE} from '../dist/profiles.mjs';
import {repairSave} from '../dist/repair.mjs';
import {nativeFixture} from './native-fixture.mjs';
import {fixture} from './save-fixture.mjs';
const make=(path,data)=>{const file=new File([data],path.split('/').at(-1));Object.defineProperty(file,'webkitRelativePath',{value:path});return file;};

test('downgrade worker reverses the checkpoint and stored FKManualSaves companions, retaining names and paths',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../dist/worker.mjs?downgrade-bundle');
    const profile=DOWNGRADE_PROFILE,map=profile.maps.find(row=>row.id==='undeadre02_06');
    const main='Scarlet (4).w3z',folder='FKManualSaves/Original (4)',snapshot=folder+'/UndeadRE02.w3z';
    const original=nativeFixture({map,checksum:map.old,current:true,companionPath:folder.replaceAll('/','\\')});
    const companionMap=profile.maps.find(row=>row.id==='undeadre02');
    const companion=nativeFixture({map:companionMap,checksum:companionMap.old,current:true});
    const files=[make('ForsakenKingdom/'+main,original),make('ForsakenKingdom/'+snapshot,companion),make('ForsakenKingdom/Unrelated.w3z',original)];
    await self.onmessage({data:{type:'listFolder',profileId:profile.id,files}});
    await self.onmessage({data:{type:'checkpoint',path:'ForsakenKingdom/'+main}});
    assert.equal(messages.at(-1).type,'analyzed');
    assert.equal(messages.at(-1).summary.blocked,0);
    assert.equal(messages.at(-1).rows.length,2);
    await self.onmessage({data:{type:'export'}});
    assert.equal(messages.at(-1).type,'exported',messages.at(-1).message);
    const zip=unzipSync(new Uint8Array(await messages.at(-1).blob.arrayBuffer()));
    assert.deepEqual(Object.keys(zip).sort(),[main,snapshot,'forsaken-repair-report.json'].sort());
    assert.deepEqual(zip[main],repairSave(original,{profile}).data);
    assert.deepEqual(zip[snapshot],repairSave(companion,{profile}).data);
    const report=JSON.parse(new TextDecoder().decode(zip['forsaken-repair-report.json']));
    assert.equal(report.profile,profile.id);assert.equal(report.target,`${profile.to}.${profile.build}`);
    assert.equal(report.filenamesPreserved,true);assert.equal(report.folderPathsPreserved,true);
    assert.equal(report.changed.length,2);assert.ok(report.changed.every(row=>row.projectileRepairs===1));
    assert.ok(report.saves.every(row=>row.outputChecksum===profile.maps.find(map=>map.id===row.mapId).current));
  }finally{delete globalThis.self;}
});

test('native 3.0.1 companions and unverified revisions block downgrade exports but retain diagnostic reports',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../dist/worker.mjs?downgrade-blocked');
    const profile=DOWNGRADE_PROFILE,map=profile.maps.find(row=>row.id==='undeadre02_06');
    for(const [build,checksum,reason] of [[7003,map.old,/re-saved by Warcraft III 3.0.1/],[7000,'11223344',/unverified source map revision/]]){
      const main=fixture(map,map.old,7000,{records:[{offset:2048,text:'FKManualSaves\\Slot'}]}).data;
      const files=[make('ForsakenKingdom/Slot.w3z',main),make('ForsakenKingdom/FKManualSaves/Slot/UndeadRE02_06.w3z',fixture(map,checksum,build).data)];
      await self.onmessage({data:{type:'listFolder',profileId:profile.id,files}});
      await self.onmessage({data:{type:'checkpoint',path:'ForsakenKingdom/Slot.w3z'}});
      assert.equal(messages.at(-1).summary.blocked,1);
      await self.onmessage({data:{type:'export'}});assert.equal(messages.at(-1).type,'error');
      await self.onmessage({data:{type:'report'}});
      const report=JSON.parse(await messages.at(-1).blob.text());
      const row=report.saves.find(row=>row.status==='blocked');
      assert.equal(report.profile,profile.id);assert.equal(row.build,build);assert.equal(row.inputChecksum,checksum);
      assert.match(row.reason,reason);assert.equal(row.outputChecksum,null);
    }
    assert.equal(messages.some(row=>row.type==='exported'),false);
  }finally{delete globalThis.self;}
});

test('changing target resets worker analysis and selects the new checksum profile',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../dist/worker.mjs?change-target');
    const map=PROFILE.maps.find(row=>row.id==='undeadre02_06'),file=make('ForsakenKingdom/Slot.w3z',fixture(map,map.current).data);
    for(const profile of [DOWNGRADE_PROFILE,PROFILE,DOWNGRADE_PROFILE]){
      await self.onmessage({data:{type:'listFolder',profileId:profile.id,files:[file]}});
      await self.onmessage({data:{type:'report'}});assert.equal(messages.at(-1).type,'error','Stale results must be cleared');
      await self.onmessage({data:{type:'checkpoint',path:file.webkitRelativePath}});
      await self.onmessage({data:{type:'report'}});
      const report=JSON.parse(await messages.at(-1).blob.text());
      assert.equal(report.profile,profile.id);
      assert.equal(report.saves[0].targetChecksum,profile.maps.find(row=>row.id===map.id).current);
    }
  }finally{delete globalThis.self;}
});
