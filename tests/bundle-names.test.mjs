import test from 'node:test';
import assert from 'node:assert/strict';
import {planBundleNames} from '../dist/bundle-names.mjs';
const entries=paths=>paths.map(path=>({path}));
const row=(path,status='repair')=>({path,status});

test('main checkpoint receives suffix while every internally referenced companion path stays fixed',()=>{
  const main='ForsakenKingdom/after_baron.w3z';
  const source=entries([main,'ForsakenKingdom/blizzard/After_Baron/UndeadRE01.w3z','ForsakenKingdom/blizzard/After_Baron/UndeadRE01_05.w3z','ForsakenKingdom/blizzard/After_Baron/extra/cache.bin','ForsakenKingdom/Blizzard/Zones/UndeadRE01.w3z','ForsakenKingdom/Campaigns.w3v','ForsakenKingdom/Act Two.w3z']);
  const {paths,renamed}=planBundleNames(source,[row(main),row(source[1].path),row(source[2].path,'unsupported'),row(source[4].path),row(source[6].path,'unsupported')]);
  assert.equal(paths.get(main),'ForsakenKingdom/after_baron_repaired.w3z');
  for(const entry of source.slice(1))assert.equal(paths.get(entry.path),entry.path);
  assert.equal(renamed.length,1);
});
test('case-insensitive collisions with existing save names get a numbered suffix',()=>{
  const source=entries(['save.w3z','save_repaired.W3Z','Blizzard/save/map.w3z','Blizzard/SAVE_REPAIRED_2/map.w3z']);
  const {paths}=planBundleNames(source,[row('save.w3z'),row('save_repaired.W3Z','current')]);
  assert.equal(paths.get('save.w3z'),'save_repaired_2.w3z');
  assert.equal(paths.get('Blizzard/save/map.w3z'),'Blizzard/save/map.w3z');
  assert.equal(paths.get('save_repaired.W3Z'),'save_repaired.W3Z');
});
test('already renamed bundles are idempotent and current checkpoints also receive the suffix',()=>{
  const source=entries(['save.w3z','Blizzard/save/map.w3z']);
  const first=planBundleNames(source,[row('save.w3z','current')]);
  const output=entries(Array.from(first.paths.values()));
  const second=planBundleNames(output,[row('save_repaired.w3z','current')]);
  assert.equal(first.renamed.length,1);assert.deepEqual(second.renamed,[]);
});
test('standalone snapshots, CustomSaves and shared Zones keep their paths',()=>{
  const source=entries(['Zones.w3z','Blizzard/Zones/map.w3z','CustomSaves/WorldEditTestMap/map.w3z','Blizzard/checkpoint/map.w3z','checkpoint/UndeadRE01_03.w3z']);
  const {paths}=planBundleNames(source,source.map(entry=>({...row(entry.path),mapId:'undeadre01_03'})));
  assert.equal(paths.get('Zones.w3z'),'Zones_repaired.w3z');
  for(const entry of source.slice(1))assert.equal(paths.get(entry.path),entry.path);
});
