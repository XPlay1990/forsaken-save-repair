import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './save-fixture.mjs';
import {unzipSync} from 'fflate';
import {repairSave,inspectSave} from '../dist/repair.mjs';
import {PROFILE} from '../dist/profiles.mjs';

test('checkpoint export retains original companion paths and changes only the verified map identity',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../dist/worker.mjs?identity-only-regression');
    const main='ForsakenKingdom/beforebaron.w3z';
    const original=fixture(PROFILE.maps[0],PROFILE.maps[0].old,7000,{records:[
      {offset:1048570,text:'Blizzard\\beforebaron'},
      {offset:1500000,text:'Blizzard\\beforebaron\\UndeadRE01_03.w3z'}]}).data;
    const companion=fixture(PROFILE.maps[2],PROFILE.maps[2].current,7003,{records:[
      {offset:1048570,text:'Blizzard\\Act One - Tirisfal Glades'}]}).data;
    const files=[[main,original],['ForsakenKingdom/Blizzard/beforebaron/UndeadRE01_03.w3z',companion],['ForsakenKingdom/beforebaron_repaired.w3z',original]]
      .map(([path,data])=>{const file=new File([data],path.split('/').at(-1));Object.defineProperty(file,'webkitRelativePath',{value:path});return file;});
    await self.onmessage({data:{type:'listFolder',files}});
    await self.onmessage({data:{type:'checkpoint',path:main}});
    await self.onmessage({data:{type:'export'}});
    assert.equal(messages.at(-1).type,'exported',messages.at(-1).message);
    const output=unzipSync(new Uint8Array(await messages.at(-1).blob.arrayBuffer()));
    assert.deepEqual(Object.keys(output).sort(),['Blizzard/beforebaron/UndeadRE01_03.w3z','beforebaron_repaired_2.w3z','forsaken-repair-report.json'].sort());
    assert.deepEqual(output['beforebaron_repaired_2.w3z'],repairSave(original).data);
    assert.deepEqual(output['Blizzard/beforebaron/UndeadRE01_03.w3z'],companion);
    const old=inspectSave(original),fixed=inspectSave(output['beforebaron_repaired_2.w3z']);
    assert.deepEqual(output['beforebaron_repaired_2.w3z'].subarray(fixed.firstEnd),original.subarray(old.firstEnd));
    assert.deepEqual(output['beforebaron_repaired_2.w3z'].subarray(40,64),original.subarray(40,64));
  }finally{delete globalThis.self;}
});

test('worker lists a collection larger than 1 GB without reading any save and applies the size limit only after selection',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  await import('../dist/worker.mjs');
  let reads=0;
  const fake=(path,size)=>({name:path.split('/').at(-1),webkitRelativePath:path,size,arrayBuffer(){reads++;throw Error('Unselected bytes must not be read');}});
  const files=[fake('ForsakenKingdom/small.w3z',10),fake('ForsakenKingdom/large.w3z',2*1024**3),fake('ForsakenKingdom/Blizzard/large/UndeadRE01.w3z',2*1024**3)];
  await self.onmessage({data:{type:'listFolder',files}});
  assert.equal(reads,0);assert.equal(messages.some(message=>message.type==='error'),false);
  assert.equal(messages.at(-1).type,'checkpoints');assert.equal(messages.at(-1).checkpoints.length,2);
  await self.onmessage({data:{type:'checkpoint',path:files[1].webkitRelativePath}});
  assert.equal(reads,0);assert.equal(messages.at(-1).type,'error');assert.match(messages.at(-1).message,/individual save exceeds/);
  await self.onmessage({data:{type:'analyze',files:[fake('campaign.zip',10)]}});
  assert.equal(reads,0);assert.equal(messages.at(-1).type,'error');assert.match(messages.at(-1).message,/Unknown operation/);
  const data=fixture().data;
  const unrecognizedPath=path=>({name:path.split('/').at(-1),webkitRelativePath:path,size:data.length,arrayBuffer:async()=>data.buffer});
  await self.onmessage({data:{type:'listFolder',files:[unrecognizedPath('ForsakenKingdom/save.w3z'),unrecognizedPath('ForsakenKingdom/Blizzard/save/UndeadRE01.w3z')]}});
  await self.onmessage({data:{type:'checkpoint',path:'ForsakenKingdom/save.w3z'}});
  await self.onmessage({data:{type:'export'}});
  assert.equal(messages.at(-1).type,'exported','Checksum-only repair does not need to reinterpret saved folder records');
  delete globalThis.self;
});
