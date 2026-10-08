import test from 'node:test';
import assert from 'node:assert/strict';
import {indexFolder,checkpointBundle,resolveCheckpointBundle,companionReferenceScanner} from '../dist/checkpoint-bundle.mjs';
const fake=(path,size=20,lastModified=0)=>({name:path.split('/').at(-1),webkitRelativePath:path,size,lastModified,arrayBuffer(){throw Error('Indexing must not read file contents');}});
const record=text=>{const bytes=new TextEncoder().encode(text),result=new Uint8Array(12+bytes.length),view=new DataView(result.buffer);view.setUint32(0,4,true);view.setBigUint64(4,BigInt(bytes.length),true);result.set(bytes,12);return result;};

test('the typed FKManualSaves path selects the actual numbered folder despite a misleading filename match',()=>{
  const path='ForsakenKingdom/renamed (4).w3z',saved='FKManualSaves/Original (3)';
  const files=[fake(path),fake('ForsakenKingdom/'+saved+'/UndeadRE02.w3z'),fake('ForsakenKingdom/Blizzard/renamed (4)/UndeadRE01.w3z'),fake('ForsakenKingdom/FKManualSaves/Other/UndeadRE02.w3z')];
  const scanner=companionReferenceScanner(),bytes=record(saved.replaceAll('/','\\'));
  // Splitting within the u64 wrapper and within the folder name must both work.
  scanner.scan(bytes.subarray(0,8));scanner.scan(bytes.subarray(8,25));scanner.scan(bytes.subarray(25));
  assert.deepEqual(Array.from(scanner.folders),[saved]);
  const bundle=checkpointBundle(indexFolder(files).entries,path,scanner.folders,scanner.files);
  assert.equal(bundle.companionFolder,'ForsakenKingdom/'+saved);
  assert.deepEqual(bundle.entries.map(entry=>entry.path),files.slice(0,2).map(file=>file.webkitRelativePath));
  assert.deepEqual(indexFolder(files).checkpoints.map(save=>save.path),[path]);
});
test('a manual directory string does not invent missing snapshots, while an explicit missing file is reported',()=>{
  const scanner=companionReferenceScanner();scanner.scan(record('FKManualSaves\\Scarlet (4)'));
  const inventory=indexFolder([fake('scarlet.w3z')]).entries;
  assert.deepEqual(checkpointBundle(inventory,'scarlet.w3z',scanner.folders,scanner.files).missingFolders,[]);
  scanner.scan(record('FKManualSaves\\Scarlet (4)\\UndeadRE02_06.w3z'));
  const bundle=checkpointBundle(inventory,'scarlet.w3z',scanner.folders,scanner.files);
  assert.deepEqual(bundle.missingFolders,['FKManualSaves/Scarlet (4)']);
  assert.deepEqual(bundle.missingFiles,['FKManualSaves/Scarlet (4)/UndeadRE02_06.w3z']);
});
test('UTF-8 saved file paths support another relative root and reject traversal, absolute paths and working Zones',()=>{
  const scanner=companionReferenceScanner();
  for(const text of ['Snapshots\\Chäpter (3)\\map.w3z','FKManualSaves\\..\\map.w3z','C:\\FKManualSaves\\Save\\map.w3z','FKManualSaves\\Zones\\map.w3z'])scanner.scan(record(text));
  assert.deepEqual(Array.from(scanner.files),['Snapshots/Chäpter (3)/map.w3z']);
  assert.deepEqual(Array.from(scanner.folders),['Snapshots/Chäpter (3)']);
});
test('multiple stored checkpoint paths stop rather than pulling unrelated saves into a bundle',()=>{
  assert.throws(()=>checkpointBundle(indexFolder([fake('save.w3z')]).entries,'save.w3z',['Blizzard/One','FKManualSaves/Two']),/multiple companion directories/);
});

test('numbered standalone checkpoints do not invent missing companions from unrelated Act One folders',()=>{
  for(const number of [1,3,4]){
    const main=`ForsakenKingdom/Act Two - The Scarlet Monastery (${number}).w3z`;
    const index=indexFolder([fake(main),fake('ForsakenKingdom/Blizzard/Act One - Undercity/UndeadRE01.w3z'),fake('ForsakenKingdom/Blizzard/Zones/UndeadRE01.w3z')]);
    const bundle=checkpointBundle(index.entries,main);
    assert.deepEqual(bundle.entries.map(entry=>entry.path),[main]);
    assert.equal(bundle.companionCount,0);
    assert.deepEqual(bundle.missingFolders,[]);
    assert.deepEqual(bundle.missingFiles,[]);
  }
});

test('a missing referenced companion folder reports its saved name and files without guessing from numbered filenames',()=>{
  const main='ForsakenKingdom/Act Two - The Scarlet Monastery (4).w3z';
  const reference='Blizzard/Original checkpoint/UndeadRE02.w3z';
  const bundle=checkpointBundle(indexFolder([fake(main)]).entries,main,['Blizzard/Original checkpoint','Blizzard/ORIGINAL CHECKPOINT'],[reference]);
  assert.deepEqual(bundle.missingFolders.map(name=>name.toLowerCase()),['blizzard/original checkpoint']);
  assert.deepEqual(bundle.missingFiles,[reference]);
  assert.deepEqual(bundle.entries.map(entry=>entry.path),[main]);
});

