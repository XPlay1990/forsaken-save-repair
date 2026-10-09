import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as profiles from '../dist/profiles.mjs';
import {inspectSave,repairSave} from '../dist/repair.mjs';
import {fixture} from './save-fixture.mjs';
import {nativeFixture,expanded} from './native-fixture.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('downgrade selects authenticated 3.0.0 targets rather than the upgrade target',()=>{
  assert.ok(profiles.DOWNGRADE_PROFILE,'A separate downgrade profile is required');
  for(const map of profiles.DOWNGRADE_PROFILE.maps){
    const source=fixture(map,map.old,7000).data,result=repairSave(source,{profile:profiles.DOWNGRADE_PROFILE});
    assert.equal(result.inspection.targetChecksum,map.current,map.id);
    assert.equal(inspectSave(result.data,{profile:profiles.DOWNGRADE_PROFILE}).status,'current',map.id);
    assert.deepEqual(result.data.subarray(48,64),source.subarray(48,64));
    assert.equal(result.inspection.sourceRevisionKnown,true);
  }
});
test('downgrade reverses exact Deathseeker layouts on all maps, including earlier checksum-only repairs',()=>{
  const profile=profiles.DOWNGRADE_PROFILE;
  for(const map of profile.maps){
    for(const deleted of [false,true]){
      const source=nativeFixture({map,current:true,checksum:map.old,build:7000,deleted});
      const result=repairSave(source,{profile});
      assert.equal(result.projectileRepairs,1,map.id);
      assert.equal(hash(expanded(result.data)),hash(expanded(nativeFixture({map,checksum:map.current,build:7000,deleted}))),map.id);
      assert.equal(hash(repairSave(result.data,{profile}).data),hash(result.data),map.id);
      assert.deepEqual(result.data.subarray(48,64),source.subarray(48,64));
      const upgraded=repairSave(result.data);
      assert.equal(hash(expanded(upgraded.data)),hash(expanded(source)),'A reversed checkpoint must also support upgrading again');
    }
  }
});
test('downgrade preserves existing 3.0.0 layout and refuses unknown source checksums or native layouts',()=>{
  const profile=profiles.DOWNGRADE_PROFILE,map=profile.maps.find(row=>row.id==='undeadre02_06');
  const old=nativeFixture({map,checksum:map.current,build:7000});
  assert.equal(hash(repairSave(old,{profile}).data),hash(old));
  assert.throws(()=>repairSave(nativeFixture({map,current:true,checksum:'11223344'}),{profile}),/unverified source map revision/);
  assert.throws(()=>repairSave(nativeFixture({map,current:true,checksum:map.old,badField:true}),{profile}),/unrecognized MUdb state layout/);
  const partial=nativeFixture({map,current:true,checksum:map.current,build:7000});
  assert.equal(repairSave(partial,{profile}).projectileRepairs,1,'Earlier checksum-only downgrades still need native migration');
});
test('downgrade validates structural markers and split projectile types across blocks',()=>{
  const profile=profiles.DOWNGRADE_PROFILE,map=profile.maps.find(row=>row.id==='undeadre01');
  const options={map,decoys:true,allocationOffset:1048576-32,build:7000};
  const result=repairSave(nativeFixture({...options,current:true,checksum:map.old}),{profile});
  assert.equal(result.projectileRepairs,1);
  assert.equal(hash(expanded(result.data)),hash(expanded(nativeFixture({...options,checksum:map.current}))));
});

test('native 3.0.1 resaves remain blocked after confirmed loading failures',()=>{
  const profile=profiles.DOWNGRADE_PROFILE,map=profile.maps.find(row=>row.id==='undeadre02_06');
  assert.throws(()=>repairSave(nativeFixture({map,current:true,checksum:map.old,build:7003}),{profile}),/re-saved by Warcraft III 3.0.1/);
});
