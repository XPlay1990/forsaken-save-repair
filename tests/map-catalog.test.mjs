import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_CATALOG,knownMap} from '../dist/map-catalog.mjs';
import {MAP_CHECKSUMS,targetMapChecksum,TARGET_BUILD} from '../dist/map-checksums.mjs';
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

test('all installed maps are eligible for checksum repair with explicit game-test provenance',()=>{
  assert.equal(PROFILE.maps.length,20);
  assert.deepEqual(PROFILE.maps.filter(map=>map.gameTested).map(map=>map.id).sort(),['undeadre01','undeadre01_02','undeadre01_03','undeadre02','undeadre02_04','undeadre02_06']);
  for(const map of MAP_CATALOG){
    const supported=mapProfile(map.mapPath);assert.ok(supported,map.id);
    const source=fixture(map,'11223344').data,result=inspectSave(source);
    assert.equal(result.status,'repair',map.id);assert.equal(result.mapName,supported.name);
    assert.equal(result.mapNameSource,'repair-profile');assert.equal(result.mapId,map.id);
    assert.equal(result.sourceRevisionKnown,false);assert.equal(result.mapGameTested,supported.gameTested);
    assert.equal(result.targetChecksum,targetMapChecksum(map.mapPath).current);
    assert.equal(inspectSave(repairSave(source).data).checksum,result.targetChecksum);
    assert.equal('old' in map||'current' in map,false,'Naming metadata must contain no repair checksum pair');
  }
});

test('archive-derived targets cover installed maps and agree with all seven donor controls',()=>{
  assert.equal(TARGET_BUILD,'3.0.1.24342');assert.equal(MAP_CHECKSUMS.length,20);
  assert.deepEqual(MAP_CHECKSUMS.map(map=>map.id),MAP_CATALOG.map(map=>map.id));
  const donors={undeadre01:'3c2f7a2e',undeadre01_02:'9ef8ba27',undeadre01_03:'990b99db',undeadre01_05:'e3d412fe',undeadre01_06:'eb044a18',undeadre02:'e18988c1',undeadre02_06:'3cb04734'};
  for(const [id,current] of Object.entries(donors))assert.equal(targetMapChecksum(`Campaign\\ForsakenKingdom\\${id}.w3xd`).current,current,id);
  for(const map of PROFILE.maps)assert.equal(targetMapChecksum(`campaign/forsakenkingdom/${map.id}.w3xd`).current,map.current);
  assert.equal(targetMapChecksum('Campaign/Other/undeadre01.w3xd'),undefined);
  assert.equal(targetMapChecksum('Campaign/ForsakenKingdom/not-installed.w3xd'),undefined);
});
