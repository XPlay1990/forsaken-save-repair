import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_CATALOG,knownMap} from '../dist/map-catalog.mjs';
import {PROFILE,mapProfile} from '../dist/profiles.mjs';
import {inspectSave,repairSave} from '../dist/repair.mjs';
import {fixture} from './save-fixture.mjs';

test('campaign name lookup uses the complete path with case and separator normalization',()=>{
  assert.equal(knownMap('Campaign\\ForsakenKingdom\\UndeadRE01_06.w3xd').name,'Cathedral');
  assert.equal(knownMap('campaign/forsakenkingdom/HumanRE01.w3xd').name,'Homecoming');
  assert.equal(knownMap('Campaign/Other/UndeadRE01_06.w3xd'),undefined);
  assert.equal(knownMap('Campaign/ForsakenKingdom/not-installed.w3xd'),undefined);
  assert.equal(MAP_CATALOG.length,20);assert.equal(new Set(MAP_CATALOG.map(map=>map.id)).size,20);
  assert.equal(MAP_CATALOG.filter(map=>map.campaign==='Forsaken Kingdom').length,15);
  assert.equal(MAP_CATALOG.filter(map=>map.section==='Prologue').length,5);
});

test('known names label every unsupported installed map without enabling a repair',()=>{
  assert.deepEqual(PROFILE.maps.map(map=>map.id),['undeadre01','undeadre01_02','undeadre01_03']);
  for(const map of MAP_CATALOG){
    const supported=mapProfile(map.mapPath);if(supported)continue;
    const source=fixture(map,'11223344').data,result=inspectSave(source);
    assert.equal(result.status,'unsupported',map.id);assert.equal(result.mapName,map.name);
    assert.equal(result.mapNameSource,map.nameSource);assert.equal(result.mapId,map.id);
    assert.equal(result.targetChecksum,undefined);assert.deepEqual(repairSave(source).data,source);
    assert.equal('old' in map||'current' in map,false,'Naming metadata must contain no repair checksum pair');
  }
});
