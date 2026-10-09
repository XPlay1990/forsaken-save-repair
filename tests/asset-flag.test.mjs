import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSave,restoreAssetFlag,repairSave} from '../dist/repair.mjs';
import {DOWNGRADE_PROFILE as profile} from '../dist/profiles.mjs';
import {fixture} from './save-fixture.mjs';

test('a 3.0.0 save written after a load (header flag 0) is repaired to the fresh-start value 4',()=>{
  const map=profile.maps.find(row=>row.id==='undeadre01_06');
  const broken=fixture(map,map.current,7000,{assetFlag:0}).data;
  const inspection=inspectSave(broken,{profile});
  assert.equal(inspection.assetFlag,0);assert.equal(inspection.status,'repair');assert.match(inspection.reason,/Definitive Edition graphics mode/);
  const fixed=restoreAssetFlag(broken,{profile});
  assert.equal(fixed.restored,true);
  const after=inspectSave(fixed.data,{profile});
  assert.equal(after.assetFlag,4);assert.equal(after.status,'current');assert.equal(after.checksum,map.current);
  const changed=Array.from(after.first).filter((byte,i)=>byte!==inspection.first[i]).length;
  assert.equal(changed,1,'Only the flag byte changes');
  assert.equal(restoreAssetFlag(fixed.data,{profile}).restored,false,'Idempotent');
  assert.equal(repairSave(fixed.data,{profile}).data,fixed.data,'Already current after the repair');
});

test('saves without the record or with an unknown flag value are not touched',()=>{
  const map=profile.maps.find(row=>row.id==='undeadre01_06');
  const plain=fixture(map,map.current,7000).data;
  assert.equal(inspectSave(plain,{profile}).assetFlag,null);assert.equal(restoreAssetFlag(plain,{profile}).restored,false);
  assert.throws(()=>restoreAssetFlag(fixture(map,map.current,7000,{assetFlag:2}).data,{profile}),/Unrecognized player header flag/);
});

test('the header flag is repaired on every supported map, not only the Cathedral',()=>{
  const map=profile.maps.find(row=>row.id==='undeadre01');
  const inspection=inspectSave(fixture(map,map.current,7000,{assetFlag:0}).data,{profile});
  assert.equal(inspection.status,'repair');assert.equal(inspection.flagOnly,true);assert.match(inspection.reason,/Undercity and the Cathedral/);
});
