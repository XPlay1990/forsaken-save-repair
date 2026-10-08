import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './save-fixture.mjs';
import {unzipSync} from 'fflate';
import {repairSave,inspectSave} from '../dist/repair.mjs';
import {PROFILE} from '../dist/profiles.mjs';

test('checkpoint export repairs an additional Act One companion while preserving paths and unsupported content',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../dist/worker.mjs?identity-only-regression');
    const main='ForsakenKingdom/beforebaron.w3z';
    const original=fixture(PROFILE.maps[0],PROFILE.maps[0].old,7000,{records:[
      {offset:1048570,text:'Blizzard\\beforebaron'},
      {offset:1500000,text:'Blizzard\\beforebaron\\UndeadRE01_03.w3z'},
      {offset:1500100,text:'Blizzard\\beforebaron\\UndeadRE01_02.w3z'}]}).data;
    const companion=fixture(PROFILE.maps[2],PROFILE.maps[2].current,7003,{records:[
      {offset:1048570,text:'Blizzard\\Act One - Tirisfal Glades'}]}).data;
    const arcane=fixture({id:'undeadre01_05'},'11223344',7003).data,unknown=fixture({id:'undeadre99'},'11223344',7003).data;
    const files=[[main,original],['ForsakenKingdom/Blizzard/beforebaron/UndeadRE01_03.w3z',companion],['ForsakenKingdom/Blizzard/beforebaron/UndeadRE01_05.w3z',arcane],['ForsakenKingdom/Blizzard/beforebaron/UndeadRE99.w3z',unknown],['ForsakenKingdom/beforebaron_repaired.w3z',original]]
      .map(([path,data])=>{const file=new File([data],path.split('/').at(-1));Object.defineProperty(file,'webkitRelativePath',{value:path});return file;});
    await self.onmessage({data:{type:'listFolder',files}});
    await self.onmessage({data:{type:'checkpoint',path:main}});
    await self.onmessage({data:{type:'export'}});
    assert.equal(messages.at(-1).type,'exported',messages.at(-1).message);
    const output=unzipSync(new Uint8Array(await messages.at(-1).blob.arrayBuffer()));
    assert.deepEqual(Object.keys(output).sort(),['Blizzard/beforebaron/UndeadRE01_03.w3z','Blizzard/beforebaron/UndeadRE01_05.w3z','Blizzard/beforebaron/UndeadRE99.w3z','beforebaron.w3z','forsaken-repair-report.json'].sort());
    assert.deepEqual(output['beforebaron.w3z'],repairSave(original).data);
    assert.deepEqual(output['Blizzard/beforebaron/UndeadRE01_03.w3z'],companion);
    assert.deepEqual(output['Blizzard/beforebaron/UndeadRE01_05.w3z'],repairSave(arcane).data);
    assert.deepEqual(output['Blizzard/beforebaron/UndeadRE99.w3z'],unknown);
    const report=JSON.parse(new TextDecoder().decode(output['forsaken-repair-report.json']));
    assert.equal(report.reportVersion,1);assert.equal(report.reportKind,'repaired-bundle');assert.equal(report.saves.length,4);
    assert.equal(report.filenamesPreserved,true);assert.deepEqual(report.renamed,[]);
    assert.equal(messages.at(-1).filename,'beforebaron-bundle.zip');
    const root=report.saves.find(row=>row.file===main),unsupported=report.saves.find(row=>row.status==='unsupported');
    assert.equal(root.inputChecksum,PROFILE.maps[0].old);assert.equal(root.outputChecksum,PROFILE.maps[0].current);
    assert.equal(unsupported.mapPath,'Campaign\\ForsakenKingdom\\undeadre99.w3xd');assert.equal(unsupported.mapId,'undeadre99');
    assert.equal(unsupported.inputChecksum,'11223344');assert.equal(unsupported.outputChecksum,'11223344');assert.equal(unsupported.targetChecksum,null);
    assert.equal(unsupported.build,7003);assert.equal(unsupported.gameIdentifier,PROFILE.gameIdentifier);assert.equal(unsupported.gameVersion,PROFILE.gameVersion);
    assert.deepEqual(report.unchangedUnsupported,[unsupported]);
    assert.deepEqual(report.missingCompanions,{folders:[],files:['Blizzard/beforebaron/UndeadRE01_02.w3z']});
    assert.equal(unsupported.mapNameSource,'map-filename');
    const repairedArcane=report.saves.find(row=>row.mapId==='undeadre01_05');
    assert.equal(repairedArcane.outputChecksum,'e3d412fe');assert.equal(repairedArcane.sourceRevisionKnown,false);assert.equal(repairedArcane.mapGameTested,false);
    assert.deepEqual(Object.keys(unsupported).sort(),['file','outputFile','mapPath','mapId','mapName','mapNameSource','inputChecksum','outputChecksum','targetChecksum','sourceRevisionKnown','mapGameTested','build','gameIdentifier','gameVersion','status','reason','size','blocks'].sort(),'Report must contain inspection metadata only');
    assert.equal(root.outputFile,'beforebaron.w3z');
    const old=inspectSave(original),fixed=inspectSave(output['beforebaron.w3z']);
    assert.deepEqual(output['beforebaron.w3z'].subarray(fixed.firstEnd),original.subarray(old.firstEnd));
    assert.deepEqual(output['beforebaron.w3z'].subarray(40,64),original.subarray(40,64));
  }finally{delete globalThis.self;}
});