test('listing a multi-gigabyte collection reads metadata only; bundles contain one checkpoint and its own companions',()=>{
  const files=[fake('ForsakenKingdom/a.w3z',50,2),fake('ForsakenKingdom/b.w3z',2*1024**3,1),fake('ForsakenKingdom/Blizzard/a/UndeadRE01.w3z',30),fake('ForsakenKingdom/Blizzard/a/notes.txt',5),fake('ForsakenKingdom/Blizzard/b/UndeadRE01.w3z',2*1024**3),fake('ForsakenKingdom/Blizzard/Zones/UndeadRE01.w3z',20),fake('ForsakenKingdom/Campaigns.w3v',10),fake('ForsakenKingdom/CustomSaves/WorldEditTestMap/map.w3z')];
  const index=indexFolder(files);assert.deepEqual(index.checkpoints.map(x=>x.name),['a','b']);
  const bundle=checkpointBundle(index.entries,'ForsakenKingdom/a.w3z');
  assert.deepEqual(bundle.entries.map(x=>x.path),[files[0],files[2],files[3]].map(x=>x.webkitRelativePath));
  assert.equal(bundle.entries.reduce((sum,x)=>sum+x.blob.size,0),85);assert.equal(bundle.companionCount,1);
});
test('main-save references find a renamed checkpoint folder when there is no filename match',()=>{
  const files=[fake('ForsakenKingdom/renamed.w3z'),fake('ForsakenKingdom/Blizzard/original/UndeadRE01_03.w3z'),fake('ForsakenKingdom/Blizzard/unrelated/UndeadRE01.w3z'),fake('ForsakenKingdom/Blizzard/Zones/UndeadRE01.w3z')];
  const scanner=companionReferenceScanner();scanner.scan(new TextEncoder().encode('\0Blizzard\\ori'));scanner.scan(new TextEncoder().encode('ginal\\UndeadRE01_03.w3z\0Blizzard\\Zones\\UndeadRE01.w3z\0'));
  assert.deepEqual(Array.from(scanner.folders),['Blizzard/original']);
  const bundle=checkpointBundle(indexFolder(files).entries,files[0].webkitRelativePath,scanner.folders);
  assert.deepEqual(bundle.entries.map(x=>x.path),files.slice(0,2).map(x=>x.webkitRelativePath));
  assert.equal(checkpointBundle(indexFolder(files).entries,files[0].webkitRelativePath,['Blizzard/original','Blizzard/ORIGINAL']).companionCount,1);
});
test('a stored missing directory takes precedence over a filename fallback',()=>{
  const files=[fake('save_repaired_2.w3z'),fake('Blizzard/save/UndeadRE01.w3z')],index=indexFolder(files);
  assert.equal(checkpointBundle(index.entries,files[0].name).companionCount,1);
  const missing=checkpointBundle(index.entries,files[0].name,['Blizzard/missing']);
  assert.deepEqual(missing.missingFolders,[]);assert.equal(missing.companionCount,0);
});
test('the saved companion path wins over a conflicting filename match',()=>{
  const index=indexFolder([fake('before_baron.w3z'),fake('Blizzard/before_baron/UndeadRE01.w3z'),fake('Blizzard/older/UndeadRE01_02.w3z')]);
  const bundle=checkpointBundle(index.entries,'before_baron.w3z',['Blizzard/older'],['Blizzard/older/missing.w3z']);
  assert.equal(bundle.companionFolder,'Blizzard/older');assert.equal(bundle.companionCount,1);assert.deepEqual(bundle.missingFiles,['Blizzard/older/missing.w3z']);
  assert.deepEqual(bundle.entries.map(entry=>entry.path),['before_baron.w3z','Blizzard/older/UndeadRE01_02.w3z']);
});
test('companion snapshot references never expand selection into other checkpoint folders',async()=>{
  const inventory=indexFolder([fake('save.w3z'),fake('Blizzard/save/UndeadRE01.w3z'),fake('Blizzard/older/UndeadRE01_02.w3z'),fake('unrelated.w3z',2*1024**3),fake('Blizzard/unrelated/UndeadRE01.w3z',2*1024**3)]).entries;
  const reads=[];
  const read=async entry=>{reads.push(entry.path);return {folders:new Set([entry.path.includes('/save/')?'Blizzard/older':'Blizzard/save']),files:new Set(entry.path.includes('/older/')?['Blizzard/save/UndeadRE01_03.w3z']:[])};};
  const result=await resolveCheckpointBundle(inventory,'save.w3z',read);
  assert.equal(result.companionCount,1);assert.deepEqual(reads,['save.w3z']);
  assert.deepEqual(result.entries.map(entry=>entry.path),['save.w3z','Blizzard/save/UndeadRE01.w3z']);
  assert.deepEqual(result.missingFiles,[]);
  await assert.rejects(resolveCheckpointBundle(inventory,'save.w3z',read,{maxBytes:30}),/companions exceed/);
});
