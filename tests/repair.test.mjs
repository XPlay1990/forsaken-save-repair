import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync,inflateSync,constants as z} from 'node:zlib';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {crc32,headerCRC,blockCRC,inspectSave,repairSave,encodeSettings,decodeSettings,safePath,assertUniquePaths} from '../dist/repair.mjs';
import {PROFILE} from '../dist/profiles.mjs';
import {readZipIndex} from '../dist/zip-index.mjs';
import {zipSync} from 'fflate';
const write=(data,pos,value)=>new DataView(data.buffer,data.byteOffset,data.byteLength).setUint32(pos,value,true);
const bytes=hex=>Uint8Array.from(hex.match(/../g),x=>parseInt(x,16));
function fixture(map=PROFILE.maps[0],checksum=map.old,build=7000){
  const mapPath=`Campaign\\ForsakenKingdom\\${map.id}.w3xd`;
  const raw=new Uint8Array(1048576);for(let i=512;i<raw.length;i++)raw[i]=(i*13+i%19)&255;
  const prefix=new TextEncoder().encode(`${mapPath}\0\0UndeadRe\0\0\0\0\0Local Game\0\0`);
  raw.set(prefix);
  const decoded=new Uint8Array(13+mapPath.length+1+8);
  decoded.set([2,0,0,0,4,102,1,118,1]);decoded.set(bytes(checksum),9);decoded.set(new TextEncoder().encode(mapPath),13);
  const encoded=encodeSettings(decoded);raw.set(encoded,prefix.length);
  const end=prefix.length+encoded.length;const slot=end+9;
  new DataView(raw.buffer).setUint16(slot,16,true);raw[slot+2]=1;
  write(raw,slot+2+16,0x45671234);raw.set(bytes(checksum),slot+2+16+4);
  const second=new Uint8Array(1048576);for(let i=0;i<second.length;i++)second[i]=(i*7+i%11)&255;
  const expanded=[raw,second];const blocks=expanded.map(raw=>{const comp=deflateSync(raw,{level:1,finishFlush:z.Z_SYNC_FLUSH});const head=new Uint8Array(12);write(head,0,comp.length);write(head,4,raw.length);write(head,8,blockCRC(comp,raw.length));return Buffer.concat([head,comp]);});
  const header=new Uint8Array(68);header.set(new TextEncoder().encode('Warcraft III recorded game\x1a\0'));write(header,28,68);write(header,32,68+blocks.reduce((n,b)=>n+b.length,0));write(header,36,1);write(header,40,expanded.length*1048576-37);write(header,44,expanded.length);write(header,48,PROFILE.gameIdentifier);write(header,52,PROFILE.gameVersion);new DataView(header.buffer).setUint16(56,build,true);write(header,60,12345);write(header,64,headerCRC(header));
  return {data:new Uint8Array(Buffer.concat([header,...blocks])),raw,blocks};
}
test('CRC32 matches the independent standard vector',()=>assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926));
test('settings encoding preserves zero, even, odd and 255 values',()=>{const data=Uint8Array.from({length:256},(_,i)=>i);assert.deepEqual(decodeSettings(encodeSettings(data)),data);});
for(const map of PROFILE.maps){
  test(`${map.name}: repairs a native-zlib save and preserves gameplay and later blocks`,()=>{
    const source=fixture(map);const old=inspectSave(source.data);assert.equal(old.status,'repair');
    const result=repairSave(source.data);const current=inspectSave(result.data);assert.equal(current.status,'current');assert.equal(current.checksum,map.current);
    assert.deepEqual(result.data.slice(48,64),source.data.slice(48,64));assert.deepEqual(result.data.slice(current.firstEnd),source.data.slice(old.firstEnd));
    const allowed=new Set(result.changedOffsets);for(let i=0;i<source.raw.length;i++)if(!allowed.has(i))assert.equal(current.first[i],source.raw[i]);
    assert.equal(result.changedOffsets.length<=10,true);
    const size=new DataView(result.data.buffer).getUint32(68,true);const native=inflateSync(result.data.subarray(80,80+size),{finishFlush:z.Z_SYNC_FLUSH});assert.deepEqual(new Uint8Array(native),current.first);
  });
}
test('already-current saves are byte-identical',()=>{const source=fixture(PROFILE.maps[0],PROFILE.maps[0].current,7003);assert.deepEqual(repairSave(source.data).data,source.data);});
test('other acts are identified and preserved unchanged',()=>{const source=fixture({id:'undeadre02',old:'35f0eca7'});assert.equal(inspectSave(source.data).status,'unsupported');assert.deepEqual(repairSave(source.data).data,source.data);});
test('Arcane Sanctuary display label never enables a guessed repair',()=>{for(const checksum of ['e3d412fe','11223344']){const source=fixture({id:'undeadre01_05',old:checksum});const inspected=inspectSave(source.data);assert.equal(inspected.status,'unsupported');assert.equal(inspected.mapName,'Arcane Sanctuary');assert.match(inspected.reason,/not supported/);assert.deepEqual(repairSave(source.data).data,source.data);}});
test('unknown checksum on a known map is rejected',()=>assert.throws(()=>repairSave(fixture(PROFILE.maps[0],'11223344').data),/Unrecognized checksum/));
test('unverified serialization builds are rejected',()=>assert.throws(()=>inspectSave(fixture(PROFILE.maps[0],PROFILE.maps[0].old,6999).data),/build/));
test('corrupt block and header are rejected',()=>{const source=fixture().data;const bad=source.slice();bad[100]^=1;assert.throws(()=>repairSave(bad),/checksum/);const header=source.slice();header[60]^=1;assert.throws(()=>inspectSave(header),/header checksum/);});
test('truncated saves are rejected',()=>assert.throws(()=>inspectSave(fixture().data.slice(0,-1)),/truncated/));
test('bundle path traversal, absolute paths and duplicate Windows paths are rejected',()=>{for(const bad of ['../save.w3z','/save.w3z','C:/save.w3z','dir/../save','dir//save','CON.w3z','dir./save'])assert.throws(()=>safePath(bad));assert.equal(safePath('ForsakenKingdom\\Blizzard\\after_baron\\UndeadRE01.w3z'),'ForsakenKingdom/Blizzard/after_baron/UndeadRE01.w3z');assert.throws(()=>assertUniquePaths([{path:'a/Save.w3z'},{path:'a/save.w3z'}]),/Duplicate/);});
test('ZIP index verifies bounds, file sizes and CRC metadata',async()=>{const data=new TextEncoder().encode('cache preserved');const zip=zipSync({'ForsakenKingdom/Campaigns.w3v':data});const entries=await readZipIndex(new Blob([zip]));assert.equal(entries.size,1);assert.equal(entries.values().next().value.crc,crc32(data));assert.equal(entries.values().next().value.size,data.length);await assert.rejects(readZipIndex(new Blob([zip.slice(0,-1)])),/truncated/);});
test('ZIP traversal and oversized declarations are rejected before inflation',async()=>{const zip=zipSync({'../bad.w3z':new Uint8Array([1])});await assert.rejects(readZipIndex(new Blob([zip])),/Unsafe/);const tooBig=zipSync({'data.bin':new Uint8Array([1])});let p=0;const v=new DataView(tooBig.buffer);while(p<tooBig.length-46&&v.getUint32(p,true)!==0x02014b50)p++;v.setUint32(p+24,0x7fffffff,true);await assert.rejects(readZipIndex(new Blob([tooBig])),/exceeds/);});

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
