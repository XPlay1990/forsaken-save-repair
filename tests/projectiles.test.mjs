import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFILE} from '../dist/profiles.mjs';
import {inspectSave,repairSave} from '../dist/repair.mjs';
import {nativeFixture,expanded} from './native-fixture.mjs';
const map=PROFILE.maps.find(m=>m.id==='undeadre02_06');

test('MUdb migration matches independently assembled current layout across a block boundary',()=>{
  for(const deleted of [false,true]){
    const source=nativeFixture({deleted}),result=repairSave(source);
    assert.equal(result.inspection.projectileRepairCount,1);assert.equal(result.projectileRepairs,1);
    assert.deepEqual(expanded(result.data),expanded(nativeFixture({current:true,checksum:map.current,deleted})));
    assert.equal(inspectSave(result.data).status,'current');assert.deepEqual(repairSave(result.data).data,result.data);
    assert.deepEqual(result.data.subarray(48,64),source.subarray(48,64));
  }
});
test('an earlier checksum-only export still receives the native-state fix',()=>{
  const source=nativeFixture({checksum:map.current});assert.equal(inspectSave(source).status,'repair');
  const result=repairSave(source);assert.equal(result.projectileRepairs,1);assert.deepEqual(result.changedOffsets,[]);
});
test('current native-layout saves remain byte-identical',()=>{
  for(const build of [7000,7003]){
    const source=nativeFixture({current:true,checksum:map.current,build});
    assert.equal(inspectSave(source).status,'current');assert.deepEqual(repairSave(source).data,source);
  }
});
test('unknown MUdb field layouts and source revisions stop conversion',()=>{
  assert.throws(()=>repairSave(nativeFixture({badField:true})),/unrecognized MUdb state layout/);
  assert.throws(()=>repairSave(nativeFixture({checksum:'11223344'})),/unverified source map revision/);
});
test('new-engine serialization is outside the old MUdb migration',()=>{
  const source=nativeFixture({build:7003,checksum:map.current});
  assert.equal(inspectSave(source).projectileRepairCount,0);assert.deepEqual(repairSave(source).data,source);
});