test('current checkpoints and legacy suffixed inputs preserve their exact input filenames',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../dist/worker.mjs?preserved-input-names');
    for(const [name,folder,checksum] of [['Checkpoint With Spaces.W3Z','Checkpoint With Spaces',PROFILE.maps[0].current],['save_repaired_2.w3z','save',PROFILE.maps[0].old]]){
      const main=fixture(PROFILE.maps[0],checksum).data,companion=fixture(PROFILE.maps[0],PROFILE.maps[0].current).data;
      const make=(path,data)=>{const file=new File([data],path.split('/').at(-1));Object.defineProperty(file,'webkitRelativePath',{value:path});return file;};
      const path=`ForsakenKingdom/${name}`,snapshot=`Blizzard/${folder}/UndeadRE01.w3z`;
      await self.onmessage({data:{type:'listFolder',files:[make(path,main),make(`ForsakenKingdom/${snapshot}`,companion)]}});
      await self.onmessage({data:{type:'checkpoint',path}});await self.onmessage({data:{type:'export'}});
      assert.equal(messages.at(-1).type,'exported',messages.at(-1).message);
      const zip=unzipSync(new Uint8Array(await messages.at(-1).blob.arrayBuffer()));
      assert.deepEqual(Object.keys(zip).sort(),[name,snapshot,'forsaken-repair-report.json'].sort());
      assert.deepEqual(zip[name],repairSave(main).data);assert.deepEqual(zip[snapshot],companion);
      const report=JSON.parse(new TextDecoder().decode(zip['forsaken-repair-report.json']));
      assert.deepEqual(report.renamed,[]);assert.equal(report.filenamesPreserved,true);
      assert.equal(report.saves.find(row=>row.file===path).outputFile,name);
    }
  }finally{delete globalThis.self;}
});

test('unsupported checkpoints can export metadata-only reports while missing companions and repair blocking remain visible',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../dist/worker.mjs?unsupported-report');
    const main='ForsakenKingdom/Unknown.w3z';const data=fixture({id:'undeadre99',old:'35f0eca7'},'35f0eca7',7003).data;
    const file=new File([data],'Act Two.w3z');Object.defineProperty(file,'webkitRelativePath',{value:main});
    await self.onmessage({data:{type:'listFolder',files:[file]}});
    await self.onmessage({data:{type:'report'}});assert.equal(messages.at(-1).type,'error');
    await self.onmessage({data:{type:'checkpoint',path:main}});
    await self.onmessage({data:{type:'export'}});assert.equal(messages.at(-1).type,'error');
    await self.onmessage({data:{type:'report'}});
    assert.equal(messages.at(-1).type,'reported');assert.equal(messages.at(-1).blob.type,'application/json');
    const report=JSON.parse(await messages.at(-1).blob.text());
    assert.equal(report.reportKind,'analysis');assert.deepEqual(report.changed,[]);assert.deepEqual(report.renamed,[]);
    assert.deepEqual(report.missingCompanions,{folders:['Unknown'],files:[]});
    assert.equal(report.saves[0].mapId,'undeadre99');assert.equal(report.saves[0].inputChecksum,'35f0eca7');
    assert.equal(report.saves[0].build,7003);assert.equal(report.saves[0].status,'unsupported');
    assert.equal(report.saves[0].outputFile,null);assert.equal(report.saves[0].outputChecksum,null);
    assert.equal(messages.some(message=>message.type==='exported'),false,'Report download must not permit unsupported conversion');
  }finally{delete globalThis.self;}
});

test('blocked revisions retain validated metadata for reports; corrupt containers never report guessed identity',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../dist/worker.mjs?blocked-report');
    const unknown=fixture(PROFILE.maps[0],'11223344',6999).data;
    const corrupt=unknown.slice();corrupt[60]^=1;
    for(const [data,checksum] of [[unknown,'11223344'],[corrupt,null]]){
      const file=new File([data],'save.w3z');Object.defineProperty(file,'webkitRelativePath',{value:'ForsakenKingdom/save.w3z'});
      await self.onmessage({data:{type:'listFolder',files:[file]}});
      await self.onmessage({data:{type:'checkpoint',path:file.webkitRelativePath}});
      await self.onmessage({data:{type:'export'}});assert.equal(messages.at(-1).type,'error');
      await self.onmessage({data:{type:'report'}});assert.equal(messages.at(-1).type,'reported');
      const report=JSON.parse(await messages.at(-1).blob.text()),row=report.saves[0];
      assert.equal(row.status,'blocked');assert.equal(row.inputChecksum,checksum);assert.equal(row.outputChecksum,null);
      assert.equal(row.mapPath,checksum?'Campaign\\ForsakenKingdom\\undeadre01.w3xd':null);
      assert.equal(row.build,checksum?6999:null);
    }
    assert.equal(messages.some(message=>message.type==='exported'),false);
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
