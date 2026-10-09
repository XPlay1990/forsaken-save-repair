import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync,constants as z} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {crc32,headerCRC,blockCRC,inspectSave,repairSave,encodeSettings,decodeSettings,safePath,assertUniquePaths} from '../dist/repair.mjs';
import {PROFILE} from '../dist/profiles.mjs';
import {fixture} from './save-fixture.mjs';

test('CRC32 matches the independent standard vector',()=>assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926));
test('settings encoding preserves zero, even, odd and 255 values',()=>{const data=Uint8Array.from({length:256},(_,i)=>i);assert.deepEqual(decodeSettings(encodeSettings(data)),data);});
for(const map of PROFILE.maps){
  test(`${map.name}: repairs a native-zlib save and preserves gameplay and later blocks`,()=>{
    // A Looming Shadow kept its checksum in 3.0.1, so use an older revision there.
    const source=fixture(map,map.old===map.current?'11223344':map.old);const old=inspectSave(source.data);assert.equal(old.status,'repair');
    const result=repairSave(source.data);const current=inspectSave(result.data);assert.equal(current.status,'current');assert.equal(current.checksum,map.current);
    assert.deepEqual(result.data.slice(48,64),source.data.slice(48,64));assert.deepEqual(result.data.slice(current.firstEnd),source.data.slice(old.firstEnd));
    const allowed=new Set(result.changedOffsets);for(let i=0;i<source.raw.length;i++)if(!allowed.has(i))assert.equal(current.first[i],source.raw[i]);
    assert.equal(result.changedOffsets.length<=10,true);
    const size=new DataView(result.data.buffer).getUint32(68,true);const native=inflateSync(result.data.subarray(80,80+size),{finishFlush:z.Z_SYNC_FLUSH});assert.deepEqual(new Uint8Array(native),current.first);
  });
}
test('already-current saves are byte-identical',()=>{const source=fixture(PROFILE.maps[0],PROFILE.maps[0].current,7003);assert.deepEqual(repairSave(source.data).data,source.data);});
test('unknown campaign maps remain byte-identical and cannot be converted',()=>{const source=fixture({id:'undeadre99',old:'35f0eca7'});assert.equal(inspectSave(source.data).status,'unsupported');assert.deepEqual(repairSave(source.data).data,source.data);});
test('current saves stay identical and non-current build-7003 saves repair for every map',()=>{
  for(const map of PROFILE.maps){
    const current=fixture(map,map.current,7003).data;assert.equal(inspectSave(current).status,'current');assert.deepEqual(repairSave(current).data,current);
    const source=fixture(map,'11223344',7003).data,old=inspectSave(source),fixed=repairSave(source).data,result=inspectSave(fixed);
    assert.equal(old.sourceRevisionKnown,false);assert.equal(result.checksum,map.current);
    assert.deepEqual(fixed.subarray(result.firstEnd),source.subarray(old.firstEnd));
    assert.deepEqual(fixed.subarray(48,64),source.subarray(48,64));
  }
});
test('a previously unobserved source checksum can repair without claiming source-patch verification',()=>{
  const inspected=inspectSave(fixture(PROFILE.maps[0],'11223344').data);
  assert.equal(inspected.status,'repair');assert.equal(inspected.sourceRevisionKnown,false);assert.equal(inspected.mapGameTested,true);
});
test('unverified serialization builds are rejected',()=>assert.throws(()=>inspectSave(fixture(PROFILE.maps[0],PROFILE.maps[0].old,6999).data),/build/));
test('identical map IDs in a different campaign never get a target',()=>{
  const data=fixture({id:'undeadre01',path:'Campaign\\Other\\undeadre01.w3xd'},'11223344').data;
  assert.equal(inspectSave(data).status,'unsupported');assert.equal(inspectSave(data).targetChecksum,undefined);
  assert.deepEqual(repairSave(data).data,data);
});
test('recognized map IDs cannot bypass game identifier/version checks',()=>{
  for(const offset of [48,52]){
    const data=fixture({id:'undeadre03b'},'11223344').data;
    const header=new DataView(data.buffer);header.setUint32(offset,0,true);header.setUint32(64,headerCRC(data.subarray(0,68)),true);
    assert.throws(()=>repairSave(data),/serialization format/);
  }
});
test('corrupt block and header are rejected',()=>{const source=fixture().data;const bad=source.slice();bad[100]^=1;assert.throws(()=>repairSave(bad),/checksum/);const header=source.slice();header[60]^=1;assert.throws(()=>inspectSave(header),/header checksum/);});
test('truncated saves are rejected',()=>assert.throws(()=>inspectSave(fixture().data.slice(0,-1)),/truncated/));
test('bundle path traversal, absolute paths and duplicate Windows paths are rejected',()=>{for(const bad of ['../save.w3z','/save.w3z','C:/save.w3z','dir/../save','dir//save','CON.w3z','dir./save'])assert.throws(()=>safePath(bad));assert.equal(safePath('ForsakenKingdom\\Blizzard\\after_baron\\UndeadRE01.w3z'),'ForsakenKingdom/Blizzard/after_baron/UndeadRE01.w3z');assert.throws(()=>assertUniquePaths([{path:'a/Save.w3z'},{path:'a/save.w3z'}]),/Duplicate/);});

test('real Act One saves match independently repaired Python outputs',{skip:!process.env.FORSAKEN_RECOVERY_ROOT},async()=>{
  const root=process.env.FORSAKEN_RECOVERY_ROOT;
  for(const name of ['UndeadRE01.w3z','UndeadRE01_02.w3z','UndeadRE01_03.w3z']){
    const oldFile=path.join(root,'pre-install-backup','Blizzard','after_patch_Undercity',name);
    const expectedFile=path.join(root,'act1-complete','Blizzard','after_patch_Undercity',name);
    const original=new Uint8Array(await readFile(oldFile));const expected=new Uint8Array(await readFile(expectedFile));
    const result=repairSave(original);const a=inspectSave(result.data);const b=inspectSave(expected);
    assert.equal(a.checksum,b.checksum);assert.deepEqual(a.first,b.first);assert.deepEqual(result.data.subarray(a.firstEnd),expected.subarray(b.firstEnd));assert.deepEqual(result.data.subarray(48,64),expected.subarray(48,64));
  }
});

test('real Act Two and prologue saves match independently repaired Python outputs',{skip:!process.env.FORSAKEN_ALL_MAP_CONTROLS},async()=>{
  const controls=JSON.parse(await readFile(process.env.FORSAKEN_ALL_MAP_CONTROLS,'utf8'));
  assert.deepEqual(controls.map(row=>row.mapId).sort(),['humanre01','humanre02','humanre03','humanre04','undeadre02']);
  for(const row of controls){
    const source=new Uint8Array(await readFile(row.source)),expected=new Uint8Array(await readFile(row.output));
    const repaired=repairSave(source).data,a=inspectSave(repaired),b=inspectSave(expected);
    assert.equal(a.checksum,row.target);assert.deepEqual(a.first,b.first,row.mapId);
    assert.deepEqual(repaired.subarray(a.firstEnd),expected.subarray(b.firstEnd),row.mapId);
    assert.deepEqual(repaired.subarray(48,64),source.subarray(48,64),row.mapId);
  }
});
