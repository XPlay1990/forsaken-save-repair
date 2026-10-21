import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,PATCHES,mapByPath,mapById,mapChecksum,patch} from '../dist/map-versions.mjs';
import {PROFILE,DOWNGRADE_PROFILE,mapProfile} from '../dist/profiles.mjs';
import {inspectSave,repairSave} from '../dist/repair.mjs';
import {fixture} from './save-fixture.mjs';

test('campaign name lookup uses the complete path with case and separator normalization',()=>{
  assert.equal(mapByPath('Campaign\\ForsakenKingdom\\UndeadRE01_06.w3xd').name,'Cathedral');
  assert.equal(mapByPath('campaign/forsakenkingdom/HumanRE01.w3xd').name,'Homecoming');
  assert.equal(mapByPath('Campaign/Other/UndeadRE01_06.w3xd'),undefined);
  assert.equal(mapByPath('Campaign/ForsakenKingdom/not-installed.w3xd'),undefined);
  assert.equal(MAPS.length,20);assert.equal(new Set(MAPS.map(map=>map.id)).size,20);
  assert.equal(MAPS.filter(map=>map.campaign==='Forsaken Kingdom').length,15);
  assert.equal(MAPS.filter(map=>map.section==='Prologue').length,5);
});

test('every map has a checksum for every full patch, matching donor and original-save controls',()=>{
  assert.deepEqual(PATCHES.map(row=>[row.version,row.executable,row.saveBuild]),[['3.0.0','3.0.0.24268',7000],['3.0.1','3.0.1.24342',7003],['3.0.1.24371','3.0.1.24371',7003]]);
  for(const map of MAPS)for(const version of ['3.0.0','3.0.1'])assert.match(map.checksums[version],/^[0-9a-f]{8}$/,`${map.id} ${version}`);
  const donors301={undeadre01:'3c2f7a2e',undeadre01_02:'9ef8ba27',undeadre01_03:'990b99db',undeadre01_05:'e3d412fe',undeadre01_06:'eb044a18',undeadre02:'e18988c1',undeadre02_06:'3cb04734'};
  for(const [id,checksum] of Object.entries(donors301))assert.equal(mapChecksum(id,'3.0.1'),checksum,id);
  const originals300={humanre01:'b25f80d8',humanre02:'cf967337',humanre03:'4ced8316',humanre04:'6b5baefc',undeadre01:'d14c260a',undeadre01_02:'5035caa4',undeadre01_03:'aa301d70',undeadre02:'35f0eca7',undeadre02_06:'b0669dc1'};
  for(const [id,checksum] of Object.entries(originals300))assert.equal(mapChecksum(id,'3.0.0'),checksum,id);
  assert.deepEqual(MAPS.filter(map=>map.evidence['3.0.0'].originalSaveMatched).map(map=>map.id).sort(),Object.keys(originals300).sort());
  assert.deepEqual(MAPS.filter(map=>map.evidence['3.0.1'].donorSaveMatched).map(map=>map.id).sort(),Object.keys(donors301).sort());
  assert.equal(patch('3.0.0').content,'3.0.0.24248');
});

// 3.0.1.24371 changed 16 of the 20 maps; three targets match saves that build wrote.
test('3.0.1.24371 checksums cover every map and match its donor saves',()=>{
  const donors24371={undeadre01:'c25954e3',undeadre02:'c97c51ea',undeadre03a:'66ed1037'};
  for(const map of MAPS)assert.match(map.checksums['3.0.1.24371'],/^[0-9a-f]{8}$/,map.id);
  for(const [id,checksum] of Object.entries(donors24371))assert.equal(mapChecksum(id,'3.0.1.24371'),checksum,id);
  assert.deepEqual(MAPS.filter(map=>map.evidence['3.0.1.24371'].donorSaveMatched).map(map=>map.id).sort(),Object.keys(donors24371).sort());
  assert.deepEqual(MAPS.filter(map=>map.checksums['3.0.1.24371']===map.checksums['3.0.1']).map(map=>map.id).sort(),['humanre02interlude','humanre04','undeadre03a','undeadre03interlude']);
});

test('both conversion directions are derived from the per-patch table',()=>{
  for(const map of MAPS){
    const up=mapProfile(map.mapPath,PROFILE),down=mapProfile(map.mapPath,DOWNGRADE_PROFILE);
    assert.equal(up.current,map.checksums['3.0.1.24371']);assert.equal(up.old,map.checksums['3.0.0']);
    assert.deepEqual(up.known,[map.checksums['3.0.0'],map.checksums['3.0.1']]);
    assert.equal(down.current,map.checksums['3.0.0']);assert.equal(down.old,map.checksums['3.0.1']);
  }
  assert.equal(PROFILE.to,'3.0.1.24371');assert.equal(PROFILE.build,'24371');
  assert.equal(DOWNGRADE_PROFILE.enabled,false,'Downgrade disabled: the restored 3.0.0 was replaced by 3.0.1.24371');assert.equal(PROFILE.enabled,true,'Upgrade enabled for patch 3.0.1');
});

test('every installed map converts to 3.0.1.24371 with game-test provenance per target build',()=>{
  assert.equal(PROFILE.maps.length,20);
  assert.deepEqual(PROFILE.maps.filter(map=>map.gameTested).map(map=>map.id).sort(),['undeadre01','undeadre02'],'Game tests on 3.0.1.24342 do not carry over');
  assert.deepEqual(DOWNGRADE_PROFILE.maps.filter(map=>map.gameTested).map(map=>map.id).sort(),['undeadre01','undeadre01_02','undeadre01_03','undeadre01_05','undeadre01_06','undeadre02','undeadre02_06']);
  for(const map of MAPS){
    const supported=mapProfile(map.mapPath),source=fixture(map,'11223344').data,result=inspectSave(source);
    assert.equal(result.mapId,map.id);
    assert.ok(supported,map.id);
    assert.equal(result.status,'repair',map.id);assert.equal(result.mapName,supported.name);
    assert.equal(result.mapNameSource,'repair-profile');
    assert.equal(result.sourceRevisionKnown,false);assert.equal(result.mapGameTested,supported.gameTested);
    assert.equal(result.targetChecksum,map.checksums['3.0.1.24371']);
    assert.equal(inspectSave(repairSave(source).data).checksum,result.targetChecksum);
    for(const version of ['3.0.0','3.0.1']){
      const earlier=inspectSave(fixture(map,map.checksums[version]).data);
      assert.equal(earlier.sourceRevisionKnown,true,`${map.id} ${version}`);
      assert.equal(earlier.status,map.checksums[version]===map.checksums['3.0.1.24371']?'current':'repair',`${map.id} ${version}`);
    }
  }
});
