import test from 'node:test';
import assert from 'node:assert/strict';
import {indexFolder,checkpointBundle,resolveCheckpointBundle,companionReferenceScanner} from '../dist/checkpoint-bundle.mjs';
import {planBundleNames} from '../dist/bundle-names.mjs';
const fake=(path,size=20,lastModified=0)=>({name:path.split('/').at(-1),webkitRelativePath:path,size,lastModified,arrayBuffer(){throw Error('Indexing must not read file contents');}});

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
  assert.deepEqual(Array.from(scanner.folders),['original']);
  const bundle=checkpointBundle(indexFolder(files).entries,files[0].webkitRelativePath,scanner.folders);
  assert.deepEqual(bundle.entries.map(x=>x.path),files.slice(0,2).map(x=>x.webkitRelativePath));
  assert.equal(checkpointBundle(indexFolder(files).entries,files[0].webkitRelativePath,['original','ORIGINAL']).companionCount,1);
});
test('repaired filename uses its original folder without adding folders named in saved strings',()=>{
  const files=[fake('save_repaired_2.w3z'),fake('Blizzard/save/UndeadRE01.w3z')],index=indexFolder(files);
  assert.equal(checkpointBundle(index.entries,files[0].name).companionCount,1);
  const missing=checkpointBundle(index.entries,files[0].name,['missing']);
  assert.deepEqual(missing.missingFolders,[]);assert.equal(missing.companionCount,1);
});
test('selected bundle export respects filename collisions with unselected checkpoints',()=>{
  const source=[{path:'save.w3z'},{path:'Blizzard/save/UndeadRE01.w3z'}];
  const names=planBundleNames(source,[{path:'save.w3z',status:'repair'}],{reservedPaths:['SAVE_REPAIRED.W3Z','save_repaired_2.w3z']});
  assert.equal(names.paths.get('save.w3z'),'save_repaired_3.w3z');
  assert.equal(names.paths.get(source[1].path),source[1].path);
});
test('a matching checkpoint folder wins over saved paths naming another checkpoint',()=>{
  const index=indexFolder([fake('before_baron.w3z'),fake('Blizzard/before_baron/UndeadRE01.w3z'),fake('Blizzard/older/UndeadRE01_02.w3z')]);
  const bundle=checkpointBundle(index.entries,'before_baron.w3z',['older'],['Blizzard/older/missing.w3z']);
  assert.equal(bundle.companionFolder,'Blizzard/before_baron');assert.equal(bundle.companionCount,1);assert.deepEqual(bundle.missingFiles,[]);
  assert.deepEqual(bundle.entries.map(entry=>entry.path),['before_baron.w3z','Blizzard/before_baron/UndeadRE01.w3z']);
});
test('companion snapshot references never expand selection into other checkpoint folders',async()=>{
  const inventory=indexFolder([fake('save.w3z'),fake('Blizzard/save/UndeadRE01.w3z'),fake('Blizzard/older/UndeadRE01_02.w3z'),fake('unrelated.w3z',2*1024**3),fake('Blizzard/unrelated/UndeadRE01.w3z',2*1024**3)]).entries;
  const reads=[];
  const read=async entry=>{reads.push(entry.path);return {folders:new Set([entry.path.includes('/save/')?'older':'save']),files:new Set(entry.path.includes('/older/')?['Blizzard/save/UndeadRE01_03.w3z']:[])};};
  const result=await resolveCheckpointBundle(inventory,'save.w3z',read);
  assert.equal(result.companionCount,1);assert.deepEqual(reads,['save.w3z']);
  assert.deepEqual(result.entries.map(entry=>entry.path),['save.w3z','Blizzard/save/UndeadRE01.w3z']);
  assert.deepEqual(result.missingFiles,[]);
  await assert.rejects(resolveCheckpointBundle(inventory,'save.w3z',read,{maxBytes:30}),/companions exceed/);
});
