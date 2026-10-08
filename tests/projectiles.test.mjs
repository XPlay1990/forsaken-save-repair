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
test('unknown MUdb field layouts stop conversion',()=>{
  assert.throws(()=>repairSave(nativeFixture({badField:true})),/unrecognized MUdb state layout/);
  assert.throws(()=>repairSave(nativeFixture({map:PROFILE.maps.find(m=>m.id==='undeadre03b'),badField:true})),/unrecognized MUdb state layout/);
  assert.throws(()=>repairSave(nativeFixture({ambiguous:true})),/ambiguous native allocation tables/);
});

test('every recognized campaign map migrates the exact old Deathseeker layout, including unknown source checksums',()=>{
  for(const target of PROFILE.maps){
    const source=nativeFixture({map:target,checksum:'11223344'}),result=repairSave(source);
    assert.equal(result.projectileRepairs,1,target.id);
    assert.equal(result.inspection.sourceRevisionKnown,false,target.id);
    assert.deepEqual(expanded(result.data),expanded(nativeFixture({map:target,current:true,checksum:target.current})),target.id);
    assert.deepEqual(repairSave(result.data).data,result.data,target.id);
    const earlier=nativeFixture({map:target,checksum:target.current});
    assert.equal(repairSave(earlier).projectileRepairs,1,target.id);
    const current=nativeFixture({map:target,current:true,checksum:target.current});
    assert.deepEqual(repairSave(current).data,current,target.id);
  }
});
test('Deathseeker detection crosses expanded blocks and ignores earlier text and unrelated allocation markers',()=>{
  const target=PROFILE.maps.find(m=>m.id==='undeadre01');
  const options={map:target,decoys:true,allocationOffset:1048576-32};
  const source=nativeFixture(options),result=repairSave(source);
  assert.equal(result.projectileRepairs,1);
  assert.deepEqual(expanded(result.data),expanded(nativeFixture({...options,current:true,checksum:target.current})));
});
test('other native projectile types receive only identity repair',()=>{
  for(const markerText of [false,true]){
    const source=nativeFixture({type:'lga+abcd',markerText}),result=repairSave(source);
    assert.equal(result.inspection.projectileRepairCount,0);
    assert.equal(result.inspection.nativePayload===null,true);
    assert.deepEqual(expanded(result.data),expanded(nativeFixture({type:'lga+abcd',markerText,checksum:map.current})));
  }
});
test('unknown map paths remain outside projectile conversion',()=>{
  const source=nativeFixture({map:{id:'undeadre01',path:'Campaign/Other/undeadre01.w3xd'}});
  const result=repairSave(source);
  assert.equal(result.inspection.status,'unsupported');assert.equal(result.inspection.projectileRepairCount,0);
  assert.deepEqual(result.data,source);
});
test('new-engine serialization is outside the old MUdb migration',()=>{
  const source=nativeFixture({build:7003,checksum:map.current});
  assert.equal(inspectSave(source).projectileRepairCount,0);assert.deepEqual(repairSave(source).data,source);
});
