import test from 'node:test';
import assert from 'node:assert/strict';
import {planBundleNames} from '../dist/bundle-names.mjs';
const entries=paths=>paths.map(path=>({path}));
const row=(path,status='repair')=>({path,status});

test('main save and its complete companion directory receive the same repaired name',()=>{
  const main='ForsakenKingdom/after_baron.w3z',folder='ForsakenKingdom/blizzard/After_Baron';
  const source=entries([main,folder+'/UndeadRE01.w3z',folder+'/UndeadRE01_05.w3z',folder+'/extra/cache.bin','ForsakenKingdom/Blizzard/Zones/UndeadRE01.w3z','ForsakenKingdom/Campaigns.w3v','ForsakenKingdom/Act Two.w3z']);
  const {paths,renamed,migration}=planBundleNames(source,[row(main),row(source[1].path),row(source[2].path,'unsupported'),row(source[4].path),row(source[6].path,'unsupported')],{checkpointPath:main,companionFolder:folder});
  assert.equal(paths.get(main),'ForsakenKingdom/after_baron_repaired.w3z');assert.equal(migration.targetName,'after_baron_repaired');
  for(const entry of source.slice(1,4))assert.equal(paths.get(entry.path),entry.path.replace('After_Baron/','after_baron_repaired/'));
  for(const entry of source.slice(4))assert.equal(paths.get(entry.path),entry.path);
  assert.equal(renamed.length,4);
});
test('collisions with either a main filename or an orphan companion directory use one shared numbered name',()=>{
  const source=entries(['save.w3z','save_repaired.W3Z','Blizzard/save/map.w3z','Blizzard/SAVE_REPAIRED_2/map.w3z']);
  const {paths}=planBundleNames(source,[row('save.w3z'),row('save_repaired.W3Z','current')],{checkpointPath:'save.w3z',companionFolder:'Blizzard/save'});
  assert.equal(paths.get('save.w3z'),'save_repaired_3.w3z');assert.equal(paths.get('Blizzard/save/map.w3z'),'Blizzard/save_repaired_3/map.w3z');assert.equal(paths.get('save_repaired.W3Z'),'save_repaired.W3Z');
});
test('already paired repaired bundles retain names; older repaired saves with original folders receive a new pair',()=>{
  const source=entries(['save.w3z','Blizzard/save/map.w3z']);
  const first=planBundleNames(source,[row('save.w3z','current')]);
  const output=entries(Array.from(first.paths.values()));const second=planBundleNames(output,[row('save_repaired.w3z','current')]);
  assert.equal(first.renamed.length,2);assert.deepEqual(second.renamed,[]);
  const legacy=planBundleNames(entries(['save_repaired.w3z','Blizzard/save/map.w3z']),[row('save_repaired.w3z','current')]);
  assert.equal(legacy.paths.get('save_repaired.w3z'),'save_repaired_2.w3z');assert.equal(legacy.paths.get('Blizzard/save/map.w3z'),'Blizzard/save_repaired_2/map.w3z');
});
test('standalone snapshots, CustomSaves and shared working Zones are never renamed as companion directories',()=>{
  const source=entries(['Zones.w3z','Blizzard/Zones/map.w3z','CustomSaves/WorldEditTestMap/map.w3z','Blizzard/checkpoint/map.w3z','checkpoint/UndeadRE01_03.w3z']);
  const {paths}=planBundleNames(source,source.map(entry=>({...row(entry.path),mapId:'undeadre01_03'})));
  assert.equal(paths.get('Zones.w3z'),'Zones_repaired.w3z');for(const entry of source.slice(1))assert.equal(paths.get(entry.path),entry.path);
});
